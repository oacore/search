import { Button, Icon } from '@oacore/design/lib/elements'
import React from 'react'

import styles from './styles.module.css'

const DATA_PROVIDERS_NAMES = [
  'arxiv.org',
  'pubmed',
  'publisher',
  'preprints',
  'crossref',
  'open',
]

const ActionBar = ({ outputs }) => (
  <div className={styles.actionBar}>
    {outputs.map(({ dataProvider, id, sourceFulltextUrls }) => {
      const name = dataProvider.name.split(' ')[0]

      return sourceFulltextUrls &&
        DATA_PROVIDERS_NAMES.includes(name.toLowerCase()) ? (
        <Button
          variant="outlined"
          className={styles.actionButton}
          tag="a"
          href={sourceFulltextUrls[0]}
          key={id}
        >
          View <span>on</span> {name} <Icon src="#open-in-new" />
        </Button>
      ) : null
    })}
  </div>
)

export default ActionBar
