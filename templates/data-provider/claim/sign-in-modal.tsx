// Deprecated
// Use dashboard.core.ac.uk
import React from 'react'
import { Modal, Button, TextField } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import useInput from '../hooks/use-input'
import styles from './styles.module.css'

const SignInModal = ({ className, setModalActive, onSignInClick }) => {
  const {
    value: userEmail,
    element: elemUserEmail,
    bind: bindUserEmail,
    focus: focusUserEmail,
  } = useInput('', 'elemUserEmail')
  const {
    value: password,
    element: elemPassword,
    bind: bindPassword,
    focus: focusPassword,
  } = useInput('', 'elemPassword')

  const handleSubmit = (evt) => {
    evt.preventDefault()

    if (userEmail && password) onSignInClick({ userEmail, password })
    else {
      focusUserEmail()
      focusPassword()
    }
  }

  return (
    <Modal
      aria-labelledby="login-to-dashboard-modal"
      onClose={() => setModalActive(false)}
      className={classNames.use(styles.modalSignIn, className)}
    >
      <Modal.Title id="login-to-dashboard-modal">Sign in</Modal.Title>
      <Modal.Content tag="div">
        <p />
        Sign in Repository Dashboard to see all analytical information and much
        more. <p />
        <TextField
          id={elemUserEmail}
          type="email"
          name={elemUserEmail}
          label="Email"
          {...bindUserEmail}
          required
          placeholder="Enter the email."
          helper={
            <>
              <br />
            </>
          }
        />
        <TextField
          id={elemPassword}
          type="password"
          name={elemPassword}
          label="Password"
          {...bindPassword}
          required
          placeholder="Enter the password."
          helper={
            <>
              <br />
            </>
          }
        />
      </Modal.Content>
      <Modal.Footer className={styles.footer}>
        <Button onClick={handleSubmit} variant="contained">
          Sign in
        </Button>
        <a href="https://dashboard.core.ac.uk/reset">Forgotten password?</a>
      </Modal.Footer>
    </Modal>
  )
}

export default SignInModal
