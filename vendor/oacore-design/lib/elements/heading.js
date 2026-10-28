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
var _excluded = ["children", "className", "level", "display", "tag"];
/**
 * Heading component is a simple wrapper around standard HTML headings.
 */
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var Heading = function Heading(_ref) {
  var children = _ref.children,
    className = _ref.className,
    level = _ref.level,
    _ref$display = _ref.display,
    display = _ref$display === void 0 ? false : _ref$display,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? "h".concat(level) : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use({
      display: display
    }, className)
  }, restProps), {}, {
    children: children
  }));
};
Heading.displayName = "Heading";
Heading.propTypes = {
  /**
   * An integer between 1 and 6 (including) to calculate the tag.
   * NOTE: If `tag` prop is passed, `level` will be ignored.
   */
  level: _propTypes["default"].oneOf([1, 2, 3, 4, 5, 6, '1', '2', '3', '4', '5', '6']),
  /**
   * A toggle for display mode.
   */
  display: _propTypes["default"].bool
};
var _default = Heading;
exports["default"] = _default;