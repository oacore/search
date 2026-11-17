import React, { useRef } from 'react'
import { Card, Button } from '@oacore/design'

import ReportTypeModal from './report-type-modal'
import ReportFormModal from './report-form-modal'
import ReportSuccessModal from './report-success-modal'
import styles from './styles.module.css'
import { useReportController } from '../hooks'
import { KeptDiv, KeptP } from '../kept-element'

import { observe } from 'store'

export const REPORT_CARD_CLASS = styles['report-card']

const selectModals = (state?: any) => ({
  isModalReportTypeActive: state.isModalReportTypeActive,
  isModalReportFormActive: state.isModalReportFormActive,
  isModalReportSuccessActive: state.isModalReportSuccessActive,
})

const ReportCard = observe(({ id, dataProvider, repaired }: any) => {
  const {
    report: {
      isModalReportTypeActive,
      isModalReportFormActive,
      isModalReportSuccessActive,
    },
    setIsModalReportTypeActive,
  } = useReportController(selectModals)

  // the classes of a page load last until the card's first update (Q-072)
  const firstId = useRef(id)
  const updated = useRef(false)
  if (
    id !== firstId.current ||
    isModalReportTypeActive ||
    isModalReportFormActive ||
    isModalReportSuccessActive
  )
    updated.current = true
  const look = updated.current ? {} : repaired

  return (
    <Card
      id={repaired?.id}
      tag={KeptDiv}
      variant="outlined"
      className={REPORT_CARD_CLASS}
      {...look?.card}
    >
      <Card.Title className={styles['report-card-text']}>
        Having an issue?
      </Card.Title>
      <Card.Description
        tag={KeptP}
        className={styles['report-card-text']}
        {...look?.description}
      >
        Is data on this page outdated, violates copyrights or anything else?
        Report the problem now and we will take corresponding actions after
        reviewing your request.
      </Card.Description>
      <Card.Footer
        tag={KeptDiv}
        className={styles['report-card-footer']}
        {...look?.footer}
      >
        <Button onClick={() => setIsModalReportTypeActive(true)}>Report</Button>
      </Card.Footer>
      {isModalReportTypeActive && <ReportTypeModal />}
      {isModalReportFormActive && <ReportFormModal id={id} />}
      {isModalReportSuccessActive && (
        <ReportSuccessModal dataProvider={dataProvider} id={id} />
      )}
    </Card>
  )
})

export default ReportCard
