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
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "label", "id", "className", "itemProp", "itemScope", "itemType"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "list": "metadata-list-list-3uNb8",
  "group": "metadata-list-group-1lOSg",
  "empty": "metadata-list-empty-1hpLJ"
};
var MetaDataListItem = function MetaDataListItem(_ref) {
  var children = _ref.children,
    label = _ref.label,
    id = _ref.id,
    className = _ref.className,
    _ref$itemProp = _ref.itemProp,
    itemProp = _ref$itemProp === void 0 ? null : _ref$itemProp,
    _ref$itemScope = _ref.itemScope,
    itemScope = _ref$itemScope === void 0 ? null : _ref$itemScope,
    _ref$itemType = _ref.itemType,
    itemType = _ref$itemType === void 0 ? null : _ref$itemType,
    htmlProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.group, children == null && styles.empty).join(className)
  }, htmlProps), {}, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("dt", {
      id: "".concat(id, "-title"),
      children: label
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("dd", {
      "aria-labelledby": "".concat(id, "-title"),
      itemProp: itemProp,
      itemScope: itemScope,
      itemType: itemType,
      children: children
    })]
  }));
};
MetaDataListItem.displayName = "MetaDataListItem";
MetaDataListItem.displayName = 'MetaDataList.Item';
MetaDataListItem.propTypes = {
  /**
   * Unique identifier
   */
  id: _propTypes["default"].string.isRequired,
  /**
   *  Description of the item
   */
  label: _propTypes["default"].string.isRequired,
  /**
   * Microdata of the item
   */
  itemProp: _propTypes["default"].string,
  /**
   *  Microdata of the item
   */
  itemScope: _propTypes["default"].string,
  /**
   *  Microdata of the item
   */
  itemType: _propTypes["default"].string
};
var _default = MetaDataListItem;
exports["default"] = _default;