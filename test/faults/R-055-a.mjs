// R-055-a: one Sentry event per fatal condition (the integration only); the exit semantics are the SDK's
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
      rejection.sentry === 1 &&
      uncaught.exited &&
      uncaught.code === 1 &&
      uncaught.sentry === 1
    )
  } catch (error) {
    console.error(`R-055-a: ${error.message}`)
    return false
  }
}
