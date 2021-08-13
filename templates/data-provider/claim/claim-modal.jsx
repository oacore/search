import React from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import useInput from '../hooks/use-input'
import styles from './styles.module.css'

const ClaimModal = ({
  contactData,
  className,
  setModalActive,
  setModalEditActive,
  onContinueClick,
}) => {

  const {
    value: email,
    element: contactEmail,
    bind: bindEmail,
    focus: focusEmail,
  } = useInput(contactData.name, 'contactEmail')

  const {
    value: name,
    element: contactName,
    bind: bindName,
    focus: focusName,
  } = useInput(contactData.name, 'contactName')

  const handleSubmit = (evt) => {
    evt.preventDefault()

    if (name && email) onContinueClick({ name, email })
    else {
      focusEmail()
      focusName()
    }
  }

  return (
    <Modal
      aria-labelledby="gain-access-modal-title"
      onClose={() => setModalActive(false)}
      className={classNames.use(className)}
    >
      <Modal.Title id="gain-access-modal-title">
        Gain access to CORE Dashboard
      </Modal.Title>
      <Modal.Content tag="div">
        <p>
          Enter the administrator email address and a few details to get
          invitation to the core Dashboard
        </p>
        <TextField
          id={contactEmail}
          type="email"
          name={contactEmail}
          label="Email"
          value={contactData.email}
          onClick={() => setModalEditActive(true)}
          className={classNames.use(styles.claimCardGroup, styles.inputPointer)}
          statusIcon="#pencil"
          {...bindEmail}
          helper={
            <>
              This address is listed as Admin Email in the OAI-PMH Identify.
              <br />
              You can use another email but the confirmation may take up a few
              days.
              <br />
            </>
          }
        />

        <TextField
          id={contactName}
          type="text"
          name={contactName}
          label="Name"
          value={contactData.name}
          placeholder="How would you like to be called?"
          {...bindName}
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

export default ClaimModal
