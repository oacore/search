import React from 'react'
import { Modal, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const LoginModal = ({ className, setModalActive }) => (
  <Modal
    aria-labelledby="login-to-dashboard-modal"
    onClose={() => setModalActive(false)}
    className={classNames.use(styles.modal, className)}
  >
    <Modal.Title id="login-to-dashboard-modal">
      Login into CORE Dashboard
    </Modal.Title>
    <Modal.Content tag="div" />
    <Modal.Footer className={styles.footer}>
      <Button onClick={() => {}} variant="contained">
        Log in
      </Button>
      <Button onClick={() => {}}>Register</Button>
    </Modal.Footer>
  </Modal>
)

export default LoginModal
