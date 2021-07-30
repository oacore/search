import React from 'react'
import { Modal, Button, Icon, Card, Form, TextField } from '@oacore/design'
import classNames from '@oacore/design/lib/utils/class-names'

import { ROLES } from '../utils/dummy-data'
import styles from './styles.module.css'
import { useReportController, useInput } from '../hooks'

import { observe } from 'store'

const ReportFormModal = observe(
  ({ id: outputId, setModalReportFormActive }) => {
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
      report: { role: reporterRole },
      setActiveReporter,
      handleSubmitForm,
      resetReport,
    } = useReportController()

    const onHandleSubmit = (evt) => {
      evt.preventDefault()

      if (outputId && name && email) {
        handleSubmitForm({ outputId, name, email, message })
        setModalReportFormActive(false)
      }
    }

    const onCloseModal = () => {
      setModalReportFormActive(false)
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
          <fieldset className={styles.modalReporterContainer}>
            <legend className={styles.modalReporterTitle}>Who you are</legend>
            <div className={styles.cardModalReporter}>
              {ROLES.map(({ label, id, role }) => (
                <Card
                  variant="outlined"
                  className={classNames.use(
                    styles.cardModal,
                    styles.cardModalReporterItem,
                    {
                      [styles.cardModalActive]: reporterRole === role,
                    }
                  )}
                  key={id}
                  onClick={() => setActiveReporter(role)}
                >
                  <Card.Description className={styles.cardModalDescription}>
                    <Icon src="#account" />
                    <span
                      className={classNames.use(
                        styles.cardModalDescriptionText
                      )}
                    >
                      {label}
                    </span>
                  </Card.Description>
                </Card>
              ))}
            </div>
          </fieldset>

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
                      Please, use your institutional email, it will help us
                      verify your request. We will also send the confirmation to
                      this email address.
                    </>
                  }
                />
                <TextField
                  id={contactMessage}
                  label="Comment"
                  placeholder="e.g. john.doe@ac.ck.uk"
                  name={contactMessage}
                  {...bindMessage}
                  className={styles.modalReporterFormControl}
                  helper={<>What you would like to update on the page.</>}
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
  }
)

export default ReportFormModal
