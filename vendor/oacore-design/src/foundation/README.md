## Headings

### Application headings

This set of headings are useful when you need it for applications,
where content is dense and you basically need small headings.

```jsx
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>
<h4>Heading 4</h4>
<h5>Heading 5</h5>
<h6>Heading 6</h6>
```

### Display headings

For pages where headings should take attention, e.g. landing pages, you can
easily turn headings to display mode using `display` class.

```jsx
<h1 class="display">Display Heading 1</h1>
<h2 class="display">Display Heading 2</h2>
<h3 class="display">Display Heading 3</h3>
<h4 class="display">Display Heading 4</h4>
<h5 class="display">Display Heading 5</h5>
<h6 class="display">Display Heading 6</h6>
```

However, if you are not going to mix heading sizes, you can turn **all**
headings to display mode in more easy way just adding `display` class
to a parent element.

```jsx
<div className="display">
  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <h3>Heading 3</h3>
  <h4>Heading 4</h4>
  <h5>Heading 5</h5>
  <h6>Heading 6</h6>
</div>
```

## Loading states 🧪

**Experimental** loading states.

We support loading animation out of the box based on the `aria-busy` attribute.
Despite this could have been applied using classes, we think utilising
`aria-*` attribute will also improve the base level of the accessibility.

### Enabling loading

Loading state can be applied either to the element directly:

```jsx
<h2 aria-busy="true" title="Loading"></h2>
<p aria-busy="true" title="Loading"></p>
```

or to the parent element:

```jsx
<div aria-busy="true" title="Loading">
  <h2></h2>
  <p></p>
  <p>Already loaded paragraph in spite of not-loaded next one 👇</p>
  <p></p>
</div>
```

Note, that even if the `aria-busy` is applied either to the element directly,
to the parent, or to both, no loading animation is show but the content
is rendered in a normal way. Such behaviour is required to apply
loading to the parent only but safely display already loaded content.

Note, applying `aria-busy` to the parent changes cursor in this element
what may look confusing to the user if the content is loaded partially.

### Multi-line paragraphs and headings

You can have **up to 5 lines of text** in headings or paragraphs in the loading
state. To achieve this use `data-loading-count`.

The `data-loading-count` attribute does not work if `aria-busy="true"`
is not applied.

Despite headings support up to 5 lines of text, it's not recommended to make
headings longer than 2 lines.

```jsx
<div aria-busy="true" title="Loading">
  <h2 data-line-count="2"></h2>
  <p data-line-count="5"></p>
</div>
```

### Lists, tables

List support is under consideration.

### Inline elements

Inline elements are not supported yet.
