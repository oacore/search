import React from 'react'
import { Link } from '@oacore/design'

import styles from './styles.module.css'

const Footer = () => (
  <footer className={styles.footer}>
    <div className={styles.footerMain}>
      <div className={styles.footerMainLeft}>
        <h4 className="display">Useful links</h4>
        <ul className={styles.footerLinks}>
          <li className={styles.footerLink}>
            <Link href="https://blog.core.ac.uk/">Blog</Link>
          </li>
          <li className={styles.footerLink}>
            <Link href="https://core.ac.uk/about/">About CORE</Link>
          </li>
          <li className={styles.footerLink}>
            <Link href="https://core.ac.uk/about/#contact">Contacts</Link>
          </li>
          <li className={styles.footerLink}>
            <Link href="https://core.ac.uk/cookies/">Cookies</Link>
          </li>
          <li className={styles.footerLink}>
            <Link href="https://core.ac.uk/privacy/">Privacy notice</Link>
          </li>
          <li className={styles.footerLink}>
            <Link href="https://core.ac.uk/accessibility/">Accessibility</Link>
          </li>
        </ul>
      </div>
      <aside className={styles.footerMainRight}>
        <h6 className="display">Writing about CORE?</h6>
        <p>
          Discover our <Link href="/">research outputs</Link> and cite our work.
        </p>
      </aside>
    </div>
    <div className={styles.logos}>
      <Link
        href="https://www.open.ac.uk"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.logo}
      >
        <img src="//core.ac.uk/images/logos/ou.png" alt="The Open University" />
      </Link>
      <Link
        href="https://www.jisc.ac.uk"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.logo}
      >
        <img src="//core.ac.uk/images/logos/jisc.svg" alt="Jisc" />
      </Link>
      <span className={styles.notForProfitNotice}>
        CORE is a not-for-profit service delivered by{' '}
        <Link href="https://www.open.ac.uk">The Open University</Link> and{' '}
        <Link href="https://www.jisc.ac.uk">Jisc</Link>.
      </span>
    </div>
  </footer>
)

export default Footer
