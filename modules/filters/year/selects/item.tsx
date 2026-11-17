import React from 'react'

import styles from './styles.module.css'

const YearSelectItem = ({ options, onSelect }: any) => {
  const [value, setValue] = React.useState()

  const handleChange = (e?: any) => {
    setValue(e.target.value)
    onSelect(e.target.value)
  }

  return (
    <select value={value} onChange={handleChange} className={styles.select}>
      {options.map((item: any) => (
        <option value={item.value} key={item.value} disabled={item.disabled}>
          {item.value}
        </option>
      ))}
    </select>
  )
}

export default YearSelectItem
