import React from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import useInput from '../hooks/use-input'
import styles from './styles.module.css'

const ClaimModalEdit = (props) => {
  const {
    contactData,
    setModalActive,
    setModalEditActive,
    isDataProviderHasAccounts,
    onContinueClick,
    className,
  } = props
  const {
    value: name,
    element: contactName,
    bind: bindName,
    focus: focusName,
  } = useInput('', 'contactName')

  const {
    value: email,
    element: contactEmail,
    bind: bindEmail,
    focus: focusEmail,
  } = useInput(contactData.email, 'contactEmail')

  const {
    value: rationale,
    element: contactRationale,
    bind: bindRationale,
    focus: focusRationale,
  } = useInput('', 'contactRationale')

  const handleBackSubmit = (evt) => {
    evt.preventDefault()
    setModalEditActive(false)
  }

  const handleSubmit = (evt) => {
    evt.preventDefault()

    // eslint-disable-next-line prefer-const
    let modalEdit = true
    if (name && email && rationale)
      onContinueClick({ name, email, rationale, modalEdit })
    else {
      focusName()
      focusEmail()
      focusRationale()
    }
  }

  let rationaleHelper =
    'Since you changed email, we need to manually check you are the repository manager, additional information would be very apperciated.'

  if (isDataProviderHasAccounts) {
    rationaleHelper =
      'Repository manager will manually check you are the authorised person to get access, additional information would be very apperciated.'
  }

  return (
    <Modal
      aria-labelledby="gain-access-modal-title"
      onClose={() => {
        setModalActive(false)
        setModalEditActive(false)
      }}
      className={classNames.use(styles.modal, className)}
    >
      <Modal.Title id="gain-access-modal-title">
        Claim CORE Dashboard
      </Modal.Title>
      <Modal.Content tag="div">
        <p>
          Enter the administrator email address and a few details to get
          invitation to the CORE Dashboard.
        </p>
        <TextField
          id={contactEmail}
          type="email"
          name={contactEmail}
          label="Email"
          placeholder="You need enter email."
          required
          {...bindEmail}
          className={classNames.use(styles.claimCardGroup)}
          helper={
            <>
              Your institutional email address. <br />
              <br />
            </>
          }
        />
        <TextField
          id={contactName}
          type="text"
          name={contactName}
          placeholder="How would you like to be called?"
          required
          {...bindName}
          className={classNames.use(styles.claimCardGroup)}
          helper={
            <>
              <span className={styles.label}>Name</span>
              <br />
            </>
          }
        />
        <TextField
          id={contactRationale}
          type="text"
          name={contactRationale}
          placeholder="Why are you the authorised person to get access?"
          required
          {...bindRationale}
          helper={
            <>
              <span className={styles.label}>Rationale</span> {rationaleHelper}
            </>
          }
        />
      </Modal.Content>
      <Modal.Footer className={styles.footer}>
        <Button onClick={handleBackSubmit} className={styles.buttonRevers}>
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          className={styles.continue}
        >
          Continue
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default ClaimModalEdit
