import React, { useEffect, useLayoutEffect, useState } from 'react'
import { DesignProvider, Cookies as CookiesPopup } from '@oacore/design'

import Head from './head'

import Layout from 'modules/layout'
import { useInitStore, StoreProvider } from 'store'
import useAnalytics from 'hooks/use-analytics'

// The popup shows on the first client render when the consent cookie is absent,
// and never on the server (Q-051): it waits for the mount. A component of its
// own, so that the rest of the page does not render again for it. In the
// browser the flag is set by a layout effect, so the popup renders in the
// hydration commit, before paint (React 18 runs a passive effect after paint);
// on the server it stays a passive effect, which never runs there.
const useMountEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

const CookiesAfterMount = () => {
  const [mounted, setMounted] = useState(false)

  useMountEffect(() => setMounted(true), [])

  return mounted ? <CookiesPopup /> : null
}

const Main = ({ children, initialState, loading, isSearchPage }) => {
  const store = useInitStore(initialState)

  useAnalytics()

  return (
    <StoreProvider store={store}>
      <DesignProvider>
        <Head />
        <Layout isSearchPage={isSearchPage} loading={loading}>
          {children}
        </Layout>
        <CookiesAfterMount />
      </DesignProvider>
    </StoreProvider>
  )
}

export default Main
