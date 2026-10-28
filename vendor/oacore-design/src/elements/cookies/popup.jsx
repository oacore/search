import React from 'react'

import styles from './cookies.css'
// eslint-disable-next-line import/no-cycle
import { Button, Link } from '..'
import { classNames } from '../../utils'

const CookiesPopup = ({ cookieItems, onSubmit, ...formProps }) => (
  <div
    className={classNames.use(styles.popup)}
    id="cookies-popup"
    {...formProps}
  >
    <div className={styles.popupBody}>
      <p>We use cookies to improve our website.</p>
      <Link href="/cookies" className={styles.popupLink}>
        Learn more
      </Link>
    </div>
    <div className={styles.popupActions}>
      <Button
        onClick={onSubmit}
        variant="outlined"
        className={styles.popupButton}
        id="essential_cookies_allowed"
      >
        Essential cookies only
      </Button>
      <Button
        onClick={onSubmit}
        variant="contained"
        className={styles.popupButton}
        id={cookieItems}
      >
        I agree
      </Button>
    </div>
  </div>
)

export default CookiesPopup
