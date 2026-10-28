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
var _elements = require("../../elements");
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["id", "children", "selected", "icon", "className", "customValue"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "select-wrapper": "select-select-wrapper-3xVb5",
  "focused": "select-focused-3ml6f",
  "select-menu": "select-select-menu-EjIta",
  "option": "select-option-1DSs2",
  "option-icon": "select-option-icon-2R8pK",
  "option-selected": "select-option-selected-20QDg",
  "option-value": "select-option-value-1vWUd",
  "prepend-icon": "select-prepend-icon-2D41_",
  "append-icon": "select-append-icon-3UXMK",
  "append-text": "select-append-text-3PQA-",
  "clear-out-button": "select-clear-out-button-1XORg",
  "info-append-button": "select-info-append-button-1QUbQ",
  "show": "select-show-3H16k",
  "pure": "select-pure-2Pasv",
  "selectWrapper": "select-select-wrapper-3xVb5",
  "selectMenu": "select-select-menu-EjIta",
  "optionIcon": "select-option-icon-2R8pK",
  "optionSelected": "select-option-selected-20QDg",
  "optionValue": "select-option-value-1vWUd",
  "prependIcon": "select-prepend-icon-2D41_",
  "appendIcon": "select-append-icon-3UXMK",
  "appendText": "select-append-text-3PQA-",
  "clearOutButton": "select-clear-out-button-1XORg",
  "infoAppendButton": "select-info-append-button-1QUbQ"
};
var Option = /*#__PURE__*/(0, _react.memo)(function (_ref) {
  var _classNames$use;
  var id = _ref.id,
    children = _ref.children,
    selected = _ref.selected,
    icon = _ref.icon,
    className = _ref.className,
    customValue = _ref.customValue,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("li", _objectSpread(_objectSpread({
    id: id,
    role: "option",
    "aria-selected": selected,
    className: _utils.classNames.use((_classNames$use = {}, (0, _defineProperty2["default"])(_classNames$use, styles.option, true), (0, _defineProperty2["default"])(_classNames$use, styles.optionSelected, selected), _classNames$use)).join(className),
    tabIndex: "-1"
  }, restProps), {}, {
    children: [icon && /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
      className: styles.optionIcon,
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Icon, {
        src: icon
      })
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
      className: styles.optionValue,
      children: children
    })]
  }));
});
Option.displayName = 'SelectOption';
Option.propTypes = {
  /* Unique ID of option */
  id: _propTypes["default"].oneOfType([_propTypes["default"].string, _propTypes["default"].number]),
  /* Custom classname applied on option */
  className: _propTypes["default"].string,
  /* Icon to prepend before option value */
  icon: _propTypes["default"].string,
  /* Indicates whether option is selected or not. This props gets overridden
   * by select component
   */
  selected: _propTypes["default"].bool,
  /* Use this prop for clean select */
  customValue: _propTypes["default"].bool
};
var _default = Option;
exports["default"] = _default;