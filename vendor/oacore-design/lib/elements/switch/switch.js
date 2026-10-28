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
var _excluded = ["variant", "id", "name", "checked", "onChange", "nonActive", "label", "className"];
/* eslint-disable jsx-a11y/label-has-associated-control */
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "small": "switch-small-3P8gq",
  "big": "switch-big-3AWTC",
  "container": "switch-container-31HDE",
  "checkbox": "switch-checkbox-1Oncm",
  "box": "switch-box-2H3uk",
  "active": "switch-active-35vHb",
  "button": "switch-button-1n-w0",
  "label": "switch-label-1RFII",
  "non-active": "switch-non-active-1P5Do",
  "nonActive": "switch-non-active-1P5Do"
};
var Switch = function Switch(_ref) {
  var _classNames$use2;
  var _ref$variant = _ref.variant,
    variant = _ref$variant === void 0 ? 'normal' : _ref$variant,
    id = _ref.id,
    _ref$name = _ref.name,
    name = _ref$name === void 0 ? id : _ref$name,
    checked = _ref.checked,
    onChange = _ref.onChange,
    _ref$nonActive = _ref.nonActive,
    nonActive = _ref$nonActive === void 0 ? false : _ref$nonActive,
    label = _ref.label,
    className = _ref.className,
    props = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  var useStyles = function useStyles(defaultClass) {
    return _utils.classNames.use(defaultClass, (0, _defineProperty2["default"])({}, styles[variant], variant));
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    className: _utils.classNames.use(styles.container).join(className),
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("input", _objectSpread({
      name: name,
      onChange: onChange,
      type: "checkbox",
      checked: checked,
      id: id,
      className: useStyles(styles.checkbox)
    }, props)), /*#__PURE__*/(0, _jsxRuntime.jsx)("label", {
      className: _utils.classNames.use(useStyles(styles.box), (_classNames$use2 = {}, (0, _defineProperty2["default"])(_classNames$use2, styles.active, checked), (0, _defineProperty2["default"])(_classNames$use2, styles.nonActive, nonActive), _classNames$use2)),
      htmlFor: name,
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
        className: useStyles(styles.button)
      })
    }), label && /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: useStyles(styles.label),
      children: label
    })]
  });
};
Switch.displayName = "Switch";
Switch.propTypes = {
  id: _propTypes["default"].string.isRequired,
  checked: _propTypes["default"].bool.isRequired,
  onChange: _propTypes["default"].func.isRequired,
  label: _propTypes["default"].string,
  name: _propTypes["default"].string,
  variant: _propTypes["default"].oneOf(['normal', 'small', 'big'])
};
var _default = Switch;
exports["default"] = _default;