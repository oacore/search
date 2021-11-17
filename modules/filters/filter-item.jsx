import React from 'react'
import { Icon } from '@oacore/design/lib'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

const FilterItem = ({
  value,
  checkedIcon,
  unCheckedIcon,
  item,
  useActiveStyles,
  onChangeFunction,
}) => {
  const onToggleChecked = (e) => {
    e.preventDefault()
    onChangeFunction(item)
  }

  // eslint-disable-next-line consistent-return
  const setIcon = () => {
    if (item.checked) return <Icon src={checkedIcon} />
    if (unCheckedIcon) return <Icon src={unCheckedIcon} />
  }

  return (
    <li
      className={classNames.use(styles.filterBoxItem, {
        [styles.filterBoxItemActive]: useActiveStyles && item.checked,
        [styles.disabled]: item.count === 0,
      })}
      onClick={onToggleChecked}
      role="presentation"
    >
      <input
        type="radio"
        name={value}
        id={value}
        checked={item.checked}
        onChange={onToggleChecked}
        className={styles.checkbox}
      />
      {setIcon()}
      <label htmlFor={value} className={styles.label}>
        <p className={styles.labelText}>
          {item.yearFrom ? `Since ${item.yearFrom}` : value}
        </p>
        <span>{item.count && item.count.toLocaleString('en-GB')}</span>
      </label>
    </li>
  )
}

export default FilterItem
