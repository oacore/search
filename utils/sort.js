/* eslint-disable no-nested-ternary */
export const changeIndex = (input, from, to) => {
  let numberOfDeletedElm = 1

  const elm = input.splice(from, numberOfDeletedElm)[0]

  numberOfDeletedElm = 0

  input.splice(to, numberOfDeletedElm, elm)

  return input
}

export const sortItemsByNumber = (array, number) =>
  array.sort((a, b) => b[number] - a[number])

export const sortItemsByBoolean = (array, boolean) =>
  array.sort((a, b) => (a[boolean] === b[boolean] ? 0 : a[boolean] ? -1 : 1))

/* For filters */
export const setItemFirst = (array) => {
  const unclassifiedIndex = array.findIndex((i) => i.label === 'unclassified')

  if (unclassifiedIndex >= 0) changeIndex(array, unclassifiedIndex, 0)
}
