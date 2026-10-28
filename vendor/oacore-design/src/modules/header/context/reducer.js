import HEADER_ACTIONS from './actions'

const reducer = (state, { type, payload }) => {
  switch (type) {
    case HEADER_ACTIONS.CONFIGURE_SEARCH_BAR:
      return {
        ...state,
        searchBar: {
          ...(state?.searchBar ?? {}),
          ...payload,
        },
      }
    case HEADER_ACTIONS.DISABLE_SEARCH_BAR:
      return {
        ...state,
        searchBar: null,
      }

    default:
      return state
  }
}

export default reducer
