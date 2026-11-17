const lenghtWordLimit = 3
const topicsInclude = ['OU', 'EU', 'SNP']

// Set unique items in array
function uniqElementsArray(a: any = []) {
  return a
    .sort()
    .filter((item: any, pos: any, ary: any) => !pos || item !== ary[pos - 1])
}

// Return items from `title` which are match with `similarOutputs`
const relatedWords = (title?: any, similarOutputs: any = []) => {
  const cleanTitle = title.replace(/['"`“”,.!:]+/g, '')
  const titleArray = cleanTitle.split(' ')

  const topicsTitle: any[] = []
  let i = 0
  titleArray.forEach((item: any, index: any, array: any) => {
    if (
      item.length > lenghtWordLimit ||
      (item.length <= lenghtWordLimit && topicsInclude.includes(item))
    ) {
      topicsTitle[i] = item
      i += 1
      if (array[index + 1]) {
        topicsTitle[i] = `${item} ${array[index + 1]}`
        i += 1
      }
    }
  })

  const topicsResult: any[] = []
  i = 0
  similarOutputs.forEach((item: any) => {
    topicsTitle.forEach((topicsTitleItem: any) => {
      if (item.title.indexOf(topicsTitleItem) !== -1) {
        topicsResult[i] = topicsTitleItem
        i += 1
      }
    })
  })

  // eslint-disable-next-line prefer-spread
  const topicsResultMerged = [].concat.apply([], topicsResult)

  const uniqResilt = uniqElementsArray(topicsResultMerged)
  return uniqResilt.length > 0 ? uniqResilt : [0]
}

export default relatedWords
