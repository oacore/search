import React, { useState } from 'react'
import { Card, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import ClaimModal from './claim-modal'
import LoginModal from './login-modal'
import styles from './styles.module.css'
import ClaimSuccessModal from './claim-success-modal'
import { fetchClaim } from 'api/claim'

export async function getClaim({params: routeParams}) {
  const data = {}
  const { id, setIsClaimSuccessModalActive } = routeParams

  try {
    const dataProvider = await fetchClaim(id)
    console.log(JSON.stringify(dataProvider)) //Debug
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
    [id]: true
  };

  return {
    props: { data },
  }
}

const ClaimCard = ({ name, id, className }) => {
  const [isClaimModalActive, setIsClaimModalActive] = useState(false)
  const [isLoginModalActive, setIsLoginModalActive] = useState(false)
  const [isClaimSuccessModalActive, setIsClaimSuccessModalActive] = useState(
    false
  )

  return (
    <Card className={classNames.use(styles.claimCard, className)}>
      <div>
        <b>Do you manage {name}?</b> Access insider analytics, issue reports and
        manage access to outputs from your repository in
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
            setModalActive={setIsClaimModalActive}
            onLoginClick={() => setIsLoginModalActive(true)}
            onContinueClick={() => getClaim({params:{id:id, setIsClaimSuccessModalActive}})}
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
