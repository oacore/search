import languagesData from '../data/languages.json'
import { sortItemsByValueIndex } from './sort'

export const checkActiveItems = (filters) => {
  const isActiveItems = filters
    .filter((filter) => filter.label !== 'sort by')
    .find((filter) => filter.items.find((item) => item.checked === true))

  return isActiveItems
}

const setFilterLabels = (value) => {
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

const transformFiltersData = (initialObject, newObject, labelValues, query) => {
  const isObject = (val) => typeof val === 'object' && val // required for "null" comparison

  // eslint-disable-next-line no-param-reassign
  if (!newObject) newObject = JSON.parse(JSON.stringify(initialObject))

  function compare(obj1 = {}, obj2 = {}) {
    const output = {}
    const merged = { ...obj1, ...obj2 }
    Object.keys(merged).map((key) => {
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
    .map((e) => ({
      value: e[0],
      items: e[1],
    }))
    .map((filter) => ({ ...filter, label: setFilterLabels(filter.value) }))

  const filters = arrayOfObj.map((obj) => {
    const items = Object.entries(obj.items).map((e) => ({
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
    .find((item) => item.value === 'language')
    .items.map((filter) => {
      filter.code = filter.value
      const founded = languagesData.find(
        (language) => language.code === filter.code.toLowerCase()
      )

      if (founded) filter.value = founded.name

      return filter.value
    })

  const founded = filters.find((item) => item.value === 'yearPublished')
  if (founded) {
    founded.items.map((filter) => {
      filter.value = parseInt(filter.value, 10)
      return filter
    })
  }

  filters.map((filter) => {
    filter.items = filter.items.map((item) => ({
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
