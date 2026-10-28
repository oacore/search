## Accessible icon

Provide alternative text in `alt` prop for tech assistive user's accessibility.

The component will add a `arial-label` to inlined SVG element,
so screen readers will be able to read it.

```jsx
<button type="button">
  <Icon src="#check" alt="OK" />
</button>
```

## Meaningless icon

Add `aria-hidden` attribute for meaningless icons like in the following
example.

```jsx
<button type="button">
  <Icon src="#check" aria-hidden />
  OK
</button>
```

## Test icon in sprite
```jsx
<Icon src="#ab-testing" aria-hidden />
```
