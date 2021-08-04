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
  const [copySuccess, setCopySuccess] = useState('')

  const copyToClipboard = () => {
    if (
      !document.queryCommandSupported &&
      !document.queryCommandSupported('copy')
    )
      return

    const copyText = textRef.current.textContent

    navigator.clipboard.writeText(copyText).then(
      () => {
        // eslint-disable-next-line no-console
        console.log(`Copying to clipboard: ${copyText}`)
        setCopySuccess(true)
      },
      (err) => {
        console.error('Async: Could not copy text: ', err)
      }
    )
  }

  const [isModalOpen, toggleModal] = useModal()
  const openModal = useCallback(() => toggleModal(true), [toggleModal])
  const closeModal = useCallback(() => {
    toggleModal(false)
    setCopySuccess(false)
  }, [toggleModal, setCopySuccess])

  const modal = useMemo(
    () =>
      isModalOpen ? (
        <Modal onClose={closeModal}>
          <h2 className={styles.citeTitle}>Citation</h2>
          {data.citations.map((cite) => {
            if (cite.id !== CITATION_STYLE_BIBTEX) return null
            const bibtex = bibtexParse.toJSON(cite.value)
            if (!bibtex || !bibtex[0]) return null
            return (
              <div id={`cite-${cite.id}`} className={styles.block}>
                <div className={styles.columnText} ref={textRef}>
                  <div className={styles.item}>
                    {bibtex[0].entryTags.title}
                    {bibtex[0].entryTags.journal &&
                      `, Journal: ${bibtex[0].entryTags.journal}`}
                    {bibtex[0].entryTags.year &&
                      `, : ${bibtex[0].entryTags.year}`}
                    {bibtex[0].entryTags.ISBN &&
                      `, ISBN: ${bibtex[0].entryTags.ISBN}`}
                    {bibtex[0].entryTags.ISSN &&
                      `, ISSN: ${bibtex[0].entryTags.ISSN}`}
                  </div>
                  {bibtex[0].entryTags.DOI && (
                    <div className={styles.item}>
                      {' '}
                      Doi:{' '}
                      <a href={bibtex[0].entryTags.DOI}>
                        {bibtex[0].entryTags.DOI}
                      </a>
                    </div>
                  )}
                </div>
                <div className={styles.columnIcon}>
                  {copySuccess ? (
                    <>
                      <Icon
                        src="#content-copy"
                        className={`${styles.item} ${styles.copiedSuccess}`}
                        onClick={copyToClipboard}
                      />
                      <div className={styles.textCopied}>copied</div>
                    </>
                  ) : (
                    <Icon
                      src="#content-copy"
                      className={styles.item}
                      onClick={copyToClipboard}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </Modal>
      ) : null,
    [isModalOpen, copySuccess]
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
        <span className={styles.citeBtn}>{data.actionLabel}</span>
      </Button>
      {modal}
    </p>
  )
}

export default CitationManager
