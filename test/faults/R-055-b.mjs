// R-055-b: an unhandled rejection ends the server process with exit code 1
import { crashProbe } from './R-055-crash.mjs'

export default async ({ env }) => {
  try {
    const rejection = await crashProbe(env, 'rejection')
    return !rejection.error && rejection.exited && rejection.code === 1
  } catch (error) {
    console.error(`R-055-b: ${error.message}`)
    return false
  }
}
