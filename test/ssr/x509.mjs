// Minimal X.509 minting with Node built-ins (40 §2.2): a throwaway test CA and leaf certificates for the
// stub's HTTPS names (ECDSA P-256, SHA-256). DER is assembled by hand; Node verifies the result.
import crypto from 'node:crypto'

const len = (n) => {
  if (n < 0x80) return Buffer.from([n])
  const bytes = []
  while (n > 0) {
    bytes.unshift(n & 0xff)
    n >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}
const tlv = (tag, ...parts) => {
  const body = Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))))
  return Buffer.concat([Buffer.from([tag]), len(body.length), body])
}
const seq = (...p) => tlv(0x30, ...p)
const set = (...p) => tlv(0x31, ...p)
const int = (buf) => {
  let b = Buffer.from(buf)
  while (b.length > 1 && b[0] === 0 && !(b[1] & 0x80)) b = b.subarray(1)
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b])
  return tlv(0x02, b)
}
const intN = (n) => int(Buffer.from([n]))
const oid = (s) => {
  const p = s.split('.').map(Number)
  const out = [40 * p[0] + p[1]]
  for (const v of p.slice(2)) {
    const stack = [v & 0x7f]
    let x = v >>> 7
    while (x > 0) {
      stack.unshift(0x80 | (x & 0x7f))
      x >>>= 7
    }
    out.push(...stack)
  }
  return tlv(0x06, Buffer.from(out))
}
const utf8 = (s) => tlv(0x0c, Buffer.from(s, 'utf8'))
const bool = (v) => tlv(0x01, Buffer.from([v ? 0xff : 0]))
const octet = (b) => tlv(0x04, b)
const bitString = (b) => tlv(0x03, Buffer.concat([Buffer.from([0]), b]))
// named-bit BIT STRING (DER: trailing zero bits counted as unused)
const namedBits = (byte) => {
  let unused = 0
  while (unused < 8 && !(byte & (1 << unused))) unused++
  return tlv(0x03, Buffer.from([unused, byte]))
}
const explicit = (n, inner) => tlv(0xa0 + n, inner)
const time = (d) => {
  // UTCTime for 1950..2049, GeneralizedTime otherwise
  const pad = (x) => String(x).padStart(2, '0')
  const y = d.getUTCFullYear()
  const rest = `${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  return y < 2050 ? tlv(0x17, Buffer.from(`${String(y).slice(2)}${rest}`)) : tlv(0x18, Buffer.from(`${y}${rest}`))
}
const name = (cn) => seq(set(seq(oid('2.5.4.3'), utf8(cn))), set(seq(oid('2.5.4.10'), utf8('search parity harness (test only)'))))
const ext = (id, critical, value) => seq(oid(id), ...(critical ? [bool(true)] : []), octet(value))
const ECDSA_SHA256 = seq(oid('1.2.840.10045.4.3.2'))

const keyId = (spki) => crypto.createHash('sha1').update(spki).digest()

function build({ subject, issuer, publicKey, signingKey, serial, notBefore, notAfter, extensions }) {
  const spki = publicKey.export({ type: 'spki', format: 'der' })
  const tbs = seq(explicit(0, intN(2)), int(serial), ECDSA_SHA256, issuer, seq(time(notBefore), time(notAfter)), subject, spki, explicit(3, seq(...extensions)))
  const sig = crypto.sign('sha256', tbs, signingKey)
  const der = seq(tbs, ECDSA_SHA256, bitString(sig))
  const pem = `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`
  return { der, pem }
}

export function mintCa({ commonName = 'search parity harness test CA', days = 30, now = new Date() } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const spki = publicKey.export({ type: 'spki', format: 'der' })
  const subject = name(commonName)
  const notBefore = new Date(now.getTime() - 3600 * 1000)
  const notAfter = new Date(now.getTime() + days * 86400 * 1000)
  const cert = build({
    subject,
    issuer: subject,
    publicKey,
    signingKey: privateKey,
    serial: crypto.randomBytes(16),
    notBefore,
    notAfter,
    extensions: [
      ext('2.5.29.19', true, seq(bool(true))), // basicConstraints CA:TRUE
      ext('2.5.29.15', true, namedBits(0x06)), // keyUsage keyCertSign, cRLSign
      ext('2.5.29.14', false, octet(keyId(spki))), // subjectKeyIdentifier
    ],
  })
  return { ...cert, subject, privateKey, publicKey, keyId: keyId(spki), keyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) }
}

export function mintLeaf(ca, names, { days = 30, now = new Date() } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const spki = publicKey.export({ type: 'spki', format: 'der' })
  const san = seq(...names.map((n) => tlv(0x82, Buffer.from(n, 'ascii')))) // dNSName [2] IA5String
  const notBefore = new Date(now.getTime() - 3600 * 1000)
  const notAfter = new Date(now.getTime() + days * 86400 * 1000)
  const cert = build({
    subject: name(names[0]),
    issuer: ca.subject,
    publicKey,
    signingKey: ca.privateKey,
    serial: crypto.randomBytes(16),
    notBefore,
    notAfter,
    extensions: [
      ext('2.5.29.19', true, seq()), // basicConstraints CA:FALSE
      ext('2.5.29.15', true, namedBits(0x80)), // keyUsage digitalSignature
      ext('2.5.29.37', false, seq(oid('1.3.6.1.5.5.7.3.1'))), // extKeyUsage serverAuth
      ext('2.5.29.17', false, san),
      ext('2.5.29.14', false, octet(keyId(spki))),
      ext('2.5.29.35', false, seq(tlv(0x80, ca.keyId))), // authorityKeyIdentifier keyIdentifier [0]
    ],
  })
  return { ...cert, keyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) }
}
