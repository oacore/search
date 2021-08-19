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
    value: emailFirst,
    element: contactEmailFirst,
    bind: bindEmailFirst,
    focus: focusEmailFirst,
  } = useInput(contactData.email, 'contactEmailFirst')

  const {
    value: nameFirst,
    element: contactNameFirst,
    bind: bindNameFirst,
    focus: focusNameFirst,
  } = useInput(contactData.name, 'contactNameFirst')

  const handleSubmit = (evt) => {
    evt.preventDefault()

    const modalEdit = false
    if (nameFirst && emailFirst)
      onContinueClick({ nameFirst, emailFirst, modalEdit })
    else {
      focusEmailFirst()
      focusNameFirst()
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
          id={contactEmailFirst}
          type="email"
          name={contactEmailFirst}
          label="Email"
          onClick={() => setModalEditActive(true)}
          className={classNames.use(styles.claimCardGroup, styles.inputPointer)}
          statusIcon="#pencil"
          required
          placeholder="You need enter email."
          {...bindEmailFirst}
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
          id={contactNameFirst}
          type="text"
          name={contactNameFirst}
          label="Name"
          placeholder="How would you like to be called?"
          {...bindNameFirst}
          required
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
