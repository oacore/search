import { useCallback } from 'react'
import { useCookies } from 'react-cookie'

const cookiesContext = [
  {
    id: 'essential',
    name: 'essential_cookies_allowed',
    default: false,
    required: true,
    title: 'Essential cookies only',
    description:
      '**Required** to make the site work, and to save the options you make here',
  },
  {
    id: 'analytics',
    name: 'analytics_cookies_allowed',
    default: false,
    required: false,
    title: 'Analytics allowed',
    description:
      'Lets us (anonymously) track site usage, so that we can measure performance and make improvements',
  },
]

const convertCookieValue = (value) => {
  let cookieValue = value
  if (['true', 'false'].includes(cookieValue))
    cookieValue = cookieValue === 'true'

  return cookieValue
}
export const useCookieItems = () => {
  const [cookies] = useCookies()
  return cookiesContext.map((cookie) => {
    // convert cookie to its boolean representation
    const cookieValue = convertCookieValue(cookies[cookie.name])

    return {
      ...cookie,
      value: cookieValue ?? cookie.default,
    }
  })
}

export const useCookie = (cookieName) => {
  const [cookies] = useCookies([cookieName])
  const cookieValue = convertCookieValue(cookies[cookieName])

  return (
    cookieValue ??
    cookiesContext.find(({ name }) => name === cookieName)?.default
  )
}

export const useCookieHandler = () => {
  const [, setCookie, removeCookie] = useCookies()
  const items = useCookieItems()
  return useCallback((event) => {
    event.preventDefault()

    cookiesContext.forEach(({ name }) => removeCookie(name))

    const idsArray = event.target.id.split(',')
    let patch
    // accept only essential cookies
    if (idsArray.length === 1) {
      patch = items
        .filter((el) => el.name === idsArray[0])
        .map(({ name }) => [name, true])
    }
    // assuming when user hit accept in popup form we accept all cookies
    else {
      patch = items
        .filter(({ name }) => idsArray.includes(name))
        .map(({ name }) => [name, true])
    }

    patch.forEach(([cookieName, cookieValue]) => {
      setCookie(cookieName, cookieValue, {
        path: '/',
        maxAge: 1 * 365 * 24 * 60 * 60,
      })
    })
  }, items)
}
