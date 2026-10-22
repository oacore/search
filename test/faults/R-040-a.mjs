// R-040-a: a fatal condition in the server process reaches Sentry 0 times and does not end the process
import { crashProbe } from './R-055-crash.mjs'

export default async ({ env }) => {
  try {
    const rejection = await crashProbe(env, 'rejection')
    const uncaught = await crashProbe(env, 'uncaught')
    return (
      !rejection.error &&
      !uncaught.error &&
      !rejection.exited &&
      rejection.healthyAfter &&
      rejection.sentry === 0 &&
      !uncaught.exited &&
      uncaught.healthyAfter &&
      uncaught.sentry === 0
    )
  } catch (error) {
    console.error(`R-040-a: ${error.message}`)
    return false
  }
}
