import styles from './modal.css'
import { classNames } from '../../utils'

const ModalContent = ({
  children,
  className,
  tag: Tag = 'div',
  ...passProps
}) => (
  <Tag
    className={classNames.use(styles.content).join(className)}
    {...passProps}
  >
    {children}
  </Tag>
)

export default ModalContent
