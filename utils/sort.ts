/* eslint-disable no-nested-ternary */
export const changeIndex = (input?: any, from?: any, to?: any) => {
  let numberOfDeletedElm = 1
  const elm = input.splice(from, numberOfDeletedElm)[0]
  numberOfDeletedElm = 0
  input.splice(to, numberOfDeletedElm, elm)
  return input
}

export const sortItemsByNumberDesc = (array?: any, number?: any) =>
  array.sort((a: any, b: any) => b[number] - a[number])

export const sortItemsByNumberAsc = (array?: any, number?: any) =>
  array.sort((a: any, b: any) => b[number] + a[number])

export const sortItemsByBoolean = (array?: any, boolean?: any) =>
  array.sort((a: any, b: any) =>
    a[boolean] === b[boolean] ? 0 : a[boolean] ? -1 : 1
  )

export const sortItemsByAlphabet = (array?: any, key?: any) =>
  array.sort((a: any, b: any) => a[key].localeCompare(b[key]))

export const sortItemsByValueIndex = (
  initArray?: any,
  valueArray?: any,
  key?: any
) =>
  initArray.sort(
    (a: any, b: any) => valueArray.indexOf(a[key]) - valueArray.indexOf(b[key])
  )

/* For filters */
export const setItemFirst = (array?: any) => {
  const foundedIndex = array.findIndex((i: any) => i.value === 'unknown')

  if (foundedIndex >= 0) changeIndex(array, foundedIndex, 0)
}
