```jsx
import Table from '.';

<Table>
  <Table.Head>
    <Table.Row>
      <Table.HeadCell>1 - not sortable</Table.HeadCell>
      <Table.HeadCell order="any">2 - sortable</Table.HeadCell>
      <Table.HeadCell order="asc" onClick={() => {}}>3 - sorted asc</Table.HeadCell>
      <Table.HeadCell order="desc">4 - sorted desc</Table.HeadCell>
    </Table.Row>
  </Table.Head>
  <Table.Body>
    <Table.Row key={2}>
      <Table.Cell>Value 1-1</Table.Cell>
      <Table.Cell>Value 1-2</Table.Cell>
      <Table.Cell>Value 1-3</Table.Cell>
      <Table.Cell>Value 1-4</Table.Cell>
    </Table.Row>
    <Table.Row key={3}>
      <Table.Cell>Value 2-1</Table.Cell>
      <Table.Cell>Value 2-2</Table.Cell>
      <Table.Cell>Value 2-3</Table.Cell>
      <Table.Cell>Value 2-4</Table.Cell>
    </Table.Row>
    <Table.Row key={4}>
      <Table.Cell>Value 3-1</Table.Cell>
      <Table.Cell>Value 3-2</Table.Cell>
      <Table.Cell>Value 3-3</Table.Cell>
      <Table.Cell>Value 3-4</Table.Cell>
    </Table.Row> 
  </Table.Body>
  <Table.Footer>
    <Table.Row>
      <Table.Cell colSpan={4}>Showing 1-3 of 3</Table.Cell>
    </Table.Row>
  </Table.Footer>
</Table>
```
