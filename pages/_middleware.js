import { NextResponse } from 'next'

// eslint-disable-next-line import/prefer-default-export
export function middleware(req) {
  console.log(req.nextUrl.href
    )
  if (req.nextUrl.href.includes('/myprefix/_next/')) {
    return NextResponse.rewrite(
      req.nextUrl.href.replace('/myprefix/_next/', '/_next/')
    )
  }

  return null
}
