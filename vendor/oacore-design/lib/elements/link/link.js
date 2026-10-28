"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.StyledLink = exports.BaseLink = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _react = require("react");
var _icon = _interopRequireDefault(require("../icon"));
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "href", "target", "download", "ping", "rel", "hrefLang", "type", "referrerPolicy", "itemProp"],
  _excluded2 = ["children", "external", "icon"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "icon": "link-icon-_QgXo"
};
/**
 * The BaseLink component reflects WHATWG <a> element specification,
 * i.e. removes extra attributes if there is no href passed.
 *
 * See more: https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element
 */
var BaseLink = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var children = _ref.children,
    href = _ref.href,
    target = _ref.target,
    download = _ref.download,
    ping = _ref.ping,
    rel = _ref.rel,
    hrefLang = _ref.hrefLang,
    type = _ref.type,
    referrerPolicy = _ref.referrerPolicy,
    itemProp = _ref.itemProp,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  var linkProps = {
    href: href,
    target: target,
    download: download,
    ping: ping,
    rel: rel,
    hrefLang: hrefLang,
    type: type,
    referrerPolicy: referrerPolicy,
    itemProp: itemProp
  };
  var props = _objectSpread(_objectSpread({}, href == null ? {} : linkProps), restProps);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("a", _objectSpread(_objectSpread({
    ref: ref
  }, props), {}, {
    children: children
  }));
});
exports.BaseLink = BaseLink;
var StyledLink = /*#__PURE__*/(0, _react.forwardRef)(function (_ref2, ref) {
  var children = _ref2.children,
    _ref2$external = _ref2.external,
    external = _ref2$external === void 0 ? false : _ref2$external,
    _ref2$icon = _ref2.icon,
    icon = _ref2$icon === void 0 ? external : _ref2$icon,
    restProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded2);
  var ownProps = {};
  if (external) {
    ownProps.target = '_blank';
    ownProps.rel = 'noopener noreferrer';
  }
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(BaseLink, _objectSpread(_objectSpread(_objectSpread({
    ref: ref
  }, ownProps), restProps), {}, {
    children: [children, external && icon && /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
      className: styles.icon,
      src: "#open-in-new",
      "aria-hidden": true
    })]
  }));
});
exports.StyledLink = StyledLink;
StyledLink.propTypes = {
  href: _propTypes["default"].string,
  /**
   * Indicates whether link is external or not.
   *
   * External links contain additional icon and add additional attributes to
   * the link: `target="_blank" rel="noopener noreferrer"`.
   * See more: [Links to cross-origin destinations are
   * unsafe](https://web.dev/external-anchors-use-rel-noopener/).
   */
  external: _propTypes["default"].bool,
  /**
   * Indicates whether the external icon should be shown or not.
   * Applies only when link is external and its default
   * reflects external prop.
   */
  icon: _propTypes["default"].bool
};
var _default = StyledLink;
exports["default"] = _default;