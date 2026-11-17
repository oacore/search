import { Modal } from '@oacore/design/lib/modules'
import React from 'react'
import { Button, Fieldset } from '@oacore/design/lib/elements'
import { useStore as useStoreApi } from 'zustand'

import styles from './styles.module.css'

// import Fieldset from 'modules/fieldset'
import { useStore, observe } from 'store'

const downloadVariants = [
  {
    id: 1,
    value: 10,
    label: 'Current page',
  },
  {
    id: 2,
    value: 100,
    label: 'Top 100 results',
  },
  {
    id: 3,
    value: 1000,
    label: 'All the results (up to 1,000)',
  },
]

const DownloadResultModal = observe(() => {
  const { search: searchStore } = useStore()
  const search = searchStore.getState()
  const isLoading = useStoreApi(searchStore, (state) => state.isLoading)

  const onChange = (value) => {
    search.setActiveLimit(value)
  }

  const onSubmit = () => {
    search.downloadResults()
    search.setActiveDownloadModal()
  }
  // fw500
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
      <Fieldset
        title="Size"
        items={downloadVariants}
        onClick={onChange}
        className={styles.variants}
      />
      <Modal.Footer className={styles.buttons}>
        <Button
          onClick={() => search.setActiveDownloadModal(false)}
          variant="text"
        >
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={isLoading}>
          Download
        </Button>
      </Modal.Footer>
    </Modal>
  )
})

export default DownloadResultModal
