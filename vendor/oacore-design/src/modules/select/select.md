#### Select with dynamic options (icons included)

```jsx
    import Select from './index'
    import Icon from '../../elements/icon'

    const options = [
      {id: 1, icon: '#magnify', value: 'Option A' },
      {id: 2, icon: '#magnify', value: 'Option B' },
      {id: 3, icon: '#magnify', value: 'Option C' },
      {id: 4, icon: '#magnify', value: 'Option D' },
      {id: 5, icon: '#magnify', value: 'Option E' },
      {id: 6, icon: '#magnify', value: 'Option F' },
      {id: 7, icon: '#magnify', value: 'Other',customValue:true},
      {id: 8, value: 'Option G (without icon)' },
    ]

    const SelectExample = () => {
        const [suggestions, setSuggestions] = React.useState(options)
        const [value, setValue] = React.useState('')

        const handleOnChange = (data) => {          
          // trigger search here
        }

        const handleOnInput = (data) => { 
          // if id doesn't exists it means user type own text and didn't use suggestion
          if(!data.id) {
            setSuggestions(options.slice(0, Math.max(0, options.length - data.value.length)))
          }
          setValue(data.value)
        }

        return (
          <div style={{minHeight: '25rem'}}>
            <Select
              id="select-1"
              value={value}
              label="Search"
              onChange={handleOnChange}
              onInput={handleOnInput}
              placeholder="e.g. article title or author name"
              prependIcon="#magnify"
            >
                {suggestions.map((el) => (
                  <Select.Option
                    key={el.id}
                    id={el.id}
                    value={el.value}
                    icon={el.icon}
                    customValue={el.customValue}
                  >
                    {el.value}
                  </Select.Option>
                ))}
            </Select>
          </div>
        )
    }
    <SelectExample />
```

#### Select with dynamic options (without icons)

```jsx
    import Select from './index'
    import Icon from '../../elements/icon'

    const options = [
      {id: 1, value: 'Option A' },
      {id: 2, value: 'Option B' },
      {id: 3, value: 'Option C' },
      {id: 4, value: 'Option D' },
      {id: 5, value: 'Option E' },
      {id: 6, value: 'Option F' },
      {id: 7, icon: '#magnify', value: 'Option G (with icon)' },
    ]

    const SelectExample = () => {
        const [suggestions, setSuggestions] = React.useState(options)
        const [value, setValue] = React.useState('')

        const handleOnChange = (data) => {          
          // trigger search here
        }

        const handleOnInput = (data) => { 
          // if id doesn't exists it means user type own text and didn't use suggestion
          if(!data.id) {
            setSuggestions(options.slice(0, Math.max(0, options.length - data.value.length)))
          }
          setValue(data.value)
        }

        return (
          <div style={{minHeight: '25rem'}}>
            <Select
              id="select-2"
              value={value}
              label="Search"
              onChange={handleOnChange}
              onInput={handleOnInput}
              placeholder="e.g. article title or author name"
              variant="pure"
              changeOnBlur={false}
            >
                {suggestions.map((el) => (
                  <Select.Option
                    key={el.id}
                    id={el.id}
                    value={el.value}
                    icon={el.icon}
                  >
                    {el.value}
                  </Select.Option>
                ))}
                {value !== '' && (
                  <Select.Option
                    key={8}
                    id={8}
                    value={value}
                    icon="#magnify"
                  >
                    {`All results for "${value}"`}
                  </Select.Option>
                )}
            </Select>
          </div>
        )
    }
    <SelectExample />
```

