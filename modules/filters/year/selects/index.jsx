import React from 'react'

import styles from './styles.module.css'
import YearSelectItem from './item'

import { observe } from 'store'

const YearSelects = observe(({ years }) => {
  const [minOptions, setMinOptions] = React.useState(years)
  const [maxOptions, setMaxOptions] = React.useState(years)

  const setFromOptions = (selectedValue) => {
    setMinOptions(
      years
        .map((item) => ({
          ...item,
          disabled: item.value > selectedValue,
        }))
        .sort((a, b) => b.value - a.value)
    )
  }

  const setToOptions = (selectedValue) => {
    setMaxOptions(
      years
        .map((item) => ({
          ...item,
          disabled: item.value < selectedValue,
        }))
        .sort((a, b) => b.value - a.value)
    )
  }

  return (
    <div className={styles.yearSelects}>
      <span className={styles.label}>from</span>
      <YearSelectItem options={minOptions} onSelect={setToOptions} />
      <span className={styles.label}>to</span>
      <YearSelectItem options={maxOptions} onSelect={setFromOptions} />
    </div>
  )
})

export default YearSelects
