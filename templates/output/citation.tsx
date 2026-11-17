import React, { useState, useCallback, useMemo, useRef } from 'react'
import { Button, Modal, Icon } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import bibtexParse from '../../vendor/bibtex-parse-js/bibtexParse'
import styles from './citation.module.css'

const useModal = (initialState: any = false) => {
  const [isOpen, setOpen] = useState(initialState)

  const toggleOpen = useCallback(
    (newState: any) => {
      setOpen((prevState: any) => {
        if (newState != null) return newState
        return !prevState
      })
    },
    [setOpen]
  )

  return [isOpen, toggleOpen]
}

const CitationManager = ({ data }: any) => {
  const CITATION_STYLE_BIBTEX = 'bibtex'
  const textRef = useRef<any>(null)
  const [copySuccess, setCopySuccess] = useState<any>('')

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
      (err: any) => {
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
        <Modal
          onClose={closeModal}
          className={classNames.use(styles['close-button'])}
        >
          <h2 className={styles['cite-title']}>Citation</h2>
          {data.citations.map((cite: any) => {
            if (cite.id !== CITATION_STYLE_BIBTEX) return null
            const bibtex = bibtexParse.toJSON(cite.value)
            if (!bibtex || !bibtex[0]) return null
            return (
              <div id={`cite-${cite.id}`} className={styles.block}>
                <div className={styles['column-text']} ref={textRef}>
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
                </div>
                <div className={styles['column-icon']}>
                  {copySuccess ? (
                    <>
                      <Icon
                        src="#content-copy"
                        className={`${styles.item} ${styles['copied-success']}`}
                        onClick={copyToClipboard}
                      />
                      <div className={styles['text-copied']}>copied</div>
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
    <>
      <Button
        variant="contained"
        onClick={openModal}
        aria-pressed={isModalOpen}
        className={styles['cite-button']}
      >
        <Icon src="#format-quote-open" />
        <span className={styles['cite-btn']}>{data.actionLabel}</span>
      </Button>
      {modal}
    </>
  )
}

export default CitationManager
