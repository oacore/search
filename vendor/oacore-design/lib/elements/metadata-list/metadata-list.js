"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireDefault(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _metadataListItem = _interopRequireDefault(require("./metadata-list-item"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "list": "metadata-list-list-3uNb8",
  "group": "metadata-list-group-1lOSg",
  "empty": "metadata-list-empty-1hpLJ"
};
var MetadataList = function MetadataList(_ref) {
  var children = _ref.children,
    className = _ref.className,
    htmlProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("dl", _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.list).join(className)
  }, htmlProps), {}, {
    children: children
  }));
};
MetadataList.displayName = "MetadataList";
MetadataList.Item = _metadataListItem["default"];
MetadataList.propTypes = {
  /**
   *  Instance of `MetadataList.Item`
   */
  children: _propTypes["default"].node.isRequired,
  className: _propTypes["default"].oneOfType([_propTypes["default"].string, _propTypes["default"].instanceOf(_utils.classNames["default"])])
};
var _default = MetadataList;
exports["default"] = _default;