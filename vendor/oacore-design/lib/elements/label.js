"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _utils = require("../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "color", "className", "tag"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var labelStyles = {
  "label": "label-label-12KH4",
  "primary": "label-primary-mmSg6",
  "success": "label-success-128QI",
  "danger": "label-danger-fAs6T"
};
var Label = function Label(_ref) {
  var children = _ref.children,
    _ref$color = _ref.color,
    color = _ref$color === void 0 ? 'default' : _ref$color,
    className = _ref.className,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'mark' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use('label', color !== 'default' && color, className).from(labelStyles)
  }, restProps), {}, {
    children: children
  }));
};
Label.displayName = "Label";
Label.propTypes = {
  color: _propTypes["default"].oneOf(['default', 'primary', 'success', 'danger'])
};
var _default = Label;
exports["default"] = _default;