const lenghtWordLimit = 3
const topicsInclude = ['OU', 'EU', 'SNP']

// Set unique items in array
function uniqElementsArray(a = []) {
  return a.sort().filter((item, pos, ary) => !pos || item !== ary[pos - 1])
}

// Return items from `title` which are match with `similarOutputs`
const relatedWords = (title, similarOutputs = []) => {
  const cleanTitle = title.replace(/['"`“”,.!:]+/g, '')
  const titleArray = cleanTitle.split(' ')

  const topicsTitle = []
  let i = 0
  // eslint-disable-next-line consistent-return
  titleArray.forEach((item, index, array) => {
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

  const topicsResult = similarOutputs.map((item) => {
    const titleOutputsArray = item.title.split(' ')
    // eslint-disable-next-line no-shadow
    const topicsSimilarOutputs = titleOutputsArray.filter((item) => {
      if (item.length > lenghtWordLimit && topicsTitle.includes(item))
        return item
      return false
    })

    return topicsSimilarOutputs
  })

  // eslint-disable-next-line prefer-spread
  const topicsResultMerged = [].concat.apply([], topicsResult)

  const uniqResilt = uniqElementsArray(topicsResultMerged)
  return uniqResilt.length > 0 ? uniqResilt : [0]
}

export default relatedWords
