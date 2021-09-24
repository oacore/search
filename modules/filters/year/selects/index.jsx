import React from 'react'

import styles from './styles.module.css'
import YearSelectItem from './item'

import { sortItemsByNumberAsc, sortItemsByNumberDesc } from 'utils/sort'
import { observe } from 'store'

const YearSelects = observe(({ years }) => {
  const [minOptions, setMinOptions] = React.useState(
    sortItemsByNumberAsc(years, 'value')
  )
  const [maxOptions, setMaxOptions] = React.useState(
    sortItemsByNumberDesc(years, 'value')
  )

  const setFromOptions = (selectedValue) => {
    setMinOptions(
      years.map((item) => ({
        ...item,
        disabled: item.value > selectedValue,
      }))
    )
  }

  const setToOptions = (selectedValue) => {
    setMaxOptions(
      years.map((item) => ({
        ...item,
        disabled: item.value < selectedValue,
      }))
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
