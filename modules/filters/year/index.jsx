import React, { useEffect } from 'react'

import styles from '../styles.module.css'
import FilterItem from '../filter-item'

import { useStore, observe } from 'store'
import Histoslider from 'modules/histoslider'
import useHistogram from 'modules/histoslider/use-histogram'

const YearFilter = observe(() => {
  const { filters } = useStore()

  const { selection, setSelection, onHistogramChange } = useHistogram

  useEffect(() => {
    filters.setGroupedYearDates([2010, 2015, 2018])
  }, [])

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
        <FilterItem
          key={item.count}
          name={item.yearFrom}
          checkedIcon="#check"
          unCheckedIcon={null}
          item={item}
          onChangeFunction={onSelectActiveFilterItem}
          activeLabelClassName={item.checked && [styles.labelTextActive]}
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
