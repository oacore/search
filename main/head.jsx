import React from 'react'
import NextHead from 'next/head'

const Head = () => (
  <NextHead>
    <title>CORE Search</title>

    {['64', '128', '256', '512'].map((size) => (
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

export default Head
