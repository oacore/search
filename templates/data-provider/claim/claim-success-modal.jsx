import React from 'react'
import { Modal, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ClaimSuccessModal = ({
  className,
  setClaimModalActive,
  setClaimModalEditActive,
  setLoginModalActive,
  setModalActive,
  onClose,
  newEmail,
  contactData,
}) => (
  <Modal
    aria-label="Claim success modal"
    onClose={() => {
      setClaimModalActive(false)
      setClaimModalEditActive(false)
      setLoginModalActive(false)
      setModalActive(false)
    }}
    className={classNames.use(styles.modal, className)}
  >
    <Modal.Title>Claim CORE Dashboard</Modal.Title>
    <Modal.Content tag="div" className={styles.successModalContent}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        className={
          newEmail ? styles.successImageCheck : styles.successImageInvitation
        }
      >
        <image
          href={
            newEmail
              ? '/static/claim-dashboard-success-check.svg'
              : '/static/claim-dashboard-success-invitation.svg'
          }
        />
      </svg>
      {newEmail ? (
        <p>
          We will check your eligibility to claim the repository and contact you
          at <b>{newEmail}</b>. It may take a few business days.
        </p>
      ) : (
        <p>
          We sent you the invitation to join CORE Dashboard to{' '}
          <b>{contactData.email}</b>. Please, check your inbox and follow the
          link to continue.
        </p>
      )}
    </Modal.Content>
    <Modal.Footer className={styles.footer}>
      <Button onClick={onClose} variant="contained">
        Close
      </Button>
    </Modal.Footer>
  </Modal>
)

export default ClaimSuccessModal
