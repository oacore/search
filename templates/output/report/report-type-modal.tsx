import React from 'react'
import { Modal, Button, Icon, Card } from '@oacore/design'
import classNames from '@oacore/design/lib/utils/class-names'

import { useReportController } from '../hooks'
import { UPDATE_OPTIONS } from '../utils/dummy-data'
import styles from './styles.module.css'

import { observe } from 'store'

const selectOperation = (state?: any) => ({ updateOption: state.updateOption })

const ReportTypeModal = observe(() => {
  const {
    report: { updateOption },
    setActiveOperation,
    resetReport,
    setIsModalReportTypeActive,
    setIsModalReportFormActive,
  } = useReportController(selectOperation)

  const onShowFormModal = () => {
    setIsModalReportTypeActive(false)
    setIsModalReportFormActive(true)
  }

  const onCloseModal = () => {
    setIsModalReportTypeActive(false)
    resetReport()
  }

  return (
    <Modal
      aria-label="Problem-type-modal"
      hideManually
      className={styles.modal}
    >
      <Modal.Title tag="h3" className={styles['modal-title']}>
        Which issue are you reporting?
      </Modal.Title>
      <Modal.Content>
        {UPDATE_OPTIONS.map(({ operation, id, label }: any) => (
          <Card
            variant="outlined"
            className={classNames.use(
              styles['card-modal'],
              styles['card-modal-report-type'],
              {
                [styles['card-modal-active']]: updateOption === operation,
              }
            )}
            key={id}
            onClick={() => setActiveOperation(operation)}
          >
            <Card.Description className={styles['card-modal-description']}>
              <Icon src="#account" />
              <span className={styles['card-modal-description-text']}>
                {label}
              </span>
            </Card.Description>
          </Card>
        ))}
      </Modal.Content>
      <Modal.Footer className={styles['modal-footer']}>
        <Button onClick={onCloseModal} variant="text">
          Close
        </Button>
        <Button
          disabled={updateOption === null}
          variant="contained"
          onClick={onShowFormModal}
        >
          Continue
        </Button>
      </Modal.Footer>
    </Modal>
  )
})

export default ReportTypeModal
