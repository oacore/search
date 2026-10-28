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
var _excluded = ["place", "className", "children", "tag"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "label": "styles-label-3Zc32",
  "control": "styles-control-12Pze",
  "addon": "styles-addon-fHX-H",
  "prepend": "styles-prepend-3yZWC",
  "append": "styles-append-2Bs2q",
  "focus": "styles-focus-29vz3",
  "group": "styles-group-NqOA7"
};
var Addon = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var _ref$place = _ref.place,
    place = _ref$place === void 0 ? 'append' : _ref$place,
    className = _ref.className,
    children = _ref.children,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'span' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    ref: ref,
    className: _utils.classNames.use(styles.addon, styles[place]).join(className)
  }, restProps), {}, {
    children: children
  }));
});
Addon.propTypes = {
  place: _propTypes["default"].oneOf(['append', 'prepend'])
};
var _default = Addon;
exports["default"] = _default;