"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className", "value", "max"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "spinner": "styles-spinner-3zm_K",
  "indeterminate": "styles-indeterminate-24wOy",
  "rotate": "styles-rotate-z1bpa",
  "dash": "styles-dash-3eBVm"
};
var progressValues = function progressValues(value, max) {
  var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
    _ref$radius = _ref.radius,
    radius = _ref$radius === void 0 ? 9 : _ref$radius;
  if (value == null) return null;
  var length = Math.round(2 * Math.PI * radius);
  var filled = Math.min(Math.round(value / max * length), length);
  var empty = length - filled;
  return [filled, empty].join(' ');
};
var ProgressSpinner = /*#__PURE__*/(0, _react.forwardRef)(function (_ref2, ref) {
  var children = _ref2.children,
    className = _ref2.className,
    value = _ref2.value,
    _ref2$max = _ref2.max,
    max = _ref2$max === void 0 ? 1.0 : _ref2$max,
    htmlProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("svg", _objectSpread(_objectSpread({
    ref: ref,
    className: _utils.classNames.use(styles.spinner, value == null && styles.indeterminate).join(className),
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg"
  }, htmlProps), {}, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("circle", {
      strokeWidth: "2",
      strokeLinecap: "butt",
      strokeDasharray: progressValues(value, max),
      cx: "12",
      cy: "12",
      r: "9"
    }), children]
  }));
});
var _default = ProgressSpinner;
exports["default"] = _default;