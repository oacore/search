import React from 'react'
import { Message } from '@oacore/design'

import styles from './finalisation.module.css'

import RegistrationLayout from 'modules/registration-layout'
import { withGlobalStore } from 'store'

const Finalisation = ({ store: { dataProvider } }) => (
  <RegistrationLayout>
    <Message className={styles.message} variant="success">
      Data provider {dataProvider.created?.oaiPmhUrl} has been successfully
      added to our DB. The harvesting process will start soon.
    </Message>
  </RegistrationLayout>
)

export default withGlobalStore(Finalisation)
