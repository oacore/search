import React, { useState } from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ClaimModal = ({
  className,
  setModalActive,
  onLoginClick,
  onContinueClick,
}) => {
  const [name, setName] = useState('')
  return (
    <Modal
      aria-labelledby="gain-access-modal-title"
      onClose={() => setModalActive(false)}
      className={classNames.use(styles.modal, className)}
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
          id="email"
          type="email"
          name="email"
          label="Email"
          value="library-research-support@open.ac.uk"
          disabled
          helper={
            <>
              This address is listed as Admin Email in the OAI-PMH Identify.
              <br />
              You can use another email but the confirmation may take up a few
              days.
            </>
          }
        />
        <TextField
          id="name"
          type="name"
          name="text"
          label="Name"
          disabled
          placeholder="How would you like to be called?"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Modal.Content>
      <Modal.Footer className={styles.footer}>
        <Button onClick={onContinueClick} variant="contained">
          Continue
        </Button>
        <Button onClick={onLoginClick}>Login</Button>
      </Modal.Footer>
    </Modal>
  )
}
export default ClaimModal
