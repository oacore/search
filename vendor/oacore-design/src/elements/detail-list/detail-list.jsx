import { memo } from 'react'

import styles from './detail-list.css'
import { classNames } from '../../utils'

const DetailList = memo(({ children, className, ...passProps }) => (
  <ul
    className={classNames.use(styles.container).join(className)}
    {...passProps}
  >
    {children}
  </ul>
))

const DetailItem = memo(({ name, className, children, ...passProps }) => (
  <li className={classNames.use([styles.item]).join(className)} {...passProps}>
    <div className={styles.header}>{name}</div>
    <div className={styles.content}>{children}</div>
  </li>
))

DetailList.Item = DetailItem

export default DetailList
