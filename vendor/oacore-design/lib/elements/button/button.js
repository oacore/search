"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _propTypes = _interopRequireDefault(require("prop-types"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className", "variant", "href", "tag"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var buttonClassNames = {
  "focus": "button-focus-2aHkR",
  "disabled": "button-disabled-UF4K5",
  "active": "button-active-2mAdF",
  "button": "button-button-3fr3r",
  "text": "button-text-2Jjil",
  "outlined": "button-outlined-3dJXM",
  "contained": "button-contained-pmIp-"
};
var Button = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var children = _ref.children,
    className = _ref.className,
    _ref$variant = _ref.variant,
    variant = _ref$variant === void 0 ? 'text' : _ref$variant,
    href = _ref.href,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? href ? 'a' : 'button' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    ref: ref,
    className: _utils.classNames.use('button', variant).from(buttonClassNames).join(className),
    href: href
  }, restProps), {}, {
    children: children
  }));
});
Button.propTypes = {
  variant: _propTypes["default"].oneOf(['text', 'outlined', 'contained']),
  href: _propTypes["default"].string
};
var _default = Button;
exports["default"] = _default;