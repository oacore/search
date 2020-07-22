import React from 'react'
import { TextField, Button, Card } from '@oacore/design'

import styles from './styles.module.css'

import RegistrationLayout from 'modules/registration-layout'

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
      <RegistrationLayout>
        <Card.Title>Register new data provider</Card.Title>
        <form ref={ref} className={styles.form} onSubmit={handleSubmit}>
          <TextField
            id="data-provider-url"
            type="url"
            name="dataProviderUrl"
            label="Data provider URL"
            helper={helperMessage}
            placeholder="For example: oro.open.ac.uk"
            value={url}
            onChange={onUrlChange}
            variant={variant}
            statusIcon
            required
          />
          <div className={styles.submitSection}>
            <Button variant="contained" disabled={!isFormValid}>
              Continue
            </Button>
          </div>
        </form>
      </RegistrationLayout>
    )
  }
)
export default DataProviderPageTemplate
