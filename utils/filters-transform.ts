import languagesData from '../data/languages.json'
import { sortItemsByValueIndex } from './sort'

export const checkActiveItems = (filters?: any) => {
  const isActiveItems = filters
    .filter((filter: any) => filter.label !== 'sort by')
    .find((filter: any) =>
      filter.items.find((item: any) => item.checked === true)
    )

  return isActiveItems
}

const setFilterLabels = (value?: any) => {
  let label = ''

  switch (value) {
    case 'fieldsOfStudy': {
      label = 'field'
      break
    }
    case 'documentType': {
      label = 'type'
      break
    }

    case 'yearPublished': {
      label = 'year'
      break
    }

    case 'authors': {
      label = 'author'
      break
    }

    default: {
      label = value
    }
  }
  return label
}

const transformFiltersData = (
  initialObject?: any,
  newObject?: any,
  labelValues?: any,
  query?: any
) => {
  const isObject = (val?: any) => typeof val === 'object' && val // required for "null" comparison

  // eslint-disable-next-line no-param-reassign
  if (!newObject) newObject = JSON.parse(JSON.stringify(initialObject))

  function compare(obj1: any = {}, obj2: any = {}) {
    const output: any = {}
    const merged = { ...obj1, ...obj2 }
    Object.keys(merged).map((key: any) => {
      const value1 = obj1[key]
      const value2 = obj2[key]

      if (isObject(value1) || isObject(value2))
        output[key] = compare(value1, value2)
      else output[key] = value2 || 0

      return output
    })

    return output
  }

  const comparedData = compare(initialObject, newObject)

  const arrayOfObj = Object.entries(comparedData)
    .map((e: any) => ({
      value: e[0],
      items: e[1],
    }))
    .map((filter: any) => ({ ...filter, label: setFilterLabels(filter.value) }))

  const filters = arrayOfObj.map((obj: any) => {
    const items = Object.entries(obj.items).map((e: any) => ({
      value: e[0].replace(/['"]+/g, ''),
      count: e[1],
    }))

    return {
      ...obj,
      items,
    }
  })

  sortItemsByValueIndex(filters, labelValues, 'value')
  filters
    .find((item: any) => item.value === 'language')
    .items.map((filter: any) => {
      filter.code = filter.value
      const founded = languagesData.find(
        (language: any) => language.code === filter.code.toLowerCase()
      )

      if (founded) filter.value = founded.name

      return filter.value
    })

  const founded = filters.find((item: any) => item.value === 'yearPublished')
  if (founded) {
    founded.items.map((filter: any) => {
      filter.value = parseInt(filter.value, 10)
      return filter
    })
  }

  filters.map((filter: any) => {
    filter.items = filter.items.map((item: any) => ({
      ...item,
      checked:
        item.value.toString() !== '' &&
        (query.includes(item.value.toString()) ||
          query.includes(`"${item.code}"`)),
    }))

    return filter
  })

  return filters
}

export default transformFiltersData
