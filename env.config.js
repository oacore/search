const NODE_ENV = process.env.NODE_ENV || 'development'
const APP_ENV = process.env.APP_ENV || NODE_ENV

const local = {
  API_URL: 'http://127.0.0.1:8000/internal',
}

const development = {
  API_URL: 'https://api-stg.core.ac.uk/internal',
}

const staging = {
  API_URL: 'https://api-stg.core.ac.uk/internal',
}

const production = {
  API_URL: 'https://api.core.ac.uk/internal',
}

const validate = (config) =>
  ['API_URL', 'API_KEY'].forEach((param) => {
    if (config[param] == null) throw new Error(`${param} is not configured.`)
  })

const env = { local, development, staging, production }
const config = {
  ...env.production,
  ...(env[APP_ENV] || {}),
  API_KEY: process.env.API_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  GA_TRACKING_CODE: process.env.GA_TRACKING_CODE,
  BUILD_TARGET: process.env.BUILD_TARGET,
}

validate(config)
module.exports = config
