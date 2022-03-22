import React from 'react'

import styles from './styles.module.css'
import YearSelectItem from './item'

import { observe } from 'store'

const YearSelects = observe(({ years, onSelect }) => {
  const [minOptions, setMinOptions] = React.useState(years)
  const [maxOptions, setMaxOptions] = React.useState(years)

  const [selectedStartYear, setSelectedStartYear] = React.useState(0)
  const [selectedEndYear, setSelectedEndYear] = React.useState(0)

  const MIN_YEAR = Math.min.apply(
    null,
    years.map((item) => item.value)
  )

  const MAX_YEAR = Math.max.apply(
    null,
    years.map((item) => item.value)
  )
  React.useEffect(() => {
    setSelectedStartYear(MIN_YEAR)
    setSelectedEndYear(MAX_YEAR)
  }, [])

  const handleSelect = (start, end) => {
    if (start !== 0 && end !== 0) if (onSelect) onSelect([start, end + 1])
  }

  const setStartOptions = (selectedValue) => {
    setMinOptions(
      years.map((item) => ({
        ...item,
        disabled: item.value > selectedValue,
      }))
    )

    setSelectedEndYear(selectedValue)
    handleSelect(selectedStartYear, selectedValue)
  }

  const setEndOptions = (selectedValue) => {
    setMaxOptions(
      years.map((item) => ({
        ...item,
        disabled: item.value < selectedValue,
      }))
    )
    setSelectedStartYear(selectedValue)
    handleSelect(selectedValue, selectedEndYear)
  }

  return (
    <div className={styles.yearSelects}>
      <span className={styles.label}>from</span>
      <YearSelectItem
        onSelect={setEndOptions}
        options={minOptions.slice().sort((a, b) => a.value - b.value)}
      />
      <span className={styles.label}>to</span>
      <YearSelectItem
        onSelect={setStartOptions}
        options={maxOptions.slice().sort((a, b) => b.value - a.value)}
      />
    </div>
  )
})

export default YearSelects
