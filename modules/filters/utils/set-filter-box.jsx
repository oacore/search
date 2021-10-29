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

    case 'sort by': {
      component = filters.map((item) => (
        <FilterItem
          key={item.value}
          value={item.value}
          checkedIcon="#check"
          unCheckedIcon={null}
          item={item}
          onChangeFunction={onChange}
          useActiveStyles
        />
      ))
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
