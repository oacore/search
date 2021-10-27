import React from 'react'
import { Card, Icon } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

const Fieldset = ({ className, items, icon, onClick, title }) => {
  const [activeBox, setActiveBox] = React.useState(items[0].value)

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
