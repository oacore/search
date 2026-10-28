### Indeterminate

Indicates infinite loading.

```jsx
<ProgressSpinner />
```

### Controlled

Indicates the actual progress value.

```jsx
import { useEffect, useRef, useState } from 'react'
import Button from '../button';

const AnimatedProgress = () => {
  const timeoutRef = useRef(null)
  
  const [value, setValue] = useState(0)
  const maxValue = 100
  
  useEffect(() => {
    if (value < maxValue) {
      timeoutRef.current = setTimeout(() => {
        setValue(value + 1)
      }, 20)
    }
    
    return () => clearTimeout(timeoutRef.current)
  }, [value])

  return (
    <>
      <p>
        <ProgressSpinner
          value={value}
          max={maxValue}
          style={{ marginRight: '0.5rem' }}
        />
        Loading...
      </p>
      <Button variant="contained" onClick={() => { setValue(0) }} disabled={value < maxValue}>
        Restart
      </Button>
    </>
  )
}

<AnimatedProgress />
```
