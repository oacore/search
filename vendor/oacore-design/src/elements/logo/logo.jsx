import { memo } from 'react'

import Icon from '../icon'
import styles from './logo.css'
import { classNames } from '../../utils'

const Logo = memo(
  ({
    children = 'CORE',
    className,
    src = '#core-symbol',
    alt = 'CORE',
    tag: Tag = 'span',
    ...restProps
  }) => (
    <Tag className={classNames.use(styles.logo).join(className)} {...restProps}>
      <Icon
        src={src}
        alt={alt}
        className={styles.logoIcon}
        width="18"
        height="24"
      />
      {children}
    </Tag>
  )
)

export default Logo
