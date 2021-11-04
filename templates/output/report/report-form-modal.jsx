import React from 'react'
import { Modal, Button, Form, TextField } from '@oacore/design'

import { ROLES } from '../utils/dummy-data'
import styles from './styles.module.css'
import { useReportController } from '../hooks'

import Fieldset from 'modules/fieldset'
import { observe } from 'store'
import useInput from 'hooks/use-input'

const ReportFormModal = observe(({ id: outputId }) => {
  const {
    value: name,
    element: contactName,
    bind: bindName,
  } = useInput('contactName')

  const {
    value: email,
    element: contactEmail,
    bind: bindEmail,
  } = useInput('contactEmail')

  const {
    value: message,
    element: contactMessage,
    bind: bindMessage,
  } = useInput('contactMessage')

  const {
    report: { role: reporterRole, updateOption },
    setActiveReporter,
    setIsModalReportFormActive,
    handleSubmitForm,
    resetReport,
  } = useReportController()

  const onHandleSubmit = (evt) => {
    evt.preventDefault()

    if (outputId && name && email) {
      handleSubmitForm({ outputId, name, email, message })
      setIsModalReportFormActive(false)
    }
  }

  const onCloseModal = () => {
    setIsModalReportFormActive(false)
    resetReport()
  }

  return (
    <Modal
      aria-label="Problem-form-modal"
      hideManually
      className={styles.modal}
    >
      <Modal.Title tag="h3" className={styles.modalTitle}>
        Fill up your request
      </Modal.Title>
      <Modal.Content>
        <Fieldset
          items={ROLES}
          icon="#account"
          onClick={setActiveReporter}
          title="Who you are"
        />
        <Form className={styles.modalReporterForm} onSubmit={onHandleSubmit}>
          {reporterRole && (
            <>
              <TextField
                id={contactName}
                className={styles.modalReporterFormControl}
                name={contactName}
                {...bindName}
                label="Name"
                placeholder="e.g. John Doe"
                required
                helper={<>How should we call you.</>}
              />
              <TextField
                id={contactEmail}
                label="Email"
                className={styles.modalReporterFormControl}
                name={contactEmail}
                {...bindEmail}
                placeholder="e.g. john.doe@ac.ck.uk"
                type="email"
                required
                helper={
                  <>
                    Please, use your institutional email, it will help us verify
                    your request. We will also send the confirmation to this
                    email address.
                  </>
                }
              />
              <TextField
                type="textarea"
                id={contactMessage}
                label="Comment"
                placeholder=" "
                name={contactMessage}
                {...bindMessage}
                className={styles.modalReporterFormControl}
                helper={
                  <>
                    {updateOption === 'takeDownFullText'
                      ? 'Why this document should not be published?'
                      : 'What will you update on this page '}
                  </>
                }
              />
            </>
          )}
          <div className={styles.modalFooter}>
            <Button variant="text" onClick={onCloseModal}>
              Close
            </Button>
            <Button
              type="submit"
              disabled={reporterRole === null}
              variant="contained"
            >
              Submit
            </Button>
          </div>
        </Form>
      </Modal.Content>
    </Modal>
  )
})

export default ReportFormModal
