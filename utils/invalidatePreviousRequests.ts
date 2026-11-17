// invalidatePreviousRequests(fn) returns a wrapper with one AbortController
// per wrapped function, shared by every caller (the zustand stores wrap their
// actions at module scope). Each call aborts the previous call's controller
// and passes a fresh signal after the caller's arguments (Q-020).
// Called as the legacy method decorator of the MobX stores, (target, key,
// descriptor), it puts that wrapper around the method: one per decorated
// method, shared by all instances of the class.
const wrap = (originalMethod?: any) => {
  let controller: any

  return function decorator(this: any, ...args: any[]) {
    if (controller) controller.abort()
    controller =
      typeof AbortController != 'undefined' ? new AbortController() : null

    return originalMethod.call(this, ...args, controller?.signal)
  }
}

export default function invalidate(
  target?: any,
  propertyKey?: any,
  descriptor?: any
) {
  if (!descriptor) return wrap(target)

  descriptor.value = wrap(descriptor.value)

  return descriptor
}
