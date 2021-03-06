import { action, makeObservable, extendObservable } from 'mobx'

import { convertAndValidate } from 'utils/validation'

class Params {
  schema

  constructor(params, schema) {
    this.schema = schema

    makeObservable(this, {
      changeParams: action,
    })

    extendObservable(this, convertAndValidate({ schema, params }))
  }

  changeParams({ ...params }) {
    const { schema, ...assignedParams } = this

    const newParams = convertAndValidate({
      schema: this.schema,
      params: {
        ...assignedParams,
        ...params,
      },
    })
    Object.assign(this, newParams)
  }
}

export default Params
