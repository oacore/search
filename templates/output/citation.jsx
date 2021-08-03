import React, { useState, useCallback, useMemo, useRef } from 'react'
import { Button, Modal, Icon } from '@oacore/design'
import bibtexParse from 'bibtex-parse-js'

import styles from './citation.module.css'

const useModal = (initialState = false) => {
  const [isOpen, setOpen] = useState(initialState)

  const toggleOpen = useCallback(
    (newState) => {
      setOpen((prevState) => {
        if (newState != null) return newState
        return !prevState
      })
    },
    [setOpen]
  )

  return [isOpen, toggleOpen]
}

const CitationManager = ({ data }) => {
  const CITATION_STYLE_BIBTEX = 'bibtex'
  const textRef = useRef(null)

  const copyToClipboard = () => {
    if (
      !document.queryCommandSupported &&
      !document.queryCommandSupported('copy')
    )
      return

    const copyText = textRef.current

    copyText.select()
    // copyText.setSelectionRange(0, value.length)
    // document.execCommand('copy')
  }

  const [isModalOpen, toggleModal] = useModal()
  const openModal = useCallback(() => toggleModal(true), [toggleModal])
  const closeModal = useCallback(() => toggleModal(false), [toggleModal])

  const modal = useMemo(
    (id) =>
      isModalOpen ? (
        <Modal onClose={closeModal}>
          <h2>Citation</h2>
          {data.citations.map((cite) => {
            if (cite.id !== CITATION_STYLE_BIBTEX) return null
            const citeId = `${id}-cite-${cite.id}`
            const bibtex = bibtexParse.toJSON(cite.value)
            if (!bibtex || !bibtex[0]) return null
            return (
              <div key={id} id={citeId} className={styles.block}>
                <div className={styles.columnText}>
                  <div className={styles.item}>
                    {bibtex[0].entryTags.title}
                    {', Journal: '}
                    {bibtex[0].entryTags.journal}
                    {', '}
                    {bibtex[0].entryTags.year}
                    {', ISBN: '}
                    {bibtex[0].entryTags.ISBN}
                    {', ISSN: '}
                    {bibtex[0].entryTags.ISSN}
                  </div>
                  {bibtex[0].entryTags.DOI && (
                    <div className={styles.item}>
                      Doi:{' '}
                      <a href={bibtex[0].entryTags.DOI}>
                        {bibtex[0].entryTags.DOI}
                      </a>
                    </div>
                  )}
                </div>
                <div className={styles.columnIcon}>
                  <Icon
                    src="#content-copy"
                    className={styles.item}
                    onClick={copyToClipboard}
                  />
                </div>
              </div>
            )
          })}
        </Modal>
      ) : null,
    [isModalOpen]
  )

  return (
    <p>
      <Button
        variant="outlined"
        onClick={openModal}
        aria-pressed={isModalOpen}
        className={styles.citeButton}
      >
        <Icon src="#format-quote-open" />
        {data.actionLabel}
      </Button>
      {modal}
    </p>
  )
}

export default CitationManager
