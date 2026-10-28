"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireDefault(require("react"));
var _ = require("..");
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["cookieItems", "onSubmit"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "popup": "cookies-popup-2NSSr",
  "fade": "cookies-fade-2P7TX",
  "popup-body": "cookies-popup-body-1VEen",
  "popup-link": "cookies-popup-link-o-JpP",
  "popup-actions": "cookies-popup-actions-qIUXY",
  "popup-button": "cookies-popup-button-17h9a",
  "popupBody": "cookies-popup-body-1VEen",
  "popupLink": "cookies-popup-link-o-JpP",
  "popupActions": "cookies-popup-actions-qIUXY",
  "popupButton": "cookies-popup-button-17h9a"
}; // eslint-disable-next-line import/no-cycle
var CookiesPopup = function CookiesPopup(_ref) {
  var cookieItems = _ref.cookieItems,
    onSubmit = _ref.onSubmit,
    formProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.popup),
    id: "cookies-popup"
  }, formProps), {}, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: styles.popupBody,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("p", {
        children: "We use cookies to improve our website."
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Link, {
        href: "/cookies",
        className: styles.popupLink,
        children: "Learn more"
      })]
    }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: styles.popupActions,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_.Button, {
        onClick: onSubmit,
        variant: "outlined",
        className: styles.popupButton,
        id: "essential_cookies_allowed",
        children: "Essential cookies only"
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Button, {
        onClick: onSubmit,
        variant: "contained",
        className: styles.popupButton,
        id: cookieItems,
        children: "I agree"
      })]
    })]
  }));
};
CookiesPopup.displayName = "CookiesPopup";
var _default = CookiesPopup;
exports["default"] = _default;