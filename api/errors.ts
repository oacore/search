/* eslint-disable max-classes-per-file */

class NetworkError extends Error {
  constructor(message?: any, response?: any) {
    super(message)
    this.name = this.constructor.name
    ;(this as any).response = response
  }
}

export class UnauthorizedError extends NetworkError {}
export class PaymentRequiredError extends NetworkError {}
export class ForbiddenError extends NetworkError {}
export class NotFoundError extends NetworkError {}
export class BadRequestError extends NetworkError {}
export class InternalServerError extends NetworkError {}
export class NotAcceptableError extends NetworkError {}

export const fromStatusCode = (statusCode?: any) => {
  if (statusCode === 401) return UnauthorizedError
  if (statusCode === 402) return PaymentRequiredError
  if (statusCode === 403) return ForbiddenError
  if (statusCode === 404) return NotFoundError
  if (statusCode === 406) return NotAcceptableError
  if (statusCode >= 400 && statusCode < 500) return BadRequestError
  if (statusCode >= 500) return InternalServerError
  return NetworkError
}

;(NetworkError as any).getErrorFromStatusCode = fromStatusCode

export default NetworkError
