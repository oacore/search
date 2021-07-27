import React from 'react'
import { Icon } from '@oacore/design'

import styles from './styles.module.css'

import topics from 'utils/topics'

const Keywords = ({
  title,
  similarOutputs,
  tag: Tag = 'div',
  ...htmlProps
}) => (
  <Tag {...htmlProps}>
    <Icon src="#tag" alt="" className={styles.keywordsIcon} />
    <ul className={styles.keywordsList}>
      {topics(title, similarOutputs).map((k) => (
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
