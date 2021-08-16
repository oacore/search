import React from 'react'
import { useRouter } from 'next/router'
import { Modal, Button, Link, Card, Icon } from '@oacore/design'

import { useReportController } from '../hooks'
import styles from './styles.module.css'
import upvoteSVG from './images/modal/upvote.svg'
import confirmedSVG from './images/modal/confirmed.svg'

import Loader from 'modules/loader'
import { observe } from 'store'

const REPOSITORY_MANAGER = 'repositoryManager'

const TAKE_DOWN_OPTION = 'takeDownFullText'

const ReportSuccessModal = observe(
  ({ sourceFulltextUrls, dataProvider, id }) => {
    const router = useRouter()

    const sourceUrl = Array.isArray(sourceFulltextUrls)
      ? sourceFulltextUrls[0]
      : sourceFulltextUrls

    const {
      report: { role, updateOption, isLoading },
      resetReport,
      setIsModalReportSuccessActive,
    } = useReportController()

    const onCloseModal = () => {
      setIsModalReportSuccessActive(false)
      resetReport()

      const outputURL = `/outputs/${id}`

      // Update only if user on output page
      if (updateOption === TAKE_DOWN_OPTION && router.asPath === outputURL)
        router.push(outputURL)
    }

    const setTextByReporterType = () => {
      switch (role) {
        case REPOSITORY_MANAGER:
          return (
            <>
              <BaseText
                operation={updateOption}
                sourceUrl={sourceUrl}
                dataProvider={dataProvider}
              />
              <div className={styles.modalCardSuccessText}>
                <Icon src="#check-circle" alt="checkbox-circle" />
                <Card.Description tag="span">
                  As someone who manages <strong> {dataProvider} </strong>
                  collection you can manually disable outputs anytime via the
                  &nbsp;
                  <Link
                    className={styles.customLink}
                    href="https://core.ac.uk/services/repository-dashboard"
                  >
                    CORE Repository Dashboard
                  </Link>
                </Card.Description>
              </div>
            </>
          )

        default:
          return (
            <BaseText
              operation={updateOption}
              sourceUrl={sourceUrl}
              dataProvider={dataProvider}
            />
          )
      }
    }

    return (
      <Modal
        aria-label="Success-type-modal"
        className={styles.modal}
        hideManually
      >
        {isLoading ? (
          <Loader />
        ) : (
          <>
            <Modal.Title tag="h3" className={styles.modalTitle}>
              Thank you
            </Modal.Title>
            <Modal.Content>
              <div className={styles.modalCardImage}>
                {role === REPOSITORY_MANAGER ? (
                  <img src={upvoteSVG} alt="upvote" />
                ) : (
                  <img src={confirmedSVG} alt="confirmed" />
                )}
              </div>
              <Card.Description>
                We have received your request.
              </Card.Description>
              {setTextByReporterType()}
            </Modal.Content>
            <Modal.Footer className={styles.modalFooter}>
              <Button variant="text" onClick={onCloseModal}>
                got it
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    )
  }
)

const BaseText = ({ operation, sourceUrl, dataProvider }) => (
  <div className={styles.modalCardSuccessText}>
    <Icon src="#check-circle" alt="checkbox-circle" />
    <Card.Description tag="span">
      We can
      {operation === 'issueWithContent' ? ' update ' : ' remove '}
      the <strong>output</strong>&apos;s record available at{' '}
      <Link href={sourceUrl}>{sourceUrl}</Link> <strong>only if </strong> the
      the document was
      {operation === 'issueWithContent' ? ' updated ' : ' removed '} at
      <strong> {dataProvider} </strong>.
    </Card.Description>
  </div>
)

export default ReportSuccessModal
