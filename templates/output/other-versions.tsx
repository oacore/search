import React from 'react'
import { Card } from '@oacore/design/lib/elements'

import styles from './styles.module.css'
import CardDropdown from './card-dropdown'

const OtherVersions = ({ outputs, metadata, useOtherVersions }) => (
  <Card className={styles.boxes} variant="outlined">
    <Card.Title className={styles.versionTitle} tag="h3">
      Available Versions
    </Card.Title>
    {outputs.map((output) => (
      <CardDropdown
        {...output}
        dataProviderId={output.dataProvider.id}
        image={output.dataProvider.url}
        title={output.dataProvider.name}
        href={output.display}
        oai={output.identifiers.oai}
        key={output.id}
        useOtherVersions={useOtherVersions}
        worksOai
        outputRedirect
        metadata={metadata}
      />
    ))}
  </Card>
)
export default OtherVersions
