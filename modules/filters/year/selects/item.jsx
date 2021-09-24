import React from 'react'

import styles from './styles.module.css'

// import { observe } from 'store'

const YearSelectItem = ({ options, onSelect }) => {
  const [value, setValue] = React.useState()

  const handleChange = (e) => {
    // console.log(e.target.value)
    setValue(e.target.value)
    onSelect(e.target.value)
  }

  return (
    <select value={value} onChange={handleChange} className={styles.select}>
      {options.map((item) => (
        <option value={item.value} key={item.value} disabled={item.disabled}>
          {item.value}
        </option>
      ))}
    </select>
  )
}

export default YearSelectItem
