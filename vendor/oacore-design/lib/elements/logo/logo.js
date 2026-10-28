"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _icon = _interopRequireDefault(require("../icon"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className", "src", "alt", "tag"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "logo": "logo-logo-wCAGq",
  "logo-icon": "logo-logo-icon-1JnTB",
  "logoIcon": "logo-logo-icon-1JnTB"
};
var Logo = /*#__PURE__*/(0, _react.memo)(function (_ref) {
  var _ref$children = _ref.children,
    children = _ref$children === void 0 ? 'CORE' : _ref$children,
    className = _ref.className,
    _ref$src = _ref.src,
    src = _ref$src === void 0 ? '#core-symbol' : _ref$src,
    _ref$alt = _ref.alt,
    alt = _ref$alt === void 0 ? 'CORE' : _ref$alt,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'span' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.logo).join(className)
  }, restProps), {}, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
      src: src,
      alt: alt,
      className: styles.logoIcon,
      width: "18",
      height: "24"
    }), children]
  }));
});
var _default = Logo;
exports["default"] = _default;