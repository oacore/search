import React from 'react'
import NextHead from 'next/head'

const Head = () => (
  <NextHead>
    <title>CORE – Aggregating the world’s open access research papers</title>

    {['64', '128', '256', '512'].map((size: any) => (
      <link
        key={size}
        rel="icon"
        type="image/png"
        sizes={`${size}x${size}`}
        href={`https://core.ac.uk/favicon/favicon-${size}px.png`}
      />
    ))}

    <link
      rel="icon"
      sizes="any"
      type="image/svg+xml"
      href="https://core.ac.uk/favicon/favicon.svg"
    />
  </NextHead>
)

// Next 12.3's head manager appends a <Head>'s children to the end of its list
// again after every render of that <Head>, and the last title wins. Rendered
// once, the default head keeps the first place it mounted in, so a page's
// title stays in force when the app re-renders and the page does not.
export default React.memo(Head)
