export const UPDATE_OPTIONS = [
  {
    id: 1,
    label: 'The document should not be published',
    operation: 'takeDownFullText',
  },
  {
    id: 2,
    label: 'The document is outdated',
    operation: 'issueWithContent',
  },
]

export const ROLES = [
  {
    id: 1,
    label: 'Repository manager',
    role: 'repositoryManager',
  },
  {
    id: 2,
    label: 'Author',
    role: 'author',
  },
  {
    id: 3,
    label: 'Other',
    role: 'other',
  },
]
