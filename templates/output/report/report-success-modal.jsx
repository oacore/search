import React from 'react'
import { Modal, Button, Link, Card, Icon } from '@oacore/design'

import { useReportController } from '../hooks'
import styles from './styles.module.css'

const REPOSITORY_MANAGER = 'Repository manager'

const ReportSuccessModal = ({
  setModalReportSuccessActive,
  sourceFulltextUrls,
}) => {
  const {
    report: { reporterType, operation },
    resetReport,
  } = useReportController()

  const onCloseModal = () => {
    setModalReportSuccessActive(false)
    resetReport()
  }

  const setTextByReporterType = () => {
    switch (reporterType) {
      case REPOSITORY_MANAGER:
        return (
          <>
            <div className={styles.modalCardSuccessText}>
              <Icon src="#check-circle" alt="checkbox-circle" />
              <BaseText
                operation={operation}
                sourceFulltextUrls={sourceFulltextUrls}
              />
            </div>
            <div className={styles.modalCardSuccessText}>
              <Icon src="#check-circle" alt="checkbox-circle" />
              <Card.Description tag="span">
                As a repository manager you can manually disable article in CORE
                Dashboard. To learn more about CORE Services &nbsp;
                <Link
                  className={styles.customLink}
                  href="https://core.ac.uk/services/repository-dashboard"
                >
                  https://core.ac.uk/services/repository-dashboard
                </Link>
              </Card.Description>
            </div>
          </>
        )

      default:
        return (
          <BaseText
            operation={operation}
            sourceFulltextUrls={sourceFulltextUrls}
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
          {reporterType === REPOSITORY_MANAGER ? (
            <img src="/static/images/modal/upvote.svg" alt="upvote" />
          ) : (
            <img src="/static/images/modal/confirmed.svg" alt="upvote" />
          )}
        </div>
        <Card.Description>
          We have received your requests and will process it as soon as
          possible.
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

const BaseText = ({ operation, sourceFulltextUrls }) => (
  <Card.Description tag="span">
    Please, note that we can {operation === 'update' ? ' update ' : ' remove '}
    the <strong>output</strong> only if the the document was
    {operation === 'update' ? ' updated ' : ' removed '} from the
    <strong> Open Reseach Online </strong> website that is available at &nbsp;
    <Link href={sourceFulltextUrls[0]}>{sourceFulltextUrls[0]}</Link>
    &nbsp; now.
  </Card.Description>
)

export default ReportSuccessModal
