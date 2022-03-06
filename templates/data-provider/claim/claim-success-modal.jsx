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
    <Modal.Title>Create Repository Dashboard Account</Modal.Title>
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
          We sent your request to the registered repository manager for
          approval. You will be contacted at <b> {contactData.email}</b> as soon
          repository manager approves your request.{' '}
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
            We will now check your eligibility for a Repository Dashboard
            Account and contact you at <b>{newEmail}</b>. It may take a few
            business days.
          </p>
        ) : (
          <p>
            We sent the invitation to join Repository Dashboard to{' '}
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
