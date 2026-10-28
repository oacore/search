import React, { useState, useRef } from 'react'

const useOptions = (
  children,
  { selectId, setIsInputFocused, setInputData }
) => {
  const selectMenuRef = useRef(null)
  const [activeOption, setActiveOption] = useState(null)
  // keep track on which element is currently clicked with onMouseDown event
  const [clickedElement, setClickedElement] = useState(null)

  const changeActiveOption = (option, { hide } = { hide: true }) => {
    setInputData({
      value: option.value,
      id: option.id,
      customValue: option.customValue,
    })
    setActiveOption(option)
    if (hide) {
      setIsInputFocused(false)
      setActiveOption(null)
    }

    if (option.customValue) {
      setActiveOption(null)
      setInputData({ ...option, value: '' })
    }
  }

  const options =
    React.Children.toArray(children)
      .filter((child) => child.type.displayName === 'SelectOption')
      .map((element) => {
        const overrideProps = {
          'id': `suggestion-result-${selectId}-${element.props.id}`,
          'value': element.props.value,
          'data-select-id': element.props.id,
          'onMouseDown': () => {
            // Firefox and Safari have relatedTarget null.
            // Therefore we cannot use onClick event
            // since it's not getting fired
            // because onBlur input listener cause rerender.
            setClickedElement(element.props.id)
          },
          'onMouseUp': (event) => {
            if (clickedElement === element.props.id) {
              changeActiveOption({
                value: element.props.value,
                id: element.props.id,
                customValue: element.props?.customValue || false,
              })
            }

            setClickedElement(null)
            event.stopPropagation()
          },
          'selected': element.props.id === activeOption?.id,
        }

        return React.cloneElement(element, {
          ...element.props,
          ...overrideProps,
        })
      }) || []

  const handleInputKeyEvent = (event) => {
    let pos =
      options.findIndex(
        (s) => s.props['data-select-id'] === activeOption?.id
      ) || options.length

    let direction = 1
    let suggestion = {}

    switch (event.key) {
      case 'Esc': // IE/Edge specific value
      case 'Escape':
        setIsInputFocused(false)
        break

      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        setIsInputFocused(false)
        break

      case 'Up': // IE/Edge specific value
      case 'ArrowUp':
      case 'Down': // IE/Edge specific value
      case 'ArrowDown':
        event.preventDefault()
        event.stopPropagation()
        if (options.length === 0) return

        if (activeOption == null) {
          // eslint-disable-next-line prefer-destructuring
          suggestion = options[0]
          changeActiveOption(
            {
              value: suggestion.props.value,
              id: suggestion.props['data-select-id'],
            },
            { hide: false }
          )
        } else {
          direction = ['ArrowDown', 'Down'].includes(event.key) ? 1 : -1
          pos = (pos + direction) % options.length
          suggestion = options[pos]
          changeActiveOption(
            {
              value: suggestion.props.value,
              id: suggestion.props['data-select-id'],
            },
            { hide: false }
          )
        }

        selectMenuRef.current
          .querySelector(
            `#suggestion-result-${selectId}-${suggestion.props['data-select-id']}`
          )
          .scrollIntoView(false)
        break
      default:
    }
  }

  const handleInputBlurEvent = (event, setVisibleAppendTextIcon) => {
    // check if onBlur happen within select
    const { relatedTarget: el } = event
    if (!el) {
      setClickedElement(null)
      setIsInputFocused(false, event)
      setVisibleAppendTextIcon(false)
    }

    if (
      clickedElement === null &&
      !(el && el.dataset.selectId === clickedElement)
    )
      setIsInputFocused(false, event)
  }

  return [
    selectMenuRef,
    options,
    activeOption,
    setClickedElement,
    handleInputKeyEvent,
    handleInputBlurEvent,
  ]
}

export default useOptions
