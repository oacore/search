import React from 'react'

import styles from './styles.module.css'

import AppBarItem from 'modules/app-bar-item'
import Select from 'modules/app-bar-select'

const options = [
  { id: 1, icon: '#magnify', value: 'Option A' },
  { id: 2, icon: '#magnify', value: 'Option B' },
  { id: 3, icon: '#magnify', value: 'Option C' },
  { id: 4, icon: '#magnify', value: 'Option D' },
  { id: 5, icon: '#magnify', value: 'Option E' },
  { id: 6, icon: '#magnify', value: 'Option F' },
]

const DataProvidersSelect = () => {
  const [suggestions, setSuggestions] = React.useState(options)
  const [value, setValue] = React.useState(null)

  const handleOnChange = () => {
    // trigger search here
  }

  const handleOnInput = (data) => {
    // if id doesn't exists it means user type own text
    // and didn't use suggestion
    if (!data.id) {
      setSuggestions(
        options.slice(
          0,
          Math.max(0, options.length - (data.value?.length || 0))
        )
      )
    }

    setValue(data.value)
  }

  return (
    <AppBarItem className={styles.item}>
      <Select
        id="data-providers-select"
        value={value}
        label="Search data providers"
        variant="pure"
        onChange={handleOnChange}
        onInput={handleOnInput}
        placeholder="e.g. repository or journal name"
        prependIcon="#magnify"
        className={styles.search}
      >
        {suggestions.map((el) => (
          <Select.Option key={el.id} id={el.id} value={el.value} icon={el.icon}>
            {el.value}
          </Select.Option>
        ))}
      </Select>
    </AppBarItem>
  )
}

export default DataProvidersSelect
