import styles from './modal.css'
import { classNames } from '../../utils'

const ModalTitle = ({ children, className, tag: Tag = 'h1', ...restProps }) => (
  <Tag className={classNames.use(styles.title).join(className)} {...restProps}>
    {children}
  </Tag>
)

ModalTitle.displayName = 'ModalTitle'

export default ModalTitle
