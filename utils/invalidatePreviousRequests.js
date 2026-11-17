// invalidatePreviousRequests(fn): a wrapper with one AbortController per
// wrapped function, shared by every caller (the zustand stores wrap their
// actions at module scope). Each call aborts the previous call's controller
// and passes a fresh signal after the caller's arguments (Q-020).
export const invalidatePreviousRequests = (originalMethod) => {
  let controller

  return function decorator(...args) {
    if (controller) controller.abort()
    controller =
      typeof AbortController != 'undefined' ? new AbortController() : null

    return originalMethod.call(this, ...args, controller?.signal)
  }
}

// the legacy method decorator of the MobX stores: the same wrapper, one per
// decorated method (shared by all instances of the class)
export default function invalidate(target, propertyKey, descriptor) {
  descriptor.value = invalidatePreviousRequests(descriptor.value)

  return descriptor
}
