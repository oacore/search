### Switch Component

### Prefer use with useSwitch hook
```jsx

  import {useSwitch} from '../../hooks';

  const Demo = () =>{
    const {isActivated, toggleChange} = useSwitch();

    return (
      <Switch
          id="toggle-switch"
          isActivated={isActivated}
          onChange={toggleChange}
          label={
            isActivated
              ? 'Active'
              : 'Disabled'
          }
        />
    )
  }

  <Demo/>
```
