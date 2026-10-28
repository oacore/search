import { useRef, useCallback, useEffect } from 'react'
import FocusLock from 'react-focus-lock'
import PropTypes from 'prop-types'

import styles from './modal.css'
import ModalTitle from './title'
import ModalFooter from './footer'
import ModalContent from './content'
import ModalPortal from './portal'
import { Button, Icon } from '../../elements'
import { classNames } from '../../utils'

const checkAccessibility = (props, propName, componentName) => {
  if (!props['aria-label'] && !props['aria-labelledby']) {
    return new Error(
      `One of props 'aria-label' or 'aria-labelledby' isRequired in '${componentName}'.`
    )
  }

  if (!props['aria-label'] && !props['aria-labelledby']) {
    return new Error(
      `One of props 'aria-label' or 'aria-labelledby' was not specified in '${componentName}'.`
    )
  }

  if (props['aria-label'] && props['aria-labelledby']) {
    return new Error(
      `Props 'aria-label' and 'aria-labelledby' in '${componentName}' mutually exclusive.`
    )
  }

  return null
}

const Modal = ({
  children,
  onClose,
  className,
  hideManually = false,
  ...restProps
}) => {
  const modalRef = useRef(null)

  const handleKeyDown = useCallback(
    (event) => {
      if (hideManually || !onClose) return
      if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27)
        onClose(event)
    },
    [hideManually]
  )

  const handleClick = useCallback(
    (event) => {
      if (hideManually || !onClose) return
      if (
        (modalRef.current && modalRef.current.contains(event.target)) ||
        // If the click is on the scrollbar we don't want to close the modal.
        event.pageX > event.target.ownerDocument.documentElement.offsetWidth ||
        event.pageY > event.target.ownerDocument.documentElement.offsetHeight
      )
        return
      onClose(event)
    },
    [hideManually]
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <ModalPortal>
      <div className={styles.overlayRoot}>
        <FocusLock returnFocus>
          {/* eslint-disable-next-line max-len */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className={styles.overlay}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            {...restProps}
          >
            <div
              ref={(ref) => {
                modalRef.current = ref
                // make sure disableBodyScroll is not called after
                // component unmount with ref === null
              }}
              role="dialog"
              className={classNames.use(styles.modal).join(className)}
              {...restProps}
            >
              {!hideManually && (
                <Button
                  className={styles.closeButton}
                  aria-label="Close"
                  onClick={(event) => onClose(event)}
                >
                  <Icon src="#window-close" />
                </Button>
              )}
              {children}
            </div>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  )
}

Modal.Title = ModalTitle
Modal.Content = ModalContent
Modal.Footer = ModalFooter

Modal.propTypes = {
  'id': PropTypes.string,
  'children': PropTypes.node,
  /**
   *  Callback called when modal is being closed
   */
  'onClose': PropTypes.func,
  /**
   *  Describes the title of the modal
   */
  'aria-label': checkAccessibility,
  /**
   * Points to modal label.
   * Ideally it should be used in conjunction with Modal.Title
   */
  'aria-labelledby': checkAccessibility,
  /**
   * If set to true onClose callback is not triggered on overlay click
   * or hitting ESC button.
   */
  'hideManually': PropTypes.bool,
  /**
   *  The location where the modal is rendered
   */
  'selector': PropTypes.string,
  /**
   * className applied on modal
   */
  'className': PropTypes.string,
}

export default Modal
