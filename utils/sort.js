/* eslint-disable no-nested-ternary */
export const changeIndex = (input, from, to) => {
  let numberOfDeletedElm = 1
  const elm = input.splice(from, numberOfDeletedElm)[0]
  numberOfDeletedElm = 0
  input.splice(to, numberOfDeletedElm, elm)
  return input
}

export const sortItemsByNumberDesc = (array, number) =>
  array.sort((a, b) => b[number] - a[number])

export const sortItemsByNumberAsc = (array, number) =>
  array.sort((a, b) => b[number] + a[number])

export const sortItemsByBoolean = (array, boolean) =>
  array.sort((a, b) => (a[boolean] === b[boolean] ? 0 : a[boolean] ? -1 : 1))

export const sortItemsByAlphabet = (array, key) =>
  array.sort((a, b) => a[key].localeCompare(b[key]))

export const sortItemsByValueIndex = (initArray, valueArray, key) =>
  initArray.sort(
    (a, b) => valueArray.indexOf(a[key]) - valueArray.indexOf(b[key])
  )

/* For filters */
export const setItemFirst = (array) => {
  const foundedIndex = array.findIndex((i) => i.value === 'unknown')

  if (foundedIndex >= 0) changeIndex(array, foundedIndex, 0)
}
