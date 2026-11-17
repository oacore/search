// T-107 (41 B, R-018): utils/validation.js `convertAndValidate`, findings/06
// §3.4 (the params of the data-providers store are T-212's). The table rows
// use the real data-providers schema (store/data-providers.ts). Pins today's
// behaviour, quirks included: an empty size string converts to 0 and is
// valid, a case-different action falls back to the default, an invalid
// change falls back to the schema default (never to the previous value),
// and a missing default makes an invalid value throw.
const validationModule = require('../../../utils/validation')
const { schema } = require('../../../store/data-providers')

const { convertAndValidate } = validationModule

const run = (params, key) => convertAndValidate({ schema, params, key })

describe('T-107 @P1 validation and params (findings/06 §3.4)', () => {
  test('T-107 @P1 the module exports convertAndValidate as the named and the default export, nothing else', () => {
    expect(typeof validationModule.default).toBe('function')
    expect(validationModule.default).toBe(validationModule.convertAndValidate)
    expect(Object.keys(validationModule).sort()).toEqual([
      'convertAndValidate',
      'default',
    ])
  })

  test('T-107 @P1 the data-providers schema is q (string), size (number), action (ADD or null) with defaults "", 10, null', () => {
    expect(schema).toEqual({
      q: { default: '', convert: 'string', validation: 'string' },
      size: { default: 10, validation: 'number', convert: 'number' },
      action: { default: null, validation: ['ADD', null] },
    })
  })

  describe('the 06 §3.4 table', () => {
    test.each([
      ['{}', {}, { q: '', size: 10, action: null }],
      [
        'valid values and an extra key (dropped)',
        { q: 'abc', size: '20', action: 'ADD', extra: 1 },
        { q: 'abc', size: 20, action: 'ADD' },
      ],
      [
        'number q, bad size, case-different action',
        { q: 5, size: 'abc', action: 'add' },
        { q: '5', size: 10, action: null },
      ],
      [
        'non-integer size string',
        { size: '1.5' },
        { q: '', size: 10, action: null },
      ],
      [
        'empty size string converts to 0 (Number("") is 0)',
        { size: '' },
        { q: '', size: 0, action: null },
      ],
      [
        'array q is joined by toString',
        { q: ['a', 'b'] },
        { q: 'a,b', size: 10, action: null },
      ],
    ])('T-107 @P1 convertAndValidate %s', (name, params, expected) => {
      const result = run(params)
      expect(result).toEqual(expected)
      // exactly the schema keys, in schema order, and extra keys are removed
      expect(Object.keys(result)).toEqual(['q', 'size', 'action'])
    })

    test.each([
      ['size null converts to 0', { size: null }, 0],
      ['size true converts to 1', { size: true }, 1],
      ['size [5] converts to 5', { size: [5] }, 5],
      ['size " 7 " converts to 7', { size: ' 7 ' }, 7],
      ['size "10.0" converts to 10', { size: '10.0' }, 10],
      ['size "1e3" converts to 1000', { size: '1e3' }, 1000],
      ['size "0x10" converts to 16', { size: '0x10' }, 16],
      ['negative size is kept', { size: '-3' }, -3],
      ['size Infinity is not an integer: default', { size: Infinity }, 10],
      ['size NaN is not an integer: default', { size: NaN }, 10],
      ['size undefined stays undefined: default', { size: undefined }, 10],
    ])('T-107 @P1 size: %s', (name, params, size) => {
      expect(run(params).size).toBe(size)
    })

    test.each([
      ['0', 0, '0'],
      ['false', false, 'false'],
      ['an object', { a: 1 }, '[object Object]'],
      ['undefined', undefined, ''],
      ['an empty string', '', ''],
    ])(
      'T-107 @P1 q: %s is converted with toString, undefined falls back to the default',
      (name, q, expected) => {
        expect(run({ q }).q).toBe(expected)
      }
    )

    test('T-107 @P1 q null throws a TypeError (null.toString), not the default', () => {
      expect(() => run({ q: null })).toThrow(TypeError)
    })

    test('T-107 @P1 action accepts only "ADD" and null (case-sensitive); anything else is the default null', () => {
      expect(run({ action: 'ADD' }).action).toBe('ADD')
      expect(run({ action: null }).action).toBeNull()
      expect(run({ action: undefined }).action).toBeNull()
      expect(run({ action: 'add' }).action).toBeNull()
      expect(run({ action: 'REMOVE' }).action).toBeNull()
      expect(run({ action: '' }).action).toBeNull()
    })
  })

  describe('the key option and the schema edge cases', () => {
    test('T-107 @P1 with key only that key is processed and its value (not an object) is returned', () => {
      expect(run({ size: '7', q: 'zz' }, 'size')).toBe(7)
      expect(run({ size: '7', q: 'zz' }, 'q')).toBe('zz')
      expect(run({}, 'size')).toBe(10)
      expect(run({}, 'q')).toBe('')
      expect(run({ action: 'ADD' }, 'action')).toBe('ADD')
    })

    test('T-107 @P1 with key a key outside the schema is returned as it is; an empty key processes every schema key', () => {
      expect(
        convertAndValidate({ schema: {}, params: { x: 3 }, key: 'x' })
      ).toBe(3)
      expect(convertAndValidate({ schema: {}, params: {}, key: 'x' })).toBe(
        undefined
      )
      expect(run({ q: 'a' }, '')).toEqual({ q: 'a', size: 10, action: null })
    })

    test('T-107 @P1 an empty schema returns an empty object; a schema key without rules passes the value through', () => {
      expect(convertAndValidate({ schema: {}, params: { a: 1 } })).toEqual({})
      expect(
        convertAndValidate({ schema: { a: {} }, params: { a: 5 } })
      ).toEqual({ a: 5 })
      expect(convertAndValidate({ schema: { a: {} }, params: {} })).toEqual({
        a: undefined,
      })
    })

    test('T-107 @P1 an unknown convert or validation keyword leaves the value alone and valid', () => {
      expect(
        convertAndValidate({
          schema: { a: { validation: 'boolean', default: 1, convert: 'what' } },
          params: { a: 'zzz' },
        })
      ).toEqual({ a: 'zzz' })
    })

    test('T-107 @P1 an invalid value without a schema default throws "Value for schema [object Object] is invalid"', () => {
      const message =
        'Value for schema [object Object] is invalid. Default value is not specified'
      expect(() =>
        convertAndValidate({
          schema: { a: { validation: 'number', convert: 'number' } },
          params: { a: 'x' },
        })
      ).toThrow(new Error(message))
      // undefined is not converted, so it is invalid for "number" too
      expect(() =>
        convertAndValidate({
          schema: { a: { validation: 'number' } },
          params: {},
        })
      ).toThrow(new Error(message))
      expect(() =>
        convertAndValidate({
          schema: { a: { validation: ['x', 'y'] } },
          params: { a: 'z' },
        })
      ).toThrow(new Error(message))
      // with key the same error comes out
      expect(() =>
        convertAndValidate({
          schema: { a: { validation: ['x', 'y'] } },
          params: { a: 'z' },
          key: 'a',
        })
      ).toThrow(new Error(message))
    })

    test('T-107 @P1 a default of undefined counts as "not specified"; a default of null or 0 is used', () => {
      expect(
        convertAndValidate({
          schema: {
            a: { validation: 'number', convert: 'number', default: 0 },
          },
          params: { a: 'x' },
        })
      ).toEqual({ a: 0 })
      expect(
        convertAndValidate({
          schema: { a: { validation: ['x'], default: null } },
          params: { a: 'z' },
        })
      ).toEqual({ a: null })
    })

    test('T-107 @P1 params undefined is a TypeError when the schema has keys', () => {
      expect(() => convertAndValidate({ schema, params: undefined })).toThrow(
        TypeError
      )
    })
  })
})
