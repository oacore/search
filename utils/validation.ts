const validate = (keySchema?: any, keyValue?: any) => {
  if (!keySchema) return true

  if (Array.isArray(keySchema.validation))
    return keySchema.validation.includes(keyValue)

  if (keySchema.validation === 'number') return Number.isInteger(keyValue)
  if (keySchema.validation === 'string') return typeof keyValue === 'string'

  return true
}

const convert = (keySchema?: any, keyValue?: any) => {
  if (!keySchema || keyValue === undefined) return keyValue

  if (keySchema.convert === 'number') return Number(keyValue)

  if (keySchema.convert === 'string') return keyValue.toString()

  return keyValue
}

const processKey = (keySchema?: any, keyValue?: any) => {
  const convertedValue = convert(keySchema, keyValue)
  if (validate(keySchema, convertedValue)) return convertedValue

  const defaultValue = keySchema.default
  if (defaultValue === undefined) {
    throw Error(
      `Value for schema ${keySchema} is invalid. Default value is not specified`
    )
  } else return defaultValue
}

export const convertAndValidate = ({ schema, params, key = null }: any) => {
  // request for validate specific key
  if (key) return processKey(schema[key], params[key])

  const schemaKeys = Object.keys(schema)

  // for the simplicity and our use-case we take all keys in schema
  // and process them, i.e. if params object contains any key
  // which is not specified in schema it gets removed.
  // At the same time if key we apply default values
  // if key is in schema but not in params
  return Object.fromEntries(
    schemaKeys.map((schemaKey: any) => [
      schemaKey,
      processKey(schema[schemaKey], params[schemaKey]),
    ])
  )
}

export default convertAndValidate
