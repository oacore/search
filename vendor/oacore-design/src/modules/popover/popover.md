```jsx

import TextField from '../../elements/forms/text-field';
import Button from "../../elements/button";


<div
  style={{
    margin: '5rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridGap: '0.5rem',
    gridAutoRows: 'min-content',
  }}
>
  <Popover
    placement="top"
    content="I am a simple tooltip with placement='top'"
  >
    <Button variant="outlined" style={{ width: '100%' }}>
      Top
    </Button>
  </Popover>
  <Popover
    placement="top-start"
    trigger="click"
    content={
      <ul>
        <li>
          <code>placement</code> top-start
        </li>
        <li>
          <code>trigger</code> click
        </li>
      </ul>
    }
  >
    <Button variant="outlined" style={{ width: '100%' }}>
      top-start
    </Button>
  </Popover>
  <Popover
    placement="top-end"
    interactive
    content={
      <TextField
        id="text-example"
        name="name"
        label="Full name"
        placeholder="e.g. John Doe"
      />
    }
  >
    <Button variant="outlined" style={{ width: '100%' }}>
      top-end
    </Button>
  </Popover>
  <Popover placement="right" content="Hi I am a tooltip message">
    <Button tag={Button} variant="outlined" style={{ width: '100%' }}>
      right
    </Button>
  </Popover>
  <Popover placement="right-start" content="Hi I am a tooltip message">
    <Button variant="outlined" style={{ width: '100%' }}>
      right-start
    </Button>
  </Popover>
  <Popover placement="right-end" content="Hi I am a tooltip message">
    <Button variant="outlined" style={{ width: '100%' }}>
      right-end
    </Button>
  </Popover>
  <Popover placement="left" content="Hi I am a tooltip message">
    <Button variant="outlined" style={{ width: '100%' }}>
      left
    </Button>
  </Popover>
  <Popover placement="left-start" content="Hi I am a tooltip message">
    <Button variant="outlined" style={{ width: '100%' }}>
      left-start
    </Button>
  </Popover>
  <Popover placement="left-end" content="Hi I am a tooltip message">
    <Button
      variant="outlined"
      style={{ width: '100%' }}
    >
      left-end
    </Button>
  </Popover>
  <Popover placement="bottom" content="i I am a tooltip message">
    <Button variant="outlined" style={{ width: '100%' }}>
      bottom
    </Button>
  </Popover>
  <Popover placement="bottom-start" content="Hi I am a tooltip message">
    <Button variant="outlined" style={{ width: '100%' }}>
      bottom-start
    </Button>
  </Popover>
  <Popover placement="bottom-end" content="Hi I am a tooltip message">
    <Button variant="outlined" style={{ width: '100%' }}>
      bottom-end
    </Button>
  </Popover>
</div>
```
