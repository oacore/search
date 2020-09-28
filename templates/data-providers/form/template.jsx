import React from 'react'
import { TextField, Button, Card } from '@oacore/design'

import styles from './styles.module.css'

import Title from 'modules/title'

const DataProviderPageTemplate = React.forwardRef(
  ({ url, onSubmit, onUrlChange, message, isFormValid = false }, ref) => {
    const handleSubmit = (event) => {
      event.preventDefault()
      if (onSubmit) onSubmit(event)
    }

    return (
      <Card className={styles.layout}>
        <Title tag={Card.Title}>Register new data provider</Title>
        <form ref={ref} className={styles.form} onSubmit={handleSubmit}>
          <TextField
            id="data-provider-url"
            type="url"
            name="dataProviderUrl"
            label="Data provider URL"
            helper={message.helper}
            placeholder="For example, https://oro.open.ac.uk"
            value={url}
            onChange={onUrlChange}
            variant={message.variant}
            statusIcon
            required
          />
          <div className={styles.submitSection}>
            <Button
              title={message?.finishButtonTitle}
              type="submit"
              variant="contained"
              disabled={!isFormValid}
            >
              Finish
            </Button>
          </div>
        </form>
      </Card>
    )
  }
)
export default DataProviderPageTemplate
