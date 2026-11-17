// asset imports: CSS modules are class maps; global CSS has no exports;
// images are URL strings (next-images)
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
declare module '*.css'
declare module '*.svg' {
  const src: string
  export default src
}
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.gif' {
  const src: string
  export default src
}
