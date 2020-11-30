import { classNames } from '@oacore/design/lib/utils'
import { MetadataList } from '@oacore/design'
import React from 'react'

import styles from './styles.module.css'

const Chip = ({ children, className, variant = 'text', ...htmlProps }) => (
  <span
    className={classNames.use(
      styles.chip,
      variant === 'contained' && styles.contained,
      className
    )}
    {...htmlProps}
  >
    {children}
  </span>
)

const Chips = () => (
  <MetadataList className={styles.chipsList}>
    <MetadataList.Item
      id="publication-type"
      label="Publication type"
      className={styles.chipsItem}
    >
      <Chip variant="contained" style={{ marginRight: '0.5rem' }}>
        Proceedings article
      </Chip>
    </MetadataList.Item>
    <MetadataList.Item id="doi" label="DOI" className={styles.chipsItem}>
      <Chip>10.1145/2910896.2925448</Chip>
    </MetadataList.Item>
  </MetadataList>
)

export default Chips
