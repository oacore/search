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
    // React 19 renders this update before the microtask in which a closing modal's focus lock returns the
    // focus, so the next modal's lock would record the removed button; one microtask later it records the
    // returned focus, as on React 17/18 (CS-R19-8)
    var active = true;
    Promise.resolve().then(function () {
      if (active) setMounted(true);
    });
    return function () {
      active = false;
    };
  }, []);
  return mounted ? /*#__PURE__*/(0, _reactDom.createPortal)(children, ref.current) : null;
};
var _default = ModalPortal;
exports["default"] = _default;