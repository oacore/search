import { useEffect } from 'react'

let appHydrated = false

// False on the server and during the render that hydrates the server's HTML,
// true from then on. The flag belongs to the app root, not to the hooks that
// read it, so a page mounted by a client navigation reads true from its first
// render, whichever page came before it.
export const isAppHydrated = () => appHydrated

// Called once, at the app root. A child's effect runs before its parent's, so
// the mount effects of the hydrating commit can still read false here. All of
// them run before the next render, so no later render does.
const useMarkAppHydrated = () => {
  useEffect(() => {
    appHydrated = true
  }, [])
}

export default useMarkAppHydrated
