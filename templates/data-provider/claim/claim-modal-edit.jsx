import React from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import useInput from '../hooks/use-input'
import styles from './styles.module.css'

const ClaimModalEdit = (props) => {
  const {
    contactData,
    setModalEditActive,
    onLoginClick,
    onContinueClick,
    className,
  } = props

  const { value: name, bind: bindName } = useInput(contactData.name)
  const { value: email, bind: bindEmail } = useInput(contactData.email)
  const { value: rationable, bind: bindRationable } = useInput('')

  const handleSubmit = (evt) => {
    evt.preventDefault()
    if (name && email && rationable)
      onContinueClick({ name, email, rationable })
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
          id="email"
          type="email"
          name="email"
          label="Email"
          required
          {...bindEmail}
          className={classNames.use(styles.claimCardGroup)}
          helper={<>Your institutional email address.</>}
        />
        <TextField
          id="name"
          type="text"
          name="name"
          label="Name"
          placeholder="How would you like to be called?"
          required
          {...bindName}
          helper={<br />}
        />
        <TextField
          id="rationable"
          type="text"
          name="rationable"
          label="Rationable"
          placeholder="Why are you the authorised person to get access?"
          required
          {...bindRationable}
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
        <Button onClick={onLoginClick}>Login dashboard</Button>
      </Modal.Footer>
    </Modal>
  )
}

export default ClaimModalEdit
