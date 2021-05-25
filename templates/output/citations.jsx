import React, { useState, useCallback, useMemo } from 'react'
import { Button, Modal } from '@oacore/design'

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

const CitationManager = ({ id, data }) => {
  const [isModalOpen, toggleModal] = useModal()
  const openModal = useCallback(() => toggleModal(true), [toggleModal])
  const closeModal = useCallback(() => toggleModal(false), [toggleModal])

  const modal = useMemo(
    () =>
      isModalOpen ? (
        <Modal onClose={closeModal}>
          {data.citations.map((citation) => {
            const citationId = `${id}-citation-${citation.id}`
            return (
              <pre key={id} id={citationId}>
                {citation.value}
              </pre>
            )
          })}
        </Modal>
      ) : null,
    [isModalOpen]
  )

  return (
    <>
      <Button
        variant="contained"
        onClick={openModal}
        aria-pressed={isModalOpen}
      >
        {data.actionLabel}
      </Button>
      {modal}
    </>
  )
}

export default CitationManager
