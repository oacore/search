import Item from './item'
import styles from './styles.css'
import { classNames } from '../../utils'

const Brand = ({ children, className, tag = 'a', ...restProps }) => (
  <Item
    className={classNames.use('brand').from(styles).join(className)}
    {...restProps}
    tag={tag}
  >
    {children}
  </Item>
)

export default Brand
