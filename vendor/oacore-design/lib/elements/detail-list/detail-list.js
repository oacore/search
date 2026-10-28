"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className"],
  _excluded2 = ["name", "className", "children"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "container": "detail-list-container-UGFYb",
  "item": "detail-list-item-fKhWL",
  "header": "detail-list-header-2U2_U",
  "content": "detail-list-content-2vHo0"
};
var DetailList = /*#__PURE__*/(0, _react.memo)(function (_ref) {
  var children = _ref.children,
    className = _ref.className,
    passProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("ul", _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.container).join(className)
  }, passProps), {}, {
    children: children
  }));
});
var DetailItem = /*#__PURE__*/(0, _react.memo)(function (_ref2) {
  var name = _ref2.name,
    className = _ref2.className,
    children = _ref2.children,
    passProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded2);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("li", _objectSpread(_objectSpread({
    className: _utils.classNames.use([styles.item]).join(className)
  }, passProps), {}, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: styles.header,
      children: name
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: styles.content,
      children: children
    })]
  }));
});
DetailList.Item = DetailItem;
var _default = DetailList;
exports["default"] = _default;