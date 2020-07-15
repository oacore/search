import { join } from 'path'

import { useEffect } from 'react'
import { useRouter } from 'next/router'

const useRedirect = (
  routePath,
  actualPath = routePath,
  { replace = true } = {}
) => {
  const router = useRouter()

  useEffect(() => {
    // Do not need to redirect
    if (!routePath) return

    const pathname = join(router.pathname, routePath)
    const asPath = join(router.asPath, actualPath)
    if (replace) router.replace(pathname, asPath)
    else router.push(pathname, asPath)
  }, [])
}

// Keeping default way to import hooks
// eslint-disable-next-line import/prefer-default-export
export { useRedirect }
