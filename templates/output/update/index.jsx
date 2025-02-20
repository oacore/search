import React from 'react'
import { Button, Form, Link, TextField } from '@oacore/design/lib'
import classNames from '@oacore/design/lib/utils/class-names'

import { useReportController } from '../hooks'
import ReportTypeModal from '../report/report-type-modal'
import ReportFormModal from '../report/report-form-modal'
import ReportSuccessModal from '../report/report-success-modal'
import Links from './links'
import styles from './styles.module.css'
import faqSVG from './images/faq.svg'
import takedownSVG from './images/takedown.svg'

import { observe } from 'store'
import useInput from 'hooks/use-input'

const UpdateTemplate = observe(() => {
  const {
    report: {
      isModalReportTypeActive,
      isModalReportFormActive,
      isModalReportSuccessActive,
      output: { id, dataProvider },
      error: errorMessage,
      isLoading,
    },
    getMetadata,
    setErrorMessage,
  } = useReportController()

  const {
    value: url,
    element: outputUrl,
    bind: bindUrl,
  } = useInput('outputUrl')

  const onSubmitUpdate = (evt) => {
    evt.preventDefault()

    const regexStringPatterns =
      /(http(s)?:\/\/)?core.ac.uk\/(outputs|display|download|download\/pdf)\/\d+|^\d+$/s
    // /(http(s)?:\/\/)?core.ac.uk\/(outputs|display|download)\/\d+|^\d+$/s
    // /(http(s)?:\/\/)?core.ac.uk\/(display|download\/pdf)\/\d+|^\d+$/s
    const regexNumberPattern = /\d+/s

    const outputId = url
      .match(regexStringPatterns)
      ?.join('')
      ?.match(regexNumberPattern)
      ?.join('')
    // eslint-disable-next-line no-console
    console.log(`Takedown outputId => ${outputId}`)

    if (!outputId) setErrorMessage('Please provide correct URL')

    if (outputId) {
      setErrorMessage('')
      getMetadata(outputId)
    }
  }

  return (
    <>
      <section className={classNames.use(styles.header, styles.container)}>
        <h2 className="display">Article Takedown Request </h2>
        <img src={takedownSVG} alt="takedown" />
      </section>
      <section className={classNames.use(styles.update, styles.container)}>
        <div className={styles.updateDescription}>
          <p>
            To remove a paper from CORE, please search for the paper using the
            search box at the top of this page.
          </p>
          <p>
            When you have found the paper, please enter the URL of the paper
            from CORE into the form on the right and we will redirect you to the
            correct page.
          </p>
        </div>
        <Form className={styles.updateLink} onSubmit={onSubmitUpdate}>
          <p>Put link to the article here:</p>
          <TextField
            id={url}
            name={outputUrl}
            {...bindUrl}
            label="CORE URL"
            placeholder="e.g. https://core.ac.uk/display/1"
            required
          />
          {errorMessage && (
            <p className={styles.errorMessage}>{errorMessage}</p>
          )}

          <Button variant="contained" disabled={isLoading}>
            SUBMIT
          </Button>
        </Form>
      </section>
      <section className={classNames.use(styles.links, styles.container)}>
        <h4 className="display">
          Types of links you can use to fill up the CORE URL field
        </h4>
        <p>
          For example, suppose you wanted to remove the paper: &nbsp;
          <Link
            href="https://core.ac.uk/display/82976757?recSetID="
            target="blank"
          >
            CORE: aggregation use cases for open access
          </Link>
          .
        </p>
        <p> In the CORE URL box, you may enter one of the following:</p>
        <Links />
        <p>
          Please note that the form does not accept links which start with
          &quot;https://core.ac.uk/<strong>search</strong>&quot; and
          &quot;https://core.ac.uk/<strong>works</strong>&quot;.
        </p>
      </section>
      <div className={classNames.use(styles.note, styles.container)} />
      <section className={classNames.use(styles.faq, styles.container)}>
        <img src={faqSVG} alt="faq" />
        <p>
          You can find out more information about deleting articles in the
          &nbsp;
          <Link href="https://core.ac.uk/faq">
            &quot;Removing full text or metadata&quot;
          </Link>
          &nbsp;section of the FAQs.
        </p>
      </section>
      {isModalReportTypeActive && <ReportTypeModal />}
      {isModalReportFormActive && <ReportFormModal id={id} />}
      {isModalReportSuccessActive && (
        <ReportSuccessModal dataProvider={dataProvider.name} id={id} />
      )}
    </>
  )
})

export default UpdateTemplate
