import React from 'react'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import styles from './styles.module.css'
import YearSelectItem from './item'

import { observe, useStore } from 'store'

const YearSelects = observe(({ years, onSelect }: any) => {
  // what an observer read: the years (the store's suggestions, sorted and
  // written in place) and their values
  const { filters } = useStore()
  useStoreApi(
    filters,
    useShallow(() => [years, ...years, ...years.map((item: any) => item.value)])
  )
  const [minOptions, setMinOptions] = React.useState(years)
  const [maxOptions, setMaxOptions] = React.useState(years)

  const [selectedStartYear, setSelectedStartYear] = React.useState(0)
  const [selectedEndYear, setSelectedEndYear] = React.useState(0)

  const MIN_YEAR = Math.min.apply(
    null,
    years.map((item: any) => item.value)
  )

  const MAX_YEAR = Math.max.apply(
    null,
    years.map((item: any) => item.value)
  )
  React.useEffect(() => {
    setSelectedStartYear(MIN_YEAR)
    setSelectedEndYear(MAX_YEAR)
  }, [])

  const handleSelect = (start?: any, end?: any) => {
    if (start !== 0 && end !== 0) if (onSelect) onSelect([start, end + 1])
  }

  const setStartOptions = (selectedValue?: any) => {
    setMinOptions(
      years.map((item: any) => ({
        ...item,
        disabled: item.value > selectedValue,
      }))
    )

    setSelectedEndYear(selectedValue)
    handleSelect(selectedStartYear, selectedValue)
  }

  const setEndOptions = (selectedValue?: any) => {
    setMaxOptions(
      years.map((item: any) => ({
        ...item,
        disabled: item.value < selectedValue,
      }))
    )
    setSelectedStartYear(selectedValue)
    handleSelect(selectedValue, selectedEndYear)
  }

  return (
    <div className={styles['year-selects']}>
      <span className={styles.label}>from</span>
      <YearSelectItem
        onSelect={setEndOptions}
        options={minOptions.slice().sort((a: any, b: any) => a.value - b.value)}
      />
      <span className={styles.label}>to</span>
      <YearSelectItem
        onSelect={setStartOptions}
        options={maxOptions.slice().sort((a: any, b: any) => b.value - a.value)}
      />
    </div>
  )
})

export default YearSelects
