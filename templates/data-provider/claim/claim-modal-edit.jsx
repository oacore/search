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
    'Since you changed email, we need to manually check that you are the repository manager, additional information would be very appreciated.'

  if (isDataProviderHasAccounts)
    rationaleHelper = `We will send an email with your justification to the registered repository manager of ${contactData.name} to check that you are an authorised person to get access.`

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
        Create Repository Dashboard Account
      </Modal.Title>
      <Modal.Content tag="div">
        {isDataProviderHasAccounts ? (
          <p>
            Enter the institutional email address and a few details to get
            invitation to the CORE Dashboard.
          </p>
        ) : (
          <p>
            To give you{' '}
            <span className={styles.backlightPrime}>instant access</span> to
            Repository Dashboard, we need to verify that you have ownership of
            of the repository by sending an email to the registered repository
            administrator.
          </p>
        )}
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
            isDataProviderHasAccounts ? 'Your institutional email address.' : ''
          }
        />
        {isDataProviderHasAccounts ? (
          ''
        ) : (
          <div className={styles.helper}>
            If there is no registered repository adminstrator email or you do
            not have have access to the the registered email address, then you
            can change the email address. However, this means that a{' '}
            <span className={styles.backlightPrime}>manual verification</span>{' '}
            process will be used and it might take a few days to give you
            access.
          </div>
        )}
        <TextField
          id={contactName}
          type="text"
          name={contactName}
          label="Name"
          placeholder="How would you like to be called?"
          required
          {...bindName}
          className={classNames.use(styles.claimCardGroup)}
          helper={<> </>}
        />
        <TextField
          id={contactRationale}
          type="text"
          name={contactRationale}
          label="Justification"
          placeholder="Why are you the authorised person to get access?"
          required
          {...bindRationale}
          helper={<>{rationaleHelper}</>}
        />
      </Modal.Content>
      <Modal.Footer className={styles.footer}>
        {isDataProviderHasAccounts ? (
          ''
        ) : (
          <Button onClick={handleBackSubmit} className={styles.buttonRevers}>
            Back
          </Button>
        )}
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
