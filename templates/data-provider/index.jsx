import React from 'react'
import { TextField, Button } from '@oacore/design'

import styles from './styles.module.css'

import RegistrationLayout from 'modules/registration-layout'

const DataProviderPageTemplate = () => {
  const handleChange = () => {}
  const handleSubmit = (event) => {
    event.preventDefault()
    // API call here probably
  }

  return (
    <RegistrationLayout>
      <form onChange={handleChange} onSubmit={handleSubmit}>
        <TextField
          id="data-provider-url"
          type="text"
          name="dataProviderUrl"
          label="Data provider URL"
          helper="It can be any URL: homepage address, any data resource address, OAI-PMH endpoint or RIOXX endpoint"
          placeholder="For example: oro.open.ac.uk"
        />
        <div className={styles.submitSection}>
          <Button variant="contained" disabled>
            Continue
          </Button>
        </div>
      </form>
    </RegistrationLayout>
  )
}
export default DataProviderPageTemplate
