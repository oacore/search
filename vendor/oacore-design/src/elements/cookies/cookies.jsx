import React, { useCallback, useState, useEffect } from 'react'

// eslint-disable-next-line import/no-cycle
import CookiesPopup from './popup'

import { useCookie, useCookieHandler, useCookieItems } from 'hooks'

const Cookies = () => {
  const cookieHandler = useCookieHandler()

  const [visibleCookiePopup, setVisibleCookiePopup] = useState(
    !useCookie('essential_cookies_allowed')
  )

  const cookieItems = useCookieItems()
  const cookieItemNames = cookieItems.map(({ name }) => name)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname === '/cookies'
    )
      setVisibleCookiePopup(false)
  }, [])

  const onAcceptCookies = useCallback((e) => {
    setVisibleCookiePopup(false)
    cookieHandler(e)
  }, [])

  return (
    visibleCookiePopup &&
    typeof window !== 'undefined' && (
      <CookiesPopup onSubmit={onAcceptCookies} cookieItems={cookieItemNames} />
    )
  )
}
export default Cookies
