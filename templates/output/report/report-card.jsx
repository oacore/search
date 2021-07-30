import React, { useEffect } from 'react'
import { Card, Button } from '@oacore/design'

import ReportTypeModal from './report-type-modal'
import ReportFormModal from './report-form-modal'
import ReportSuccessModal from './report-success-modal'
import { useReportController } from '../hooks'
import styles from './styles.module.css'

import { observe } from 'store'

const ReportCard = observe(({ id, sourceFulltextUrls, dataProvider }) => {
  const {
    report: { statusCode },
  } = useReportController()

  const [isModalReportTypeActive, setIsModalReportTypeActive] =
    React.useState(false)

  const [isModalReportFormActive, setIsModalReportFormActive] =
    React.useState(false)

  const [isModalReportSuccessActive, setIsModalReportSuccessActive] =
    React.useState(false)

  useEffect(() => {
    if (statusCode === 200) setIsModalReportSuccessActive(true)
  }, [statusCode])

  return (
    <Card variant="outlined" className={styles.reportCard}>
      <Card.Title className={styles.reportCardText}>
        Having an issue?
      </Card.Title>
      <Card.Description className={styles.reportCardText}>
        Is data on this page outdated, violates copyrights or anything else?
        Report the problem now and we will take corresponding actions after
        reviewing your request.
      </Card.Description>
      <Card.Footer className={styles.reportCardFooter}>
        <Button onClick={() => setIsModalReportTypeActive(true)}>Report</Button>
      </Card.Footer>
      {isModalReportTypeActive && (
        <ReportTypeModal
          setModalFormActive={setIsModalReportFormActive}
          setModalReportTypeActive={setIsModalReportTypeActive}
        />
      )}
      {isModalReportFormActive && (
        <ReportFormModal
          id={id}
          setModalReportFormActive={setIsModalReportFormActive}
        />
      )}
      {isModalReportSuccessActive && (
        <ReportSuccessModal
          sourceFulltextUrls={sourceFulltextUrls}
          setModalReportSuccessActive={setIsModalReportSuccessActive}
          dataProvider={dataProvider}
        />
      )}
    </Card>
  )
})

export default ReportCard
