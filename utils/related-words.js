const lenghtWordLimit = 3
const topicsInclude = ['OU', 'EU']
const topicsExclude = ['with']

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
  titleArray.forEach((item, index, array) => {
    if (item.length > lenghtWordLimit) {
      topicsTitle[i] = item
      i++
      if (array[index + 1]) {
        topicsTitle[i] = `${item} ${array[index + 1]}`
        i++
      }
      return item
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

  return uniqElementsArray(topicsResultMerged)
}

export default relatedWords
