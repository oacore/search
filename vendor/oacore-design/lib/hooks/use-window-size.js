"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = useWindowSize;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireDefault(require("react"));
function useWindowSize() {
  var _React$useState = _react["default"].useState({
      width: undefined,
      height: undefined
    }),
    _React$useState2 = (0, _slicedToArray2["default"])(_React$useState, 2),
    windowSize = _React$useState2[0],
    setWindowSize = _React$useState2[1];
  function changeWindowSize() {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  // eslint-disable-next-line consistent-return
  _react["default"].useEffect(function () {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', changeWindowSize);
      changeWindowSize();
      return function () {
        window.removeEventListener('resize', changeWindowSize);
      };
    }
  }, []);
  return windowSize;
}