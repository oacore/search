import React from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import useInput from '../hooks/use-input'
import styles from './styles.module.css'

const ClaimModalEdit = (props) => {
  const { contactData, setModalEditActive, onContinueClick, className } = props
  const { value: name, bind: bindName } = useInput(contactData.name)
  const { value: email, bind: bindEmail } = useInput(contactData.email)
  const { value: rationale, bind: bindRationale, focus} = useInput('')

  const handleSubmit = (evt) => {
    evt.preventDefault()

    if (name && email && rationale) {
      onContinueClick({ name, email, rationale })
    } else {
      focus('contactEmail')
      focus('contactName')
      focus('rationale')
    }
  }

  return (
    <Modal
      aria-labelledby="gain-access-modal-title"
      onClose={() => setModalEditActive(false)}
      className={classNames.use(styles.modal, className)}
    >
      <Modal.Title id="gain-access-modal-title">
        Claim CORE Dashboard
      </Modal.Title>
      <Modal.Content tag="div">
        <p>
          Enter the administrator email address and a few details to to get
          invitation to the CORE Dashboard.
        </p>
        <TextField
          id="contactEmail"
          type="email"
          name="contactEmail"
          label="Email"
          placeholder="You need enter email."
          required
          {...bindEmail}
          className={classNames.use(styles.claimCardGroup)}
          helper={<>Your institutional email address.</>}
        />
        <TextField
          id="contactName"
          type="text"
          name="contactName"
          label="Name"
          placeholder="How would you like to be called?"
          required
          {...bindName}
          helper={<br />}
        />
        <TextField
          id="rationale"
          type="text"
          name="rationale"
          label="Rationale"
          placeholder="Why are you the authorised person to get access?"
          required
          {...bindRationale}
          helper={
            <>
              Since you changed email, we need to manually check you are the
              repository manager, additional information would be very
              apperciated.
            </>
          }
        />
      </Modal.Content>
      <Modal.Footer className={styles.footer}>
        <Button onClick={handleSubmit} variant="contained">
          Continue
        </Button>
        <a href="https://dashboard.core.ac.uk/">Login dashboard</a>
      </Modal.Footer>
    </Modal>
  )
}

export default ClaimModalEdit