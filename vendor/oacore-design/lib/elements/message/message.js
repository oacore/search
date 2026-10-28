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
var _excluded = ["children", "className", "variant", "tag", "fill"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "message": "message-message-1Phba",
  "success": "message-success-lj-3w",
  "warning": "message-warning-3Jeo3",
  "danger": "message-danger-3S8ZE",
  "fill": "message-fill-2beF5"
};
var Message = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var children = _ref.children,
    className = _ref.className,
    variant = _ref.variant,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'p' : _ref$tag,
    _ref$fill = _ref.fill,
    fill = _ref$fill === void 0 ? false : _ref$fill,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    ref: ref,
    className: _utils.classNames.use('message', variant, fill && 'fill').from(styles).join(className)
  }, restProps), {}, {
    children: children
  }));
});
Message.propTypes = {
  /**
   * Defines color scheme of the message
   */
  variant: _propTypes["default"].oneOf(['success', 'warning', 'danger']),
  /**
   * Indicates whether message should have colored or transparent background
   */
  fill: _propTypes["default"].bool
};
var _default = Message;
exports["default"] = _default;