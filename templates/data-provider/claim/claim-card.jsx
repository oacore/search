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
  const { id, setIsClaimSuccessModalActive, name, email, rationale } =
    claimParams

  try {
    const dataProvider = await fetchClaim({ id, name, email, rationale })
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(dataProvider)) // Debug
    setIsClaimSuccessModalActive(true)
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
  const [isClaimModalActive, setIsClaimModalActive] = useState(false)
  const [isClaimModalEditActive, setIsClaimModalEditActive] = useState(false)
  const [isLoginModalActive, setIsLoginModalActive] = useState(false)
  const [isClaimSuccessModalActive, setIsClaimSuccessModalActive] =
    useState(false)

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
        <Button className={styles.claimCardAction} disabled>
          More details
        </Button>
        {isClaimModalActive && (
          <ClaimModal
            contactData={contactData}
            setModalActive={setIsClaimModalActive}
            setModalEditActive={setIsClaimModalEditActive}
            onContinueClick={() =>
              getClaim({ params: { id, setIsClaimSuccessModalActive } })
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
                params: { id, setIsClaimSuccessModalActive, ...options },
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
            setModalActive={setIsClaimSuccessModalActive}
            onClose={() => {
              if (isClaimModalActive) setIsClaimModalActive(false)
              if (isClaimModalEditActive) setIsClaimModalEditActive(false)
              if (isLoginModalActive) setIsLoginModalActive(false)
              if (isClaimSuccessModalActive) setIsClaimSuccessModalActive(false)
            }}
          />
        )}
      </div>
    </Card>
  )
}

export default ClaimCard
