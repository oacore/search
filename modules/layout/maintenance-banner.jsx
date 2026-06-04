import React from 'react'

import styles from './styles.module.css'

const MESSAGE =
  "We're currently performing scheduled maintenance. You may experience some disruptions. Thank you for your patience."

const MaintenanceBanner = () => (
  <div className={styles.maintenanceBanner} role="status">
    <p className={styles.maintenanceBannerText}>{MESSAGE}</p>
  </div>
)

export default MaintenanceBanner
