import { observable } from 'mobx'

const validate = (keySchema, value) => {
  if (typeof keySchema.validation === 'function')
    return keySchema.validation(value)

  if (keySchema.validation === 'number') return Number.isInteger(value)

  return true
}

const convert = (keySchema, value) => {
  if (typeof keySchema.convert === 'function') return keySchema.convert(value)

  return value
}

class Params {
  @observable paramsMap = new Map()

  schema

  constructor(params, schema) {
    this.paramsSchema = params
    this.schema = schema
    const proxyParams = new Proxy(this.paramsMap, {
      set: (object, key, value) => {
        if (key in this.schema) {
          const keySchema = this.schema[key]
          let keyValue = value

          try {
            keyValue = convert(keySchema, keyValue)
            if (!validate(keySchema, keyValue)) keyValue = keySchema.default
          } catch (error) {
            keyValue = keySchema.default
          }

          object.set(key, keyValue)
          return true
        }

        if (process.env.NODE_ENV === 'development') {
          console.error(
            `Trying to access non-existing property ${key} on Params Proxy`
          )
        }
        return false
      },
      get: (object, key) => {
        if (typeof object[key] === 'function')
          return (...args) => Reflect.apply(object[key], object, args)

        return object.get(key)
      },
    })

    Object.entries(schema).forEach(([key, value]) => {
      if (key in params) proxyParams[key] = params[key]
      else proxyParams[key] = value.default
    })

    return proxyParams
  }
}

export default Params
