import React, { useRef } from 'react'
import { Icon } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './sort.module.css'

import FilterItem from 'modules/filters/filter-box-item'
import useOutsideClick from 'hooks/use-outside-click'

const Sort = ({ options, onClick, className }) => {
  const [boxVisible, setBoxVisible] = React.useState(false)

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
    hideFilterBox()
  }

  const activeItem = options.find((item) => item.checked === true)

  return (
    <div className={classNames.use(styles.sort).join(className)} ref={node}>
      <div
        className={styles.sortBox}
        role="presentation"
        onClick={onToggleBoxVisible}
      >
        <p>
          Sort by <span className={styles.activeItem}>{activeItem.value}</span>
        </p>
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
