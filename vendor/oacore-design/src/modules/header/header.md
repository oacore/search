### Header without search field
Simple example of universal header without search bar.

```js
<div style={{ minHeight: '40rem' }}>
  <Header id="example-header-1" />
</div>
```

### Header with a search field
Complex example of universal header with search bar.
In order to use search bar you need to wrap your whole application
with `DesignProvider`. It's just a simple React context so we can
configure search bar outside of layout.

For configuration we use `Header.useSearchBar({...})` hook. Bear in mind that
this hook should be used once per page. For the Next.js apps this hook should
be ideally used within `pages` folder.

**NOTE**: The search bar is not prerendered on the server side

**NOTE**: We want firstly use search icon and hide input in all out pages. But if you want show input just add option {isHidden: false to your configuration}


Please for more info see example code below:

```
import DesignProvider from '../../context';

const HeaderWithSearchBar = () => {    
    const options = [
      {id: 1, icon: '#magnify', value: 'Option A' },
      {id: 2, icon: '#magnify', value: 'Option B' },
      {id: 3, icon: '#magnify', value: 'Option C' },
      {id: 4, icon: '#magnify', value: 'Option D' },
      {id: 5, icon: '#magnify', value: 'Option E' },
      {id: 6, icon: '#magnify', value: 'Option F' },
      {id: 7, value: 'Option G (without icon)' },
    ]

    Header.useSearchBar({
        onQueryChanged: () => {},
        initQuery: '',
        suggestionsDelay: 0,
        searchBarProps: {
          label: 'Search',
          placeholder: 'e.g. repository or journal name',
          prependIcon: '#magnify',
        },
        getSuggestions: (term) => options.slice(0, Math.max(0, options.length - term.length))
    })

    return (
        <div style={{ minHeight: '20rem' }}>
          <Header id="example-header-2" />
        </div>
    )
}

<DesignProvider>
  <HeaderWithSearchBar />
</DesignProvider>
```
