import React from 'react'

// An element of a design card that shows `keptClass` instead of the card's own
// classes while it is set (null: no class attribute), staying in the DOM.
const kept =
  (Tag?: any) =>
  ({ keptClass, className, ...passProps }: any) => (
    <Tag
      className={keptClass === undefined ? className : keptClass}
      {...passProps}
    />
  )

export const KeptDiv = kept('div')
export const KeptP = kept('p')
