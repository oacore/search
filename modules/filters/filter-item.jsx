import React from 'react'
import { Icon } from '@oacore/design'

import styles from './styles.module.css'

import { useStore, observe } from 'store'

const FilterItem = observe(({ item }) => {
  const { filters } = useStore()

  const onToggleChecked = (e) => {
    e.preventDefault()

    filters.toggleCheckboxFilter(item)
  }

  const setIcon = () =>
    item.checked ? (
      <Icon src="#checkbox-marked" />
    ) : (
      <Icon src="#checkbox-blank-outline" />
    )

  return (
    <li
      className={styles.filterBoxItem}
      onClick={onToggleChecked}
      role="presentation"
    >
      <input
        type="checkbox"
        name={item.label}
        id={item.label}
        checked={item.checked}
        onChange={onToggleChecked}
        className={styles.checkbox}
      />
      {setIcon()}
      <label htmlFor={item.label} className={styles.label}>
        <p className={styles.labelText}>{item.label}</p>
        <span>{item.count.toLocaleString('en-GB')}</span>
      </label>
    </li>
  )
})

export default FilterItem
