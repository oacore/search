import React from 'react'

import styles from './styles.css'
import Modal from '../modal'

const Video = ({ video, visibleModal, closeModal }) =>
  visibleModal && (
    <Modal
      onClose={closeModal}
      aria-label="Service video"
      className={styles.modal}
    >
      <iframe
        className={styles.video}
        src={video?.src}
        title={video?.title}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </Modal>
  )

export default Video
