import styles from './modal.css'
import { classNames } from '../../utils'

const ModalFooter = ({
  children,
  className,
  tag: Tag = 'footer',
  ...passProps
}) => (
  <Tag className={classNames.use(styles.footer).join(className)} {...passProps}>
    {children}
  </Tag>
)

export default ModalFooter
