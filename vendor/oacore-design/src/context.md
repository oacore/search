### Design Provider


DesignProvider is component which provides context to design library. 
It should wrap the whole application. Currently, it's not required to use.
At the moment we use it just for
[SearchBar in Header](/#/Modules/Header?id=header-1#header-with-a-search-field).
If you don't need SearchBar feel free to omit it.

**NOTE**: The usage may change in the future. Please refer to changelog for 
more details.

```
import DesignProvider from './context';
const App = () => <div>My application with design provider</div>;

<DesignProvider>
    <App />
</DesignProvider>

```
