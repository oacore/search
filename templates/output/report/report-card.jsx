import React from 'react'
import { Card, Button } from '@oacore/design'

import ReportTypeModal from './report-type-modal'
import ReportFormModal from './report-form-modal'
import ReportSuccessModal from './report-success-modal'
import styles from './styles.module.css'

const ReportCard = ({ id, sourceFulltextUrls, dataProvider }) => {
  const [isModalReportTypeActive, setIsModalReportTypeActive] =
    React.useState(false)

  const [isModalReportFormActive, setIsModalReportFormActive] =
    React.useState(false)

  const [isModalReportSuccessActive, setIsModalReportSuccessActive] =
    React.useState(false)

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
          setModalReportSuccessActive={setIsModalReportSuccessActive}
        />
      )}
      {isModalReportSuccessActive && (
        <ReportSuccessModal
          sourceFulltextUrls={sourceFulltextUrls}
          setModalReportSuccessActive={setIsModalReportSuccessActive}
          dataProvider={dataProvider}
          id={id}
        />
      )}
    </Card>
  )
}

export default ReportCard
