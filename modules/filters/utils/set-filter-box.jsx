import React from 'react'

import FilterItem from '../filter-box-item'
import LoadingBlock from '../loading-block'
import Search from '../search'
import YearFilter from '../year'

const setFilterBox = (label, filters, onChange, initialLoading) => {
  let component
  if (initialLoading) return <LoadingBlock />

  switch (label) {
    case 'year': {
      component = <YearFilter />
      break
    }

    default:
      component = (
        <>
          <Search />
          {filters.map((item) => (
            <FilterItem
              key={item.value}
              value={item.value}
              checkedIcon="#checkbox-marked"
              unCheckedIcon="#checkbox-blank-outline"
              item={item}
              onChangeFunction={onChange}
            />
          ))}
        </>
      )

      break
  }

  return component
}

export default setFilterBox
