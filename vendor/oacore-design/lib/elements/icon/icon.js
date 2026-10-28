"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _config = _interopRequireDefault(require("../../config"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["src", "alt", "className"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var iconClassNames = {
  "icon": "icon-icon-35iz-"
};
var resolve = function resolve(url) {
  return _config["default"].iconsPublicPath != null && url && url.toString().charAt() === '#' ? "".concat(_config["default"].iconsPublicPath).concat(url) : url;
};

/**
 * The component creates an inline SVG image based on
 * `src` and `alt` attributes.
 */
var Icon = function Icon(_ref) {
  var src = _ref.src,
    alt = _ref.alt,
    className = _ref.className,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("svg", _objectSpread(_objectSpread({
    className: _utils.classNames.use(iconClassNames.icon).join(className),
    role: "img",
    "aria-label": alt,
    width: "24",
    height: "24"
  }, restProps), {}, {
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)("use", {
      href: resolve(src)
    })
  }));
};
Icon.displayName = "Icon";
Icon.propTypes = {
  /**
   * Icon location
   *
   * It can be either an icon reference to a sprite, e.g. `#alert`
   * or full icon path for any other icon.
   */
  src: _propTypes["default"].string.isRequired,
  /**
   * Alternative text for accessibility
   */
  alt: _propTypes["default"].string
};
var _default = Icon;
exports["default"] = _default;