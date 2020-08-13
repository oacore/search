import React from 'react'
import dynamic from 'next/dynamic'
import { ProgressSpinner } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Map = dynamic(() => import('./map'), {
  ssr: false,
  loading: () => <ProgressSpinner className={styles.loader} />,
})

const RepositoriesMap = React.memo(
  ({ className, tag: Tag = 'div', ...passProps }) => (
    <Tag className={classNames.use(styles.container).join(className)}>
      <Map {...passProps} />
    </Tag>
  )
)

export default RepositoriesMap
