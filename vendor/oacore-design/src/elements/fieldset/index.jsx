import React from 'react'

import styles from './fieldset.css'
// eslint-disable-next-line import/no-cycle
import { Card, Icon } from '..'
import { classNames } from '../../utils'

const Fieldset = ({ className, items, icon, onClick, title }) => {
  const [activeBox, setActiveBox] = React.useState()

  React.useEffect(() => {
    setActiveBox(items[0].value)
  }, [])

  const onHandleClick = (value) => {
    onClick(value)
    setActiveBox(value)
  }

  return (
    <fieldset className={classNames.use(styles.fieldset).join(className)}>
      <legend className={styles.title}>{title}</legend>
      <div className={styles.boxes}>
        {items.map(({ label, id, value }) => (
          <Card
            variant="outlined"
            className={classNames.use(styles.boxItem, {
              [styles.boxItemActive]: activeBox === value,
            })}
            key={id}
            onClick={() => onHandleClick(value)}
          >
            <Card.Description className={styles.description}>
              {icon && <Icon src={icon} className={styles.icon} />}
              <span>{label}</span>
            </Card.Description>
          </Card>
        ))}
      </div>
    </fieldset>
  )
}

export default Fieldset
