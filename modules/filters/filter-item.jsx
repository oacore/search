import React from 'react'
import { Icon } from '@oacore/design/lib'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

const FilterItem = ({
  name,
  checkedIcon,
  unCheckedIcon,
  item,
  activeLabelClassName = '',
  onChangeFunction,
}) => {
  const onToggleChecked = (e) => {
    e.preventDefault()
    onChangeFunction(item)
  }

  const setIcon = () =>
    item.checked ? <Icon src={checkedIcon} /> : <Icon src={unCheckedIcon} />

  return (
    <li
      className={styles.filterBoxItem}
      onClick={onToggleChecked}
      role="presentation"
    >
      <input
        type="radio"
        name={name}
        id={name}
        checked={item.checked}
        onChange={onToggleChecked}
        className={styles.checkbox}
      />
      {setIcon()}
      <label htmlFor={name} className={styles.label}>
        <p
          className={classNames
            .use(styles.labelText)
            .join(activeLabelClassName)}
        >
          {item.label ? item.label : `Since ${name}`}
        </p>
        <span>{item.count.toLocaleString('en-GB')}</span>
      </label>
    </li>
  )
}

export default FilterItem
