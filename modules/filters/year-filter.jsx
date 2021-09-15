import React, { useEffect } from 'react'

import Histoslider from '../histoslider'
import YearFilterItem from './year-filter-item'
import styles from './styles.module.css'

import { useStore, observe } from 'store'

const YearFilter = observe(() => {
  const [selection, setSelection] = React.useState(null)
  const { filters } = useStore()

  useEffect(() => {
    filters.setGroupedYearDates([2010, 2015, 2018])
  }, [])

  const onHistogramChange = (values) => {
    if (values !== null) {
      const selections = values.map((value) => Math.ceil(value))
      if (selections[0] === selections[1]) selections[0] = selections[1] - 1
      setSelection(selections)
    } else setSelection(values)
  }

  const yearsAxis = filters.activeFilterSuggestions
    .filter((item) => item.label !== 'unclassified')
    .map((item) => ({
      x0: item.label,
      x: item.label + 1,
      y: item.count,
    }))

  const onSelectActiveFilterItem = (selectedItem) => {
    if (selectedItem.label === 'unclassified') setSelection(null)
    else setSelection([selectedItem.yearFrom, 2019])
    filters.setActiveYearDate(selectedItem)
  }

  return (
    <>
      {filters.groupedYearDates.map((item) => (
        <YearFilterItem
          key={item.count}
          item={item}
          onSelectActiveFilterItem={onSelectActiveFilterItem}
        />
      ))}

      <div className={styles.yearFilter}>
        <Histoslider
          data={yearsAxis}
          selection={selection}
          className={styles.slider}
          padding={20}
          selectedBarColor="#EF8237"
          rangeColor="#b75400"
          unselectedColor="#E0E0E0"
          handleLabelFormat="0.7P"
          width={298}
          showLabels
          barPadding={2}
          selectFunc={onHistogramChange}
        />
      </div>
    </>
  )
})

export default YearFilter
