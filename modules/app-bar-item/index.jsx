import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AppBar } from '@oacore/design'

const AppBarItem = ({ children, className }) => {
  const [mounted, setMounted] = useState(false)
  const root = useRef()

  useEffect(() => {
    root.current = document.getElementById('app-bar')
    setMounted(true)
  }, [])

  return mounted
    ? createPortal(
        <AppBar.Item className={className}>{children}</AppBar.Item>,
        root.current
      )
    : null
}

export default AppBarItem
