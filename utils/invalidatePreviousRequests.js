export default function invalidate(target, propertyKey, descriptor) {
  const { value: originalMethod } = descriptor
  let controller

  descriptor.value = function decorator(...args) {
    if (controller) controller.abort()
    controller =
      typeof AbortController != 'undefined' ? new AbortController() : null

    return originalMethod.call(this, ...args, controller?.signal)
  }

  return descriptor
}
