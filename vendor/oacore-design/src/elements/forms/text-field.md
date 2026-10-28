### Type variations

#### Text

```jsx
<TextField
  id="text-example"
  name="name"
  label="Full name"
  placeholder="e.g. John Doe"
/>
```



Example with a search input:

```jsx
<TextField
  id="search"
  type="search"
  name="search"
  label="Search"
  placeholder="Type to search..."
/>
```

Example with a password:

```jsx
<TextField
  id="login-password"
  type="password"
  name="password"
  minLength="8"
  label="Password"
  placeholder="🔒 Something secure"
  helper="Should be at least 8 characters length."
/>
```

### Size variations

#### Small

```jsx
<TextField
  label="Name"
  placeholder="e.g. John Doe"
  size="small"
/>
```

#### Large

```jsx
<TextField
  label="Name"
  placeholder="e.g. John Doe"
  size="large"
/>
```

### Label and colour variations

#### Pure

A TextField without a visible label. The label remains accessible to
screen-readers.

```jsx
<TextField
  id="example-pure"
  label="Name"
  name="name"
  variant="pure"
  placeholder="e.g. John Doe"
  autoComplete="name"
/>
```

#### Focus

Example `focus` variant (label on top):

```jsx
<TextField
  variant="focus"
  id="example-focus"
  name="name"
  label="Name"
  placeholder="e.g. John Doe"
/>
```

#### Progress

Example with progress icon:

```jsx
<TextField
  id="example-success-1"
  name="user-name"
  label="User name"
  defaultValue="john"
  helper="Checking username availability"
  variant="progress"
  statusIcon
/>
```

#### Success

Example with success message:

```jsx
<TextField
  id="example-success-2"
  name="user-name"
  label="User name"
  defaultValue="john"
  helper="Nice to meet you john!"
  variant="success"
  statusIcon
/>
```

#### Error

Example with error message:

```jsx
<TextField
  id="example-error"
  name="user-name"
  label="User name"
  placeholder="e.g. john"
  helper="User name is required"
  variant="error"
  statusIcon
/>
```

Example with disabled input:

```jsx
<TextField
  id="disabled-input"
  name="disabled-input"
  label="Disabled input"
  defaultValue="Disabled input"
  variant="success"
  disabled
/>
```
