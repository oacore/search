import React from 'react'

import styles from './footer.css'
// eslint-disable-next-line import/no-cycle
import { Icon as IconFoot, Link as LinkFoot, MathMarkdown } from '..'
import { classNames } from '../../utils'
import { BaseLink as Link } from '../link'

const MenuListItem = ({
  children,
  href,
  className = '',
  tag: Tag = 'li',
  ...restProps
}) => (
  <Tag {...restProps} className={classNames.use(styles.item).join(className)}>
    <a href={href}>{children}</a>
  </Tag>
)

const MenuList = ({ title, children, className = '' }) => {
  const items = React.Children.map(children, (child) => {
    if (child.type !== MenuListItem) return null
    return React.cloneElement(child, {
      key: child.props.href,
      tag: child.props.tag ?? 'li',
    })
  })

  return (
    <div>
      <h6 className={styles.menuTitle}>{title}</h6>
      <ul className={`${styles.list} ${className}`}>{items}</ul>
    </div>
  )
}

const Card = () => (
  <div className={styles.card}>
    <div className={styles.cardContent}>
      <h6 className={styles.cardTitle}>Writing about CORE?</h6>
      <p className={styles.cardDesc}>
        Discover our{' '}
        <LinkFoot href="/about/research-outputs">research outputs</LinkFoot> and
        cite our work.
      </p>{' '}
    </div>
    <IconFoot src="#writing" alt="writing" className={styles.cardImg} />
  </div>
)

const Footer = ({ className }) => (
  <footer className={classNames.use(styles.footer).join(className)} id="footer">
    <div className={styles.container}>
      <div className={classNames.use(styles.sectionLogos)}>
        <div className={styles.logos}>
          <LinkFoot href="https://core.ac.uk">
            <IconFoot
              src="#coreLogo"
              alt="core logo"
              className={styles.footerMainLogo}
            />
          </LinkFoot>
        </div>
        <p className={styles.text}>
          CORE (COnnecting REpositories) is a not-for-profit service supported
          by{' '}
          <Link href="https://core.ac.uk/governance/supporters#membership-list">
            <MathMarkdown>CORE Members.</MathMarkdown>
          </Link>
        </p>
      </div>
      <menu className={classNames.use(styles.menu)}>
        <MenuList title="Product">
          <MenuList.Item href="/services">Services</MenuList.Item>
          <MenuList.Item href="/membership">Membership</MenuList.Item>
          <MenuList.Item href="/sponsorship">Sponsorship</MenuList.Item>
          <MenuList.Item href="/innovations/labs">Labs</MenuList.Item>
        </MenuList>
        <MenuList title="Organisation">
          <MenuList.Item href="/about">About us</MenuList.Item>
          <MenuList.Item href="/about#our-mission">Governance</MenuList.Item>
          <MenuList.Item href="/about#team">Team</MenuList.Item>
          <MenuList.Item href="/benefits">Data providers</MenuList.Item>
        </MenuList>
        <MenuList title="Support">
          <MenuList.Item href="/terms">Terms</MenuList.Item>
          <MenuList.Item href="/faq">FAQs</MenuList.Item>
          <MenuList.Item href="https://blog.core.ac.uk/">Blog</MenuList.Item>
          <MenuList.Item href="/about#contact">Contact us</MenuList.Item>
        </MenuList>
      </menu>
      <div className={classNames.use(styles.section, styles.sectionCard)}>
        <Card />
        <div className={styles.contactWrapper}>
          <span className={styles.contact}>Follow us:</span>
          <div className={styles.footerIcons}>
            <Link target="_blank" href="https://twitter.com/oacore">
              <IconFoot
                src="#twitter"
                alt="twitter"
                className={styles.footerIcon}
              />
            </Link>
            <Link
              target="_blank"
              href="https://www.linkedin.com/company/coreoa"
            >
              <IconFoot
                src="#linkedin"
                alt="linkedin"
                className={styles.footerIcon}
              />
            </Link>
            <Link target="_blank" href="https://github.com/oacore">
              <IconFoot
                src="#github"
                alt="github"
                className={styles.footerIcon}
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
    <div className={styles.bottom}>
      <LinkFoot className={styles.bottomLink} href="/accessibility">
        Accessibility
      </LinkFoot>
      <LinkFoot className={styles.bottomLink} href="/cookies">
        Cookies
      </LinkFoot>
      <LinkFoot className={styles.bottomLink} href="/privacy">
        Privacy
      </LinkFoot>
    </div>
  </footer>
)
MenuList.Item = MenuListItem
export default Footer
