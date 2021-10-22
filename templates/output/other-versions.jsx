import React from 'react'
import { Card } from '@oacore/design/lib/elements'

import styles from './styles.module.css'
import CardDropdown from './card-dropdown'

const OtherVersions = ({ outputs }) => (
  <Card className={styles.boxes} variant="outlined">
    <Card.Title tag="h3">Other Versions</Card.Title>
    {outputs.map((output) => (
      <CardDropdown
        {...output}
        title={output.dataProvider.name}
        href={output.display}
        oai={output.identifiers.oai}
      />
    ))}
  </Card>
)
export default OtherVersions
