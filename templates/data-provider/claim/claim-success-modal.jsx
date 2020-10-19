import React from 'react'
import { Modal, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ClaimSuccessModal = ({ className, setModalActive, onClose }) => (
  <Modal
    aria-label="Claim success modal"
    onClose={() => setModalActive(false)}
    className={classNames.use(styles.modal, className)}
  >
    <Modal.Title>Claim CORE Dashboard</Modal.Title>
    <Modal.Content tag="div" className={styles.successModalContent}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        className={styles.successImage}
      >
        <image href="/static/claim-dashboard-success.svg" />
      </svg>
      <p>
        We sent you the invitation to join CORE Dashboard to <b>email</b>.
        Please, check your inbox and follow the lint to continue.
      </p>
    </Modal.Content>
    <Modal.Footer className={styles.footer}>
      <Button onClick={onClose} variant="contained">
        Close
      </Button>
    </Modal.Footer>
  </Modal>
)

export default ClaimSuccessModal
