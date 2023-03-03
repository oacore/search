import React, { useRef, useState, useEffect } from 'react'
import { Icon } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './sort.module.css'

import useOutsideClick from 'hooks/use-outside-click'
import FilterItem from 'modules/filters/filter-item'

const Sort = ({ options, onClick, className }) => {
  const [boxVisible, setBoxVisible] = useState(false)
  const [activeOption, setActiveOption] = useState()

  const node = useRef()

  const hideFilterBox = () => {
    setBoxVisible(false)
  }

  useOutsideClick(node, hideFilterBox)

  const onToggleBoxVisible = () => {
    setBoxVisible(!boxVisible)
  }

  const onHandleChange = (option) => {
    onClick(option)
    setActiveOption(option)
    hideFilterBox()
  }

  useEffect(() => {
    const activeItem = options.find((item) => item.checked === true) || {
      ...options[0],
      checked: true,
    }
    setActiveOption(activeItem)
  }, [options])

  return (
    <div className={classNames.use(styles.sort).join(className)} ref={node}>
      <div
        className={styles.sortBox}
        role="presentation"
        onClick={onToggleBoxVisible}
      >
        <span>
          Sort by{' '}
          <span className={styles.activeItem}>{activeOption?.value}</span>
        </span>
        <Icon className={styles.sortBoxIcon} src="#menu-down" />
      </div>
      {boxVisible && (
        <ul className={classNames.use(styles.sortBoxMenu)}>
          {options.map((filterItem) => (
            <FilterItem
              key={filterItem.value}
              value={filterItem.value}
              checkedIcon="#check"
              unCheckedIcon={null}
              item={filterItem}
              useActiveStyles
              onChangeFunction={onHandleChange}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default Sort
