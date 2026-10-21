// P0-15 consent helpers (T-740, J28; Q-070): the cookie writes of the consent popup as the browser receives
// them, and the popup itself. The design `Cookies` (src/elements/cookies/cookies.jsx, popup.jsx,
// hooks/use-cookies.js) removes both cookies without a path, then writes the chosen ones:
//   "Essential cookies only"  button id `essential_cookies_allowed`
//   "I agree"                 button id `essential_cookies_allowed,analytics_cookies_allowed`
// every written cookie is `<name>=true; Max-Age=31536000; Path=/` (one year, no other attribute).
export const ESSENTIAL = 'essential_cookies_allowed'
export const ANALYTICS = 'analytics_cookies_allowed'
export const YEAR = 365 * 24 * 60 * 60

// the strings the popup assigns to document.cookie (react-cookie / universal-cookie 4 formatting)
export const REMOVE = (name) =>
  `${name}=; Max-Age=0; Expires=Sun, 01 Feb 1970 00:00:01 GMT`
export const SET = (name) => `${name}=true; Max-Age=${YEAR}; Path=/`

// init script (runs before any page script): every string assigned to document.cookie in this document
export const cookieLogInit = () => {
  const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
  window.__p15cookies = []
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      return desc.get.call(this)
    },
    set(v) {
      window.__p15cookies.push(String(v))
      desc.set.call(this, v)
    },
  })
}

export const cookieWrites = (page) =>
  page.evaluate(() => window.__p15cookies || [])

export const popupOf = (page) => page.locator('#cookies-popup')

// a cookie of the consent family as the guard sets it (path /, far expiry), with any value
export const consentCookie = (name, value, url) => ({
  name,
  value,
  url,
  expires: Math.floor(Date.now() / 1000) + YEAR,
})
