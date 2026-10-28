"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = hasMathMLSupport;
function hasMathMLSupport() {
  if (typeof document === 'undefined') return true;
  var div = document.createElement('div');
  div.innerHTML = '<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>' + '<math><mn>1</mn></math>';
  document.body.appendChild(div);
  var res = div.firstElementChild.firstElementChild.getBoundingClientRect().height > div.lastElementChild.firstElementChild.getBoundingClientRect().height + 1;
  document.body.removeChild(div);
  return res;
}