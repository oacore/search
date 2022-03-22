import React from 'react'

import FilterItem from '../filter-item'
import Search from '../search'
import YearFilter from '../year'

const setFilterBox = (label, filters, onChange) => {
  let component
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
              key={
                `${item.value}-${item.count}` || `${item.code}-${item.count}`
              }
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
