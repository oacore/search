import { classNames } from '../../utils'
import styles from './loading-bar.css'

const LoadingBar = ({ className, fixed = false, tag: Tag = 'div' }) => (
  <Tag
    className={classNames
      .use(styles.loadingBar, fixed && styles.fixed)
      .join(className)}
  />
)

export default LoadingBar
