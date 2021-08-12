import React from 'react'
import { useRouter } from 'next/router'
import { Modal, Button, Link, Card, Icon } from '@oacore/design'

import { useReportController } from '../hooks'
import styles from './styles.module.css'

const REPOSITORY_MANAGER = 'repositoryManager'

const TAKE_DOWN_OPTION = 'takeDownFullText'

const ReportSuccessModal = ({
  setModalReportSuccessActive,
  sourceFulltextUrls,
  dataProvider,
}) => {
  const router = useRouter()

  const sourceUrl = Array.isArray(sourceFulltextUrls)
    ? sourceFulltextUrls[0]
    : sourceFulltextUrls

  const {
    report: { role, updateOption },
    resetReport,
  } = useReportController()

  const onCloseModal = () => {
    setModalReportSuccessActive(false)
    resetReport()

    if (updateOption === TAKE_DOWN_OPTION) router.push('/')
  }
  const setTextByReporterType = () => {
    switch (role) {
      case REPOSITORY_MANAGER:
        return (
          <>
            <div className={styles.modalCardSuccessText}>
              <Icon src="#check-circle" alt="checkbox-circle" />
              <BaseText
                operation={updateOption}
                sourceUrl={sourceUrl}
                dataProvider={dataProvider}
              />
            </div>
            <div className={styles.modalCardSuccessText}>
              <Icon src="#check-circle" alt="checkbox-circle" />
              <Card.Description tag="span">
                As someone who manages <strong> {dataProvider} </strong> you can manually disable outputs anytime via the 
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
      <Modal.Title tag="h3" className={styles.modalTitle}>
        Thank you
      </Modal.Title>
      <Modal.Content>
        <div className={styles.modalCardImage}>
          {role === REPOSITORY_MANAGER ? (
            <img src="/static/images/modal/upvote.svg" alt="upvote" />
          ) : (
            <img src="/static/images/modal/confirmed.svg" alt="upvote" />
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
    </Modal>
  )
}

const BaseText = ({ operation, sourceUrl, dataProvider }) => (
  <Card.Description tag="span">
    We can 
    {operation === 'issueWithContent' ? ' update ' : ' remove '}
    the <strong>output</strong>\u0027s record available at <Link href={sourceUrl}>{sourceUrl}</Link> only if the the document was
    {operation === 'issueWithContent' ? ' updated ' : ' removed '} at 
    <strong> {dataProvider} </strong>.
  </Card.Description>
)

export default ReportSuccessModal
