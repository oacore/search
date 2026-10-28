"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _react = _interopRequireDefault(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _icon = _interopRequireDefault(require("../icon/icon"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var styles = {
  "circle": "data-provider-circle-1YXHk",
  "image": "data-provider-image-2JFrU",
  "sm": "data-provider-sm-6ZNTy",
  "md": "data-provider-md-1r-YM",
  "ml": "data-provider-ml-3ZrV-",
  "lg": "data-provider-lg-1dRNT",
  "hidden": "data-provider-hidden-AS7Ey"
};
var DataProviderLogo = function DataProviderLogo(_ref) {
  var _classNames$use;
  var alt = _ref.alt,
    imageSrc = _ref.imageSrc,
    _ref$size = _ref.size,
    size = _ref$size === void 0 ? 'md' : _ref$size,
    _ref$useDefault = _ref.useDefault,
    useDefault = _ref$useDefault === void 0 ? true : _ref$useDefault,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'div' : _ref$tag,
    className = _ref.className;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, {
    className: _utils.classNames.use(styles[size], (_classNames$use = {}, (0, _defineProperty2["default"])(_classNames$use, styles.hidden, !useDefault), (0, _defineProperty2["default"])(_classNames$use, styles.circle, useDefault), _classNames$use)).join(className),
    children: imageSrc ? /*#__PURE__*/(0, _jsxRuntime.jsx)("img", {
      src: imageSrc,
      alt: alt,
      className: styles.image
    }) : /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
      src: "#office-building",
      className: _utils.classNames.use(styles.image)
    })
  });
};
DataProviderLogo.displayName = "DataProviderLogo";
DataProviderLogo.propTypes = {
  alt: _propTypes["default"].string.isRequired,
  imageSrc: _propTypes["default"].string,
  size: _propTypes["default"].oneOf(['md', 'sm', 'ml', 'lg']),
  /* Pass true if you want to use default icon */
  useDefault: _propTypes["default"].bool
};
var _default = DataProviderLogo;
exports["default"] = _default;