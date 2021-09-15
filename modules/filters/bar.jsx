import React, { useEffect } from 'react'

import styles from './styles.module.css'
import FilterBarItem from './bar-item'

import { observe, useStore } from 'store'
import FILTERS from 'store/dummy'

const FiltersBar = observe(() => {
  const { filters } = useStore()

  useEffect(() => {
    filters.setData(FILTERS)
  }, [])

  return (
    <ul className={styles.bar}>
      {filters.data.map((filter) => (
        <FilterBarItem key={filter.id} filter={filter} />
      ))}
    </ul>
  )
})

export default FiltersBar
