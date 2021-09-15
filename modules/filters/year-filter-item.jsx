import React from 'react'
import { Icon } from '@oacore/design'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

const YearFilterItem = ({ item, onSelectActiveFilterItem }) => {
  const onToggleChecked = (e) => {
    e.preventDefault()
    onSelectActiveFilterItem(item)
  }

  const setIcon = () => (item.checked ? <Icon src="#check" /> : null)

  return (
    <li
      className={styles.filterBoxItem}
      onClick={onToggleChecked}
      role="presentation"
    >
      <input
        type="radio"
        name={item.yearFrom}
        id={item.yearFrom}
        checked={item.checked}
        value={item.yearFrom}
        onChange={onToggleChecked}
        className={styles.checkbox}
      />
      {setIcon()}
      <label htmlFor={item.yearFrom} className={styles.label}>
        <p
          className={classNames.use(styles.labelText, {
            [styles.labelTextActive]: item.checked,
          })}
        >
          {item.label ? item.label : `Since ${item.yearFrom}`}
        </p>
        <span>{item.count.toLocaleString('en-GB')}</span>
      </label>
    </li>
  )
}

export default YearFilterItem
