import React from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ClaimModal = ({
  contactData,
  className,
  setModalActive,
  setModalEditActive,
  onContinueClick,
}) => (
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
        value={contactData.email}
        onClick={() => setModalEditActive(true)}
        className={classNames.use(styles.claimCardGroup, styles.inputPointer)}
        statusIcon="#pencil"
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
        id="name"
        type="name"
        name="text"
        label="Name"
        value={contactData.name}
        disabled
        placeholder="How would you like to be called?"
        onClick={() => setModalEditActive(true)}
      />
    </Modal.Content>
    <Modal.Footer className={styles.footer}>
      <Button onClick={onContinueClick} variant="contained">
        Continue
      </Button>
      <a href="https://dashboard.core.ac.uk/">Login dashboard</a>
    </Modal.Footer>
  </Modal>
)

export default ClaimModal
