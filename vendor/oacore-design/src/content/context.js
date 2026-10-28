import { createContext } from 'react'

const defaultContext = {
  level: 1,
  parentId: null,
}

const SectionContext = createContext(defaultContext)

export default SectionContext
export { defaultContext }
