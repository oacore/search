import React from 'react'
import { TextField, Button, Card } from '@oacore/design'

import styles from './styles.module.css'

const AddDataProviderForm = React.forwardRef(
  (
    { url, onSubmit, onUrlChange, message, setShowForm, isFormValid = false },
    ref
  ) => {
    const handleSubmit = (event) => {
      event.preventDefault()
      if (onSubmit) onSubmit(event)
    }

    return (
      <Card className={styles.addDataProviderCard}>
        <h3>Suggest a new data provider</h3>
        <form ref={ref} onSubmit={handleSubmit}>
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
            <Button
              type="button"
              variant="outlined"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    )
  }
)
export default AddDataProviderForm
