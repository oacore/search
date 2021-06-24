import { Link } from '@oacore/design'
import React from 'react'

const searchUrlFor = (id) => `https://core.ac.uk/search?q=repositories.id:${id}`

const SUPPORT_EMAIL_URL = 'mailto:t%68%65t%65am%40core%2e%61c%2eu%6b'
const SUPPORT_EMAIL = decodeURIComponent(
  SUPPORT_EMAIL_URL.slice('mailto:'.length)
)

const generateFormMessage = ({ created, duplicated, error }) => {
  if (error) {
    return {
      helper: (
        <>
          We cannot detect a repository or a journal at this address. Please,
          provide the exact OAI-PMH endpoint. If you are having trouble contact
          us at <Link href={SUPPORT_EMAIL_URL}>{SUPPORT_EMAIL}</Link>.
        </>
      ),
      variant: 'error',
    }
  }

  if (created) {
    return {
      helper: (
          <>
          We found {created.name} under the entered address and added it to our
          data provider collection. As soon as we approve adding, we will start
          harvesting and sent a confirmation email to{' '}
          <Link
            href={`mailto:${created.email}`}
            title="the administrator email address"
          >
            {created.email}
          </Link>.
          Please consider adding our “harvested by CORE” logo {' '}
          <Link 
            href={harvestedByCore}
            title="Harvested by CORE Logo"            
          >
            on your website
          </Link>.
        </>
      ),
      variant: 'success',
    }
  }

  if (duplicated) {
    return {
      helper: (
        <>
          <a href={searchUrlFor(duplicated.existingDataProviders[0].id)}>
            {duplicated.existingDataProviders[0].name}
          </a>{' '}
          {duplicated.existingDataProviders.length > 1
            ? `and ${
                duplicated.existingDataProviders.length - 1
              } more are our data providers`
            : 'is our data provider'}{' '}
          already. If you host multiple repositories or journals on the same
          domain please specify exact OAI-PMH endpoint or contact us at{' '}
          <Link href={SUPPORT_EMAIL_URL}>{SUPPORT_EMAIL}</Link>.
        </>
      ),
      variant: 'error',
    }
  }

  return {
    helper: 'It can be any resource, home page or an OAI-PMH endpoint',
    variant: 'normal',
  }
}

export default generateFormMessage
