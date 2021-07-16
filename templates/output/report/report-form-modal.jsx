import React from 'react'
import { Modal, Button, Icon, Card, Form, TextField } from '@oacore/design'
import classNames from '@oacore/design/lib/utils/class-names'

import { reporterTypes } from '../utils/dummy-data'
import styles from './styles.module.css'
import { useReportController, useInput } from '../hooks'

import { observe } from 'store'

const ReportFormModal = observe(
  ({ id, setModalReportFormActive, setModalSuccessActive }) => {
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
      value: comment,
      element: contactComment,
      bind: bindComment,
    } = useInput('contactComment')

    const {
      report: { reporterType },
      setActiveReporter,
      handleSubmitForm,
      resetReport,
    } = useReportController()

    const onHandleSubmit = (evt) => {
      evt.preventDefault()

      if (name && email && comment) {
        handleSubmitForm(id, name, email, comment)
        setModalReportFormActive(false)
        setModalSuccessActive(true)
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
              {reporterTypes.map((item) => (
                <Card
                  variant="outlined"
                  className={classNames.use(styles.cardModal, {
                    [styles.cardModalActive]: reporterType === item.name,
                  })}
                  key={item.id}
                  onClick={() => setActiveReporter(item.name)}
                >
                  <Card.Description className={styles.cardModalDescription}>
                    <Icon src="#account" />
                    <span
                      className={classNames.use(
                        styles.cardModalDescriptionText
                      )}
                    >
                      {item.name}
                    </span>
                  </Card.Description>
                </Card>
              ))}
            </div>
          </fieldset>

          <Form className={styles.modalReporterForm} onSubmit={onHandleSubmit}>
            {reporterType && (
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
                  id={contactComment}
                  label="Comment"
                  placeholder="e.g. john.doe@ac.ck.uk"
                  name={contactComment}
                  {...bindComment}
                  className={styles.modalReporterFormControl}
                  required
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
                disabled={reporterType === null}
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
