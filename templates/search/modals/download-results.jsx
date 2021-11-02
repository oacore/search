import { Modal } from '@oacore/design/lib/modules'
import React from 'react'
import { Button } from '@oacore/design/lib/elements'

import styles from './styles.module.css'

import Fieldset from 'modules/fieldset'
import { useStore, observe } from 'store'

const downloadVariants = [
  {
    id: 1,
    value: 1000,
    label: '1000 outputs',
  },
  {
    id: 2,
    value: 5000,
    label: '5000 outputs',
  },
  {
    id: 3,
    value: 10000,
    label: '10 000 outputs',
  },
]

const DownloadResultModal = observe(({ setModalActive }) => {
  const { search } = useStore()

  const onChange = (value) => {
    search.setActiveLimit(value)
  }

  const onSubmit = () => {
    search.downloadResults()
  }

  return (
    <Modal
      aria-label="Download results in cvs modal"
      hideManually
      className={styles.modal}
    >
      <Modal.Title tag="h3" className={styles.title}>
        Download results in CSV
      </Modal.Title>
      <Modal.Content className={styles.text}>
        By downloading the file you will receive the search results in a CSV
        format including the identifiers, title, authors and link to the CORE
        page.
        <br /> Choose how many articles you want to download.
      </Modal.Content>
      <Fieldset title="Size" items={downloadVariants} onClick={onChange} />
      <Modal.Footer className={styles.buttons}>
        <Button onClick={() => setModalActive(false)} variant="text">
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained">
          Download
        </Button>
      </Modal.Footer>
    </Modal>
  )
})

export default DownloadResultModal
