import React from 'react'
import { Modal, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import successCheckSVG from './images/modal/check.svg'
import successCheckInvitationSVG from './images/modal/invitation.svg'
import styles from './styles.module.css'

const ClaimSuccessModal = ({
  className,
  setClaimModalActive,
  setClaimModalEditActive,
  isDataProviderHasAccounts,
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
      setModalActive(false)
    }}
    className={classNames.use(styles.modal, className)}
  >
    <Modal.Title>Claim Repository Dashboard</Modal.Title>
    {isDataProviderHasAccounts ? (
      <Modal.Content tag="div" className={styles.successModalContent}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          className={styles.successImageCheck}
        >
          <image href={successCheckSVG} />
        </svg>
        <p>
          You request sent to the repository manager. Your eligibility to claim
          the repository will be checked and you will be contacted at
          <b> {contactData.email}</b>. It may take a few business days.{' '}
        </p>
      </Modal.Content>
    ) : (
      <Modal.Content tag="div" className={styles.successModalContent}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          className={
            newEmail ? styles.successImageInvitation : styles.successImageCheck
          }
        >
          <image
            href={newEmail ? successCheckInvitationSVG : successCheckSVG}
          />
        </svg>
        {newEmail ? (
          <p>
            We will check your eligibility to claim the repository and contact
            you at <b>{newEmail}</b>. It may take a few business days.
          </p>
        ) : (
          <p>
            We sent you the invitation to join CORE Dashboard to{' '}
            <b>{contactData.email}</b>. Please, check your inbox and follow the
            link to continue.
          </p>
        )}
      </Modal.Content>
    )}
    <Modal.Footer className={styles.footerClose}>
      <Button onClick={onClose} variant="contained">
        Close
      </Button>
    </Modal.Footer>
  </Modal>
)

export default ClaimSuccessModal
