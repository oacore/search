import React from 'react'
import { Link, Button, TextField } from '@oacore/design/lib'

import Links from './links'
import styles from './styles.module.css'
import faqSVG from './images/faq.svg'
import takedownSVG from './images/takedown.svg'

const UpdateTemplate = () => (
  <div className={styles.container}>
    <section className={styles.header}>
      <h2 className="display">Article Update/Takedown Request </h2>
      <img src={takedownSVG} alt="takedown" />
    </section>
    <section className={styles.update}>
      <div className={styles.updateDescription}>
        <p>
          To update or remove a paper from CORE, please search for the paper
          using the search box at the top of this page.
        </p>
        <p>
          When you have found the paper, please enter the URL of the paper from
          CORE into the form on the right and we will redirect you to the
          correct page.
        </p>
      </div>
      <div className={styles.updateLink}>
        <p>Put link to the article here:</p>
        <TextField
          id="url"
          name="url"
          label="CORE URL"
          placeholder="e.g. https://core.ac.uk/display/1"
        />
        <Button variant="contained">SUBMIT UPDATE</Button>
      </div>
    </section>
    <section className={styles.links}>
      <h4 className="display">
        Types of links you can use to fill up the Core URL field
      </h4>
      <p>
        For example, suppose you wanted to remove the paper: &nbsp;
        <Link href="https://core.ac.uk/display/82976757?recSetID=">
          CORE: aggregation use cases for open access
        </Link>
      </p>
      <p> In the CORE URL box, you may enter one of the following:</p>
      <Links />
    </section>
    <p className={styles.note}>
      Please note that the form does not accept links which start with
      &quot;https://core.ac.uk/<strong>search</strong> &quot;.
    </p>
    <section className={styles.faq}>
      <img src={faqSVG} alt="faq" />
      <p>
        You can find out more informations about updating/deleting articles in
        the &nbsp;
        <Link href="https://core.ac.uk/faq">
          &quot;Removing full text or metadata&quot;
        </Link>
        &nbsp;section of the FAQ.
      </p>
    </section>
  </div>
)

export default UpdateTemplate
