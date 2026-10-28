import { useEffect, useRef, useState, useCallback } from 'react'

const useInput = (value, { onInput, onChange, changeOnBlur }) => {
  const inputRef = useRef(null)
  const [isInitialised, setIsInitialised] = useState(false)
  const inputEventType = useRef(null)
  const [inputData, changeInputData] = useState({ value })
  const [isInputFocused, setIsInputFocusedInternal] = useState(null)

  useEffect(() => {
    if (value !== inputData.value) changeInputData({ value })
  }, [value])

  useEffect(() => {
    onInput(inputData)
  }, [inputData.value])

  useEffect(() => {
    if (!isInitialised) {
      setIsInitialised(true)
      return
    }

    if (!isInputFocused) {
      if (changeOnBlur || (!changeOnBlur && inputEventType.current !== 'blur'))
        onChange(inputData)
      // hide cursor from input field
      inputRef.current.blur()
      if (inputData.customValue) inputRef.current.focus()
    }
  }, [isInputFocused])

  const setIsInputFocused = useCallback(
    (isInputFocusedInner, event) => {
      inputEventType.current = event?.type
      setIsInputFocusedInternal(isInputFocusedInner)
    },
    [isInputFocused]
  )

  return [
    inputRef,
    inputData,
    changeInputData,
    isInputFocused,
    setIsInputFocused,
  ]
}

export default useInput
