import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const ModalPortal = ({ children }) => {
  const ref = useRef()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const modalRoot =
      document.getElementById('modal-root') ??
      document.querySelector('body').appendChild(document.createElement('div'))

    modalRoot.id = 'modal-root'
    ref.current = modalRoot

    setMounted(true)
  }, [])

  return mounted ? createPortal(children, ref.current) : null
}

export default ModalPortal
