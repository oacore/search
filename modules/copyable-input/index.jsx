import React, { useRef, useCallback, useReducer } from 'react'
import { Form, Icon, Button, Popover } from '@oacore/design'

import styles from './styles.module.css'

const initialTooltipState = {
  isTooltipShown: false,
  tooltipText: "Copy API endpoint to your clipboard'",
}

const tooltipReducer = (state, action) => {
  switch (action) {
    case 'hide':
      return initialTooltipState
    case 'copied':
      return { ...state, tooltipText: 'Copied!' }
    case 'show':
      return { ...initialTooltipState, isTooltipShown: true }
    default:
      throw new Error('Received unknown action in tooltipReducer')
  }
}

const CopyableInput = ({ id, value }) => {
  const inputRef = useRef(null)
  const [{ tooltipText, isTooltipShown }, dispatchTooltip] = useReducer(
    tooltipReducer,
    initialTooltipState
  )

  const copyToClipboard = useCallback(() => {
    if (
      !document.queryCommandSupported &&
      !document.queryCommandSupported('copy')
    )
      return

    dispatchTooltip('copied')
    const copyText = inputRef.current

    copyText.select()
    copyText.setSelectionRange(0, value.length)

    document.execCommand('copy')
  }, [value])

  return (
    <Form.Group tag="div" className={styles.group}>
      <Form.Addon place="append" className={styles.appendIcon}>
        <Popover placement="top" content={tooltipText} visible={isTooltipShown}>
          <Button
            type="button"
            className={styles.copyButton}
            onClick={copyToClipboard}
            onMouseEnter={() => dispatchTooltip('show')}
            onMouseLeave={() => dispatchTooltip('hide')}
          >
            <Icon src="#content-copy" />
          </Button>
        </Popover>
      </Form.Addon>
      <Form.Control
        ref={inputRef}
        id={`copy-${id}`}
        type="text"
        value={value}
        autoComplete="off"
        readOnly
      />
      <Form.Label htmlFor={`copy-${id}`} className="sr-only">
        {value}
      </Form.Label>
    </Form.Group>
  )
}

export default CopyableInput
