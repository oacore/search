import React, { useState } from 'react'
import { Card, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import ClaimModal from './claim-modal'
import ClaimModalEdit from './claim-modal-edit'
import LoginModal from './login-modal'
import styles from './styles.module.css'
import ClaimSuccessModal from './claim-success-modal'
import fetchClaim from '../../../api/claim'

export async function getClaim({ params: claimParams }) {
  const data = {}
  const {
    id,
    setIsClaimSuccessModalActive,
    setNewEmail,
    name,
    email,
    rationale,
  } = claimParams

  try {
    const dataProvider = await fetchClaim({ id, name, email, rationale })
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(dataProvider)) // Debug
    setIsClaimSuccessModalActive(true)
    setNewEmail(email)
  } catch (errorWithDataProvider) {
    return {
      props: {
        error: errorWithDataProvider,
      },
      notFound: true,
    }
  }

  data.is_claim = {
    [id]: true,
  }

  return {
    props: { data },
  }
}

const ClaimCard = ({ nameDataProvider, id, className, contactData }) => {
  const testDataProviderId = 86 // dev
  if (id !== testDataProviderId) return <></> // dev

  const [isClaimModalActive, setIsClaimModalActive] = useState(false)
  const [isClaimModalEditActive, setIsClaimModalEditActive] = useState(false)
  const [isLoginModalActive, setIsLoginModalActive] = useState(false)
  const [isClaimSuccessModalActive, setIsClaimSuccessModalActive] =
    useState(false)
  const [newEmail, setNewEmail] = useState(false)

  return (
    <Card className={classNames.use(styles.claimCard, className)}>
      <div>
        <b>Do you manage {nameDataProvider}?</b> Access insider analytics, issue
        reports and manage access to outputs from your repository in
        the&nbsp;CORE&nbsp;Dashboard!&nbsp;
        <span aria-hidden="true" role="img">
          👇
        </span>
      </div>
      <div className={styles.claimCardActions}>
        <Button
          variant="contained"
          className={styles.claimCardAction}
          onClick={() => setIsClaimModalActive(true)}
        >
          Gain access now
        </Button>
        <Button
          className={styles.claimCardAction}
          onClick={() => {
            window.location.href = `https://core.ac.uk/services/repository-dashboard`
          }}
        >
          More details
        </Button>
        {isClaimModalActive && (
          <ClaimModal
            contactData={contactData}
            setModalActive={setIsClaimModalActive}
            setModalEditActive={setIsClaimModalEditActive}
            onContinueClick={() =>
              getClaim({
                params: { id, setIsClaimSuccessModalActive, setNewEmail },
              })
            }
            className={
              (isLoginModalActive || isClaimSuccessModalActive) && styles.hide
            }
          />
        )}

        {isClaimModalEditActive && (
          <ClaimModalEdit
            contactData={contactData}
            setModalEditActive={setIsClaimModalEditActive}
            onContinueClick={(options) =>
              getClaim({
                params: {
                  id,
                  setIsClaimSuccessModalActive,
                  setNewEmail,
                  ...options,
                },
              })
            }
            className={
              (isLoginModalActive || isClaimSuccessModalActive) && styles.hide
            }
          />
        )}
        {isLoginModalActive && (
          <LoginModal setModalActive={setIsLoginModalActive} />
        )}
        {isClaimSuccessModalActive && (
          <ClaimSuccessModal
            isModalActive={isClaimSuccessModalActive}
            setClaimModalActive={setIsClaimModalActive}
            setClaimModalEditActive={setIsClaimModalEditActive}
            setLoginModalActive={setIsLoginModalActive}
            setModalActive={setIsClaimSuccessModalActive}
            onClose={() => {
              if (isClaimModalActive) setIsClaimModalActive(false)
              if (isClaimModalEditActive) setIsClaimModalEditActive(false)
              if (isLoginModalActive) setIsLoginModalActive(false)
              if (isClaimSuccessModalActive) setIsClaimSuccessModalActive(false)
            }}
            newEmail={newEmail}
            contactData={contactData}
          />
        )}
      </div>
    </Card>
  )
}

export default ClaimCard
