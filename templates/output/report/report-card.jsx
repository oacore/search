import React from 'react'
import { Card, Button } from '@oacore/design'

import ReportTypeModal from './report-type-modal'
import ReportFormModal from './report-form-modal'
import ReportSuccessModal from './report-success-modal'
import styles from './styles.module.css'
import { useReportController } from '../hooks'

import { observe } from 'store'

const ReportCard = observe(({ id, sourceFulltextUrls, dataProvider }) => {
  const {
    report: {
      isModalReportTypeActive,
      isModalReportFormActive,
      isModalReportSuccessActive,
    },
    setIsModalReportTypeActive,
  } = useReportController()

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
      {isModalReportTypeActive && <ReportTypeModal />}
      {isModalReportFormActive && <ReportFormModal id={id} />}
      {isModalReportSuccessActive && (
        <ReportSuccessModal
          sourceFulltextUrls={sourceFulltextUrls}
          dataProvider={dataProvider}
          id={id}
        />
      )}
    </Card>
  )
})

export default ReportCard
