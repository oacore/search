const lenghtWord = 3
const additionalTopics = ['OU', 'EU']

// Set unique items in array
function uniqElementsArray(a = []) {
  return a.sort().filter((item, pos, ary) => !pos || item !== ary[pos - 1])
}

// Return items from `title` which are match with `similarOutputs`
const topics = (title, similarOutputs = []) => {
  const titleArray = title.split(' ')
  const topicsTitle = titleArray
    .filter((item) => {
      if (item.length > lenghtWord) return item
      return false
    })
    .concat(additionalTopics)

  const topicsResult = similarOutputs.map((item) => {
    const titleOutputsArray = item.title.split(' ')
    // eslint-disable-next-line no-shadow
    const topicsSimilarOutputs = titleOutputsArray.filter((item) => {
      if (item.length > lenghtWord && topicsTitle.includes(item)) return item
      return false
    })

    return topicsSimilarOutputs
  })

  // eslint-disable-next-line prefer-spread
  const topicsResultMerged = [].concat.apply([], topicsResult)

  return uniqElementsArray(topicsResultMerged)
}

export default topics
