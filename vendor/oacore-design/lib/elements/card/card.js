"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className", "variant", "tag"],
  _excluded2 = ["children", "className", "tag"],
  _excluded3 = ["children", "className", "tag"],
  _excluded4 = ["children", "className", "tag"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "container": "card-container-11P0y",
  "title": "card-title-2rvi9",
  "description": "card-description-3Qppz",
  "footer": "card-footer-1UaTv",
  "elevated": "card-elevated-1Clhn",
  "outlined": "card-outlined-1ScI1",
  "pure": "card-pure-2hyas"
};
var Card = function Card(_ref) {
  var children = _ref.children,
    className = _ref.className,
    _ref$variant = _ref.variant,
    variant = _ref$variant === void 0 ? 'elevated' : _ref$variant,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'div' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.container, styles[variant]).join(className)
  }, restProps), {}, {
    children: children
  }));
};
Card.displayName = "Card";
Card.propTypes = {
  variant: _propTypes["default"].oneOf(['elevated', 'outlined', 'pure'])
};
var Title = function Title(_ref2) {
  var children = _ref2.children,
    className = _ref2.className,
    _ref2$tag = _ref2.tag,
    Tag = _ref2$tag === void 0 ? 'h1' : _ref2$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded2);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.title).join(className)
  }, restProps), {}, {
    children: children
  }));
};
Title.displayName = "Title";
var Description = function Description(_ref3) {
  var children = _ref3.children,
    className = _ref3.className,
    _ref3$tag = _ref3.tag,
    Tag = _ref3$tag === void 0 ? 'p' : _ref3$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref3, _excluded3);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.description).join(className)
  }, restProps), {}, {
    children: children
  }));
};
Description.displayName = "Description";
var Footer = function Footer(_ref4) {
  var children = _ref4.children,
    className = _ref4.className,
    _ref4$tag = _ref4.tag,
    Tag = _ref4$tag === void 0 ? 'div' : _ref4$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref4, _excluded4);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.footer).join(className)
  }, restProps), {}, {
    children: children
  }));
};
Footer.displayName = "Footer";
Card.Title = Title;
Card.Description = Description;
Card.Footer = Footer;
var _default = Card;
exports["default"] = _default;