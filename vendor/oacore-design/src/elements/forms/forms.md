Set of components for developing nice looking forms.

### Type

#### Text

Label before the input:

```jsx
import { Form } from '.';

<Form.Group>
  <Form.Label>Label</Form.Label>
  <Form.Control defaultValue="Hello" />
</Form.Group>
```

Label after the input:

```jsx
import { Form } from '.';

<Form.Group>
  <Form.Addon place="prepend">$</Form.Addon>
  <Form.Addon place="append">.00</Form.Addon>
  <Form.Control type="number" id="example-input-2" placeholder="e.g. 10" />
  <Form.Label htmlFor="example-input-2">Amount</Form.Label>
</Form.Group>
```

Input with a progress indicator:

```jsx
import ProgressSpinner from '../progress-spinner';
import { Form } from '.';

<Form.Group>
  <Form.Addon>
    <ProgressSpinner />
  </Form.Addon>
  <Form.Control type="text" id="example-input-3" placeholder="e.g. 10" />
  <Form.Label htmlFor="example-input-3">Amount</Form.Label>
</Form.Group>
```

#### Select

```jsx
import { Form } from '.';

<Form.Group>
  <Form.Control type="select" defaultValue="Lorem">
    <option>Lorem</option>
    <option>Ipsum</option>
  </Form.Control>
  <Form.Label>Label</Form.Label>
</Form.Group>
```

#### Textarea

```js
import { Form } from '.';

<Form.Group>
  <Form.Control type="textarea" placeholder="Hello world!" />
  <Form.Label>Label</Form.Label>
</Form.Group>
```
