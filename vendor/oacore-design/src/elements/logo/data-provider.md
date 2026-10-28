Different sizes

```jsx
import DataProviderLogo from './data-provider';

<div style={{display:'flex',gap:'2rem'}}>
  <DataProviderLogo imageSrc="https://pbs.twimg.com/profile_images/1538797904525246464/EtgA0LqO_400x400.png" size='sm'/>
  <DataProviderLogo imageSrc="https://pbs.twimg.com/profile_images/1538797904525246464/EtgA0LqO_400x400.png" size='md'/>
  <DataProviderLogo imageSrc="https://pbs.twimg.com/profile_images/1538797904525246464/EtgA0LqO_400x400.png" size='lg'/>
</div>

```
Pass emptry string or anything for using default icon
```jsx
import DataProviderLogo from './data-provider';

<DataProviderLogo imageSrc=""/>
```
