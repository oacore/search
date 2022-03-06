/* eslint-disable prefer-const */
import React, { useState } from 'react'
import { Card, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import ClaimModal from './claim-modal'
import ClaimModalEdit from './claim-modal-edit'
import styles from './styles.module.css'
import ClaimSuccessModal from './claim-success-modal'
import fetchClaim from '../../../api/claim'
import fetchDataProviderAccounts from '../../../api/data-provider-accounts'

export async function getClaim({ params: claimParams }) {
  const data = {}
  let {
    id,
    setIsClaimSuccessModalActive,
    setNewEmail,
    isDataProviderHasAccounts,
    name,
    email,
    rationale,
    nameFirst,
    emailFirst,
    modalEdit,
  } = claimParams

  try {
    if (modalEdit) setNewEmail(email)
    else {
      email = emailFirst
      name = nameFirst
      setNewEmail('')
    }

    const dataProvider = await fetchClaim({
      id,
      name,
      email,
      rationale,
      isDataProviderHasAccounts,
    })
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

export async function getDataProviderAccounts({ params }) {
  const data = {}
  let { id, setIsDataProviderHasAccounts } = params
  try {
    const dataProviderAccounts = await fetchDataProviderAccounts({ id })

    if (dataProviderAccounts.length > 0) setIsDataProviderHasAccounts(true)
    data.accounts = {
      [id]: dataProviderAccounts,
    }
  } catch (errorWithDataProvider) {
    return {
      props: {
        error: errorWithDataProvider,
      },
      notFound: true,
    }
  }

  return {
    props: { data },
  }
}

const ClaimCard = ({ nameDataProvider, id, className, contactData }) => {
  const [isClaimModalActive, setIsClaimModalActive] = useState(false)
  const [isClaimModalEditActive, setIsClaimModalEditActive] = useState(false)
  const [isSignInModalActive, setIsSignInModalActive] = useState(false)
  const [isClaimSuccessModalActive, setIsClaimSuccessModalActive] =
    useState(false)
  const [isDataProviderHasAccounts, setIsDataProviderHasAccounts] =
    useState(false)
  const [newEmail, setNewEmail] = useState(false)

  getDataProviderAccounts({
    params: { id, setIsDataProviderHasAccounts },
  })

  return (
    <Card className={classNames.use(styles.claimCard, className)}>
      <div className={classNames.use(styles.cardTitle)}>
        Access Repository Dashboard
      </div>
      <div>
        Do you manage {nameDataProvider}? Access insider analytics, issue
        reports and manage access to outputs from your repository in the CORE
        Repository Dashboard!{' '}
        <a
          href="https://core.ac.uk/services/repository-dashboard"
          target="_blank"
          rel="noreferrer"
          className={styles.linkUnderline}
        >
          CORE Repository Dashboard!
        </a>
        <span aria-hidden="true" role="img">
          👇
        </span>
      </div>
      <div className={styles.claimCardActions}>
        {isDataProviderHasAccounts ? (
          <>
            <Button
              variant="contained"
              className={styles.claimCardAction}
              onClick={() => setIsClaimModalEditActive(true)}
            >
              SIGN IN
            </Button>
            <Button
              className={styles.claimCardAction}
              onClick={() => {
                window.open('https://dashboard.core.ac.uk/', '_blank')
              }}
            >
              Create account
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="contained"
              className={styles.claimCardAction}
              onClick={() => setIsClaimModalActive(true)}
            >
              Create account
            </Button>
            <Button
              className={styles.claimCardAction}
              onClick={() => {
                window.open(
                  'https://core.ac.uk/services/repository-dashboard',
                  '_blank'
                )
              }}
            >
              More details
            </Button>
          </>
        )}

        {isClaimModalActive && (
          <ClaimModal
            contactData={contactData}
            setModalActive={setIsClaimModalActive}
            setModalEditActive={setIsClaimModalEditActive}
            onContinueClick={(options) =>
              getClaim({
                params: {
                  id,
                  setIsClaimSuccessModalActive,
                  setNewEmail,
                  isDataProviderHasAccounts,
                  ...options,
                },
              })
            }
            className={
              (isSignInModalActive || isClaimSuccessModalActive) && styles.hide
            }
          />
        )}

        {isClaimModalEditActive && (
          <ClaimModalEdit
            contactData={contactData}
            setModalActive={setIsClaimModalActive}
            setModalEditActive={setIsClaimModalEditActive}
            isDataProviderHasAccounts={isDataProviderHasAccounts}
            onContinueClick={(options) =>
              getClaim({
                params: {
                  id,
                  setIsClaimSuccessModalActive,
                  setNewEmail,
                  isDataProviderHasAccounts,
                  ...options,
                },
              })
            }
            className={
              (isSignInModalActive || isClaimSuccessModalActive) && styles.hide
            }
          />
        )}
        {isClaimSuccessModalActive && (
          <ClaimSuccessModal
            isModalActive={isClaimSuccessModalActive}
            setClaimModalActive={setIsClaimModalActive}
            setClaimModalEditActive={setIsClaimModalEditActive}
            setSignInModalActive={setIsSignInModalActive}
            setModalActive={setIsClaimSuccessModalActive}
            isDataProviderHasAccounts={isDataProviderHasAccounts}
            onClose={() => {
              if (isClaimModalActive) setIsClaimModalActive(false)
              if (isClaimModalEditActive) setIsClaimModalEditActive(false)
              if (isSignInModalActive) setIsSignInModalActive(false)
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
