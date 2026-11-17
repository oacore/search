import React from 'react'
import { classNames } from '@oacore/design/lib/utils'

import defaultLogoSVG from './images/Default.svg'
import styles from './styles.module.css'

const Logo = ({ className }) => (
  <div className={classNames.use(styles.repositoryLogo).join(className)}>
    <img src={defaultLogoSVG} alt="Data provider logo" />
  </div>
)

export default Logo
