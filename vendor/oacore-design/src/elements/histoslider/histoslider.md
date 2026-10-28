#### Custom Histoslider(Slider with histograms)

```jsx
    import Histoslider from './index'
    

    const data = [
     {
        x0: 0,    // Start of the bucket
        x: 1,     // End of the bucket
        y: 100    // Value
      },
      {
        x0: 1,    // Start of the bucket
        x: 2,     // End of the bucket
        y: 120    // Value
      },
      {
        x0: 2,    // Start of the bucket
        x: 3,     // End of the bucket
        y: 140    // Value
      },
    ]

    const HistosliderExample = () => {
        const [selection, setSelection] = React.useState(null)
        

        const onHistogramChange = (values) => {
          const selections = values.map((value) => Math.ceil(value))
          if (selections[0] === selections[1]) selections[0] = selections[1] - 1
          if (selections[0] > selections[1]) selections.reverse()
          setSelection(selections)
        }

        return (
          <div style={{minHeight: '25rem'}}>
            <Histoslider
              data={data}
              selection={selection}
              selectFunc={onHistogramChange}
            />
          </div>
        )
    }
    <HistosliderExample />
```
