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

const BaseText = ({ operation, sourceUrl, dataProvider }) => (
  <Card.Description tag="span">
    Please, note that we can
    {operation === 'issueWithContent' ? ' update ' : ' remove '}
    the <strong>output</strong> only if the the document was
    {operation === 'issueWithContent' ? ' updated ' : ' removed '} from the
    <strong> {dataProvider} </strong> website that is available at &nbsp;
    <Link href={sourceUrl}>{sourceUrl}</Link>
    &nbsp;now.
  </Card.Description>
)

export default ReportSuccessModal
