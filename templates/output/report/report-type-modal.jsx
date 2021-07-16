import React from 'react'
import { Modal, Button, Icon, Card } from '@oacore/design'
import classNames from '@oacore/design/lib/utils/class-names'

import { useReportController } from '../hooks'
import { reportTypes } from '../utils/dummy-data'
import styles from './styles.module.css'

import { observe } from 'store'

const ReportTypeModal = observe(
  ({ setModalReportTypeActive, setModalFormActive }) => {
    const {
      report: { operation },
      setActiveOperation,
      resetReport,
    } = useReportController()

    const onShowFormModal = () => {
      setModalReportTypeActive(false)
      setModalFormActive(true)
    }

    const onCloseModal = () => {
      setModalReportTypeActive(false)
      resetReport()
    }

    return (
      <Modal
        aria-label="Problem-type-modal"
        hideManually
        className={styles.modal}
      >
        <Modal.Title tag="h3" className={styles.modalTitle}>
          Which issue are you reporting?
        </Modal.Title>
        <Modal.Content>
          {reportTypes.map((reportType) => (
            <Card
              variant="outlined"
              className={classNames.use(
                styles.cardModal,
                styles.cardModalReportType,
                {
                  [styles.cardModalActive]: operation === reportType.operation,
                }
              )}
              key={reportType.id}
              onClick={() => setActiveOperation(reportType.operation)}
            >
              <Card.Description className={styles.cardModalDescription}>
                <Icon src="#account" />
                <span className={styles.cardModalDescriptionText}>
                  {reportType.label}
                </span>
              </Card.Description>
            </Card>
          ))}
        </Modal.Content>
        <Modal.Footer className={styles.modalFooter}>
          <Button onClick={onCloseModal} variant="text">
            Close
          </Button>
          <Button
            disabled={operation === null}
            variant="contained"
            onClick={onShowFormModal}
          >
            Continue
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
)

export default ReportTypeModal
