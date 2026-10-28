import Table from './table'
import Head from './head'
import HeadCell from './head-cell'
import Body from './body'
import Row from './row'
import Cell from './cell'
import Footer from './footer'

Table.Head = Head
Table.HeadCell = HeadCell
Table.Body = Body
Table.Row = Row
Table.Cell = Cell
Table.Footer = Footer

export default Table
export {
  Head as TableHead,
  HeadCell as TableHeadCell,
  Body as TableBody,
  Row as TableRow,
  Cell as TableCell,
  Footer as TableFooter,
}
