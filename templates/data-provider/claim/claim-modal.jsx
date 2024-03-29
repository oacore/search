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

  const {
    value: rationale,
    element: contactRationale,
    bind: bindRationale,
    focus: focusRationale,
  } = useInput('', 'contactRationale')

  const handleSubmit = (evt) => {
    evt.preventDefault()

    const modalEdit = false
    if (nameFirst && emailFirst && rationale)
      onContinueClick({ nameFirst, emailFirst, modalEdit, rationale })
    else {
      focusEmailFirst()
      focusNameFirst()
      focusRationale()
    }
  }

  return (
    <Modal
      aria-labelledby="gain-access-modal-title"
      onClose={() => setModalActive(false)}
      className={classNames.use(className)}
    >
      <Modal.Title id="gain-access-modal-title">
        Create Repository Dashboard Account
      </Modal.Title>
      <Modal.Content tag="div">
        <p>
          To give you{' '}
          <span className={styles.backlightPrime}>instant access</span> to the
          Repository Dashboard, we need to verify that you have ownership of the
          repository by sending an email to the registered repository
          administrator.
        </p>
        <TextField
          id={contactEmailFirst}
          type="email"
          name={contactEmailFirst}
          label="Email"
          onClick={() => setModalEditActive(true)}
          className={classNames.use(
            styles.claimCardGroup,
            styles.inputPointer,
            styles.inputEmail
          )}
          statusIcon="#pencil"
          required
          placeholder="You need enter email."
          {...bindEmailFirst}
          helper={
            <>This address is listed as Admin Email in the OAI-PMH Identify.</>
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
        <br />
        <TextField
          id={contactRationale}
          type="text"
          name={contactRationale}
          label="Justification"
          placeholder="Why are you the authorised person to get access?"
          required
          {...bindRationale}
          helper={
            <>
              We will send an email with your justification to the registered
              repository manager of {contactData.name} to check that you are an
              authorised person to get access.
            </>
          }
        />
      </Modal.Content>
      <Modal.Footer className={styles.footer}>
        <Button onClick={handleSubmit} variant="contained">
          Continue
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default ClaimModal
