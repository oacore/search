"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = require("react");
var _reactDom = require("react-dom");
var ModalPortal = function ModalPortal(_ref) {
  var children = _ref.children;
  var ref = (0, _react.useRef)();
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    mounted = _useState2[0],
    setMounted = _useState2[1];
  (0, _react.useEffect)(function () {
    var _document$getElementB;
    var modalRoot = (_document$getElementB = document.getElementById('modal-root')) !== null && _document$getElementB !== void 0 ? _document$getElementB : document.querySelector('body').appendChild(document.createElement('div'));
    modalRoot.id = 'modal-root';
    ref.current = modalRoot;
    setMounted(true);
  }, []);
  return mounted ? /*#__PURE__*/(0, _reactDom.createPortal)(children, ref.current) : null;
};
var _default = ModalPortal;
exports["default"] = _default;