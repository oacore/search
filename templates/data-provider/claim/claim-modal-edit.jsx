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

  let contentTitle =
    'Enter the administrator email address and a few details to get invitation to the CORE Dashboard.'
  let rationaleHelper =
    'Since you changed email, we need to manually check you are the repository manager, additional information would be very apperciated.'

  if (isDataProviderHasAccounts) {
    contentTitle =
      'Enter the institutional email address and a few details to to get invitation to the CORE Dashboard.'
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
        Claim Repository Dashboard
      </Modal.Title>
      <Modal.Content tag="div">
        <p>{contentTitle}</p>
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
            </>
          }
        />
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
          label="Rationale"
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
