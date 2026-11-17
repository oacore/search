import React from 'react'
import { Icon } from '@oacore/design'

import styles from './styles.module.css'

const Keywords = ({ tags = [], tag: Tag = 'div', ...htmlProps }: any) => (
  <Tag {...htmlProps}>
    {tags && tags.length > 0 && (
      <Icon src="#tag" alt="" className={styles['keywords-icon']} />
    )}
    <ul className={styles['keywords-list']}>
      {tags.map((k: any) => (
        <li key={k}>
          <a
            href={`//core.ac.uk/search?q=${k}`}
            target="_blank"
            rel="noreferrer"
          >
            {k}
          </a>
        </li>
      ))}
    </ul>
  </Tag>
)

export default Keywords
