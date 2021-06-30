import React, { useState } from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ClaimModalEdit = ({
  className,
  setModalEditActive,
  onLoginClick,
  onContinueClick,
}) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rationable, setRationable] = useState('')
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
          id="email"
          type="email"
          name="email"
          label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={classNames.use(styles.claimCardGroup)}
          helper={<>Your institutional email address.</>}
        />
        <TextField
          id="name"
          type="text"
          name="name"
          label="Name"
          placeholder="How would you like to be called?"
          value={name}
          onChange={(event) => setName(event.target.value)}
          helper={<br />}
        />
        <TextField
          id="rationable"
          type="text"
          name="rationable"
          label="Rationable"
          placeholder="Why are you the authorised person to get access?"
          value={rationable}
          onChange={(event) => setRationable(event.target.value)}
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
        <Button onClick={onContinueClick} variant="contained">
          Continue
        </Button>
        <Button onClick={onLoginClick}>Login dashboard</Button>
      </Modal.Footer>
    </Modal>
  )
}
export default ClaimModalEdit
