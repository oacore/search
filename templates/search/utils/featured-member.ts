// Public production host — staging logo URLs hang in the browser.
export const getDataProviderLogoUrl = (repoId?: any) =>
  `https://api.core.ac.uk/data-providers/${repoId}/logo`

export const findMemberByRepoId = (members?: any, repoId?: any) =>
  members.find((item: any) => {
    if (Array.isArray(item.repo_id))
      return item.repo_id.map(Number).includes(Number(repoId))
    return Number(item.repo_id) === Number(repoId)
  })

export const pickFeaturedMember = (members?: any, preferredRepoId?: any) => {
  if (!Array.isArray(members) || !members.length) return null

  const matchedMember = findMemberByRepoId(members, preferredRepoId)
  if (matchedMember) return matchedMember

  const eligible = members.filter(
    (item: any) =>
      item.activated &&
      (item.billing_type === 'supporting' || item.billing_type === 'sustaining')
  )

  if (eligible.length)
    return eligible[Math.floor(Math.random() * eligible.length)]

  const activated = members.filter(
    (item: any) => item.activated && item.billing_type !== 'starting'
  )

  if (activated.length)
    return activated[Math.floor(Math.random() * activated.length)]

  return members[0]
}

export const getMemberRepoId = (member?: any) => {
  if (!member) return null
  if (Array.isArray(member.repo_id)) return member.repo_id.find(Boolean) ?? null
  return member.repo_id ?? null
}
