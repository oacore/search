import React from 'react'
import { TextField, Button, Card } from '@oacore/design'

import styles from './styles.module.css'

const DataProviderPageTemplate = React.forwardRef(
  (
    { url, onSubmit, onUrlChange, helperMessage, variant, isFormValid = false },
    ref
  ) => {
    const handleSubmit = (event) => {
      event.preventDefault()
      if (onSubmit) onSubmit(event)
    }

    return (
      <Card className={styles.layout}>
        <Card.Title>Register new data provider</Card.Title>
        <form ref={ref} className={styles.form} onSubmit={handleSubmit}>
          <TextField
            id="data-provider-url"
            type="url"
            name="dataProviderUrl"
            label="Data provider URL"
            helper={helperMessage}
            placeholder="For example, https://oro.open.ac.uk"
            value={url}
            onChange={onUrlChange}
            variant={variant}
            statusIcon
            required
          />
          <div className={styles.submitSection}>
            <Button variant="contained" disabled={!isFormValid}>
              Done
            </Button>
          </div>
        </form>
      </Card>
    )
  }
)
export default DataProviderPageTemplate
