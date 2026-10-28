export default function hasMathMLSupport() {
  if (typeof document === 'undefined') return true

  const div = document.createElement('div')
  div.innerHTML =
    '<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>' +
    '<math><mn>1</mn></math>'
  document.body.appendChild(div)
  const res =
    div.firstElementChild.firstElementChild.getBoundingClientRect().height >
    div.lastElementChild.firstElementChild.getBoundingClientRect().height + 1
  document.body.removeChild(div)
  return res
}
