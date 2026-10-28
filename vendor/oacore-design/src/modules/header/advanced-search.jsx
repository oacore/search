import React, { memo } from 'react'

import styles from './advanced-search.css'
import { Button, Icon } from '../../elements'

const ACTION_BUTTONS_VALUES = ['doi', 'title', 'oai', 'issn']

const AdvancedSearch = memo(
  ({ isVisible, onClose, setSearchValue, inputRef }) => {
    const handleActionButtonClick = (value) => {
      const inputValue = `${value}:" "`
      setSearchValue({ value: inputValue })
      inputRef.current.focus()
      onClose()
    }

    return (
      <div className={styles.wrapper}>
        {isVisible && (
          <div className={styles.container}>
            <p className={styles.title}>
              You are able to search across all fields including title,
              abstract, authors and full text (to find out about all the fields
              that you can search, please refer to the{' '}
              <a href="https://api.core.ac.uk/docs/v3">API documentation</a>).
            </p>
            <Button
              className={styles.clearOutButton}
              type="button"
              onClick={onClose}
            >
              <Icon src="#window-close" />
            </Button>
            <p className={styles.subtitle}>
              To refine your searches you can use:
            </p>
            <ul className={styles.variants}>
              <li className={styles.variant}>
                <span>&quot; &quot;</span> - to specify exact matching
              </li>
              <li className={styles.variant}>
                <span>AND, OR</span> - to add logic to to your search
              </li>
              <li className={styles.variant}>
                <span>( )</span> - to group your search terms
              </li>
              <li className={styles.variant}>
                <span>property_name:&quot;value&quot;</span> - a value for a
                specific property, e.g.{' '}
                <i>title:”Connecting Repositories”, doi:”10...”</i>
              </li>
              <li className={styles.variant}>
                <span>
                  {'>'}
                  {'<='}
                </span>{' '}
                - to query on numeric fields, e.g. <i>year&gt;2020</i>
              </li>
              <li className={styles.variant}>
                <span>_exists_:&quot;field_name&quot;</span> - to get all the
                records that have a certain field e.g. _exists_:issn
              </li>
            </ul>
            <p className={styles.subtitle}>
              To get you started quickly follow this links to prefill your
              search box:
            </p>
            <ul className={styles.buttons}>
              {ACTION_BUTTONS_VALUES.map((value) => (
                <li key={value} className={styles.buttonContainer}>
                  <Button
                    variant="outlined"
                    onClick={() => handleActionButtonClick(value)}
                  >
                    search by {value}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }
)

export default AdvancedSearch
