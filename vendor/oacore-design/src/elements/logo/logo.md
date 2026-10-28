# CORE logo

### Logo without interaction
```jsx
<Logo>Design</Logo>
```

### Logo as a hyperlink

```jsx
import Link from '../link';
import Logo from './logo';

<>
    <Link href="/">
      <Logo>Design</Logo>
    </Link>
    <br/>
    <br/>
    <Logo tag="a" href="/">Dashboard</Logo>
</>
```

### Logo as a button

```jsx
import Button from '../button';
import Logo from './logo';

<>
    <Button>
      <Logo>Design</Logo>
    </Button>
    <br/>
    <br/>
    <Logo tag="button">Dashboard</Logo>
</>
```
