import flattenClassList from 'classnames'

const useModule = (className, module) => {
  if (typeof className != 'string') return className

  return className
    .split(' ')
    .map((name) =>
      Object.prototype.hasOwnProperty.call(module, name) ? module[name] : name
    )
    .join(' ')
}

class ClassNames {
  classList = []

  module = {}

  use(...classList) {
    const classNames = classList.map((c) => {
      if (c instanceof ClassNames) return c.toString()
      return c
    })

    this.classList.push(...classNames)
    return this
  }

  from(module) {
    Object.assign(this.module, module)
    return this
  }

  join(className) {
    if (className instanceof ClassNames) this.appendix = className.toString()
    else this.appendix = className
    return this
  }

  toString() {
    return [
      useModule(flattenClassList(this.classList), this.module),
      this.appendix,
    ]
      .filter((s) => s)
      .join(' ')
  }
}

const use = (...args) => new ClassNames().use(...args)
const from = (...args) => new ClassNames().from(...args)

ClassNames.use = use
ClassNames.from = from

export default ClassNames
export { use, from }
