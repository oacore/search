import data from '../data/languages.json'
import sortFilterValues from '../modules/filters/utils/sort-filter-values'

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

const transformFiltersData = (initialObject, query) => {
  const arrayOfObj = Object.entries(initialObject)
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
  filters.push(sortFilterValues)

  filters
    .find((item) => item.value === 'language')
    .items.map((filter) => {
      filter.code = filter.value
      filter.value = data.find(
        (language) => language.code === filter.code.toLowerCase()
      ).name
      return filter
    })

  filters
    .find((item) => item.value === 'yearPublished')
    .items.map((filter) => {
      filter.value = parseInt(filter.value, 10)
      return filter
    })

  filters.map((filter) => {
    filter.items = filter.items.map((item) => ({
      ...item,
      checked:
        query.includes(item.value.toString()) ||
        query.includes(`"${item.code}"`),
    }))

    return filter
  })

  return filters
}

export default transformFiltersData
