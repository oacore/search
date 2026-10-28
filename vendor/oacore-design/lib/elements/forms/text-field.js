"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _propTypes = _interopRequireDefault(require("prop-types"));
var _progressSpinner = _interopRequireDefault(require("../progress-spinner"));
var _icon = _interopRequireDefault(require("../icon"));
var _group = _interopRequireDefault(require("./group"));
var _label = _interopRequireDefault(require("./label"));
var _control = _interopRequireDefault(require("./control"));
var _addon = _interopRequireDefault(require("./addon"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["value", "variant", "progress"],
  _excluded2 = ["children", "id", "className", "label", "helper", "statusIcon", "progress", "variant", "size", "tag", "placeholder"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "helper": "text-field-helper-2vqOg",
  "small": "text-field-small-3whyF",
  "large": "text-field-large-245JZ",
  "pure": "text-field-pure-mkoEg",
  "success": "text-field-success-1OCQF",
  "error": "text-field-error-1Ow1I",
  "touched": "text-field-touched-2sKii"
};
/**
 * Unique ID generator
 *
 * Based on @gordonbrander's gist.
 * See: https://gist.github.com/gordonbrander/2230317
 *
 * > Math.random should be unique because of its seeding algorithm.
 * > Convert it to base 36 (numbers + letters), and grab the first 9 characters
 * > after the decimal.
 *
 * @return {string}
 */
var Status = function Status(_ref) {
  var value = _ref.value,
    variant = _ref.variant,
    progress = _ref.progress,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(_addon["default"], _objectSpread(_objectSpread({}, restProps), {}, {
    children: typeof value == 'string' ? /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
      src: value,
      "aria-hidden": true
    }) : {
      valid: /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
        src: "#check",
        "aria-hidden": true
      }),
      success: /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
        src: "#check",
        "aria-hidden": true
      }),
      invalid: /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
        src: "#alert-circle-outline",
        "aria-hidden": true
      }),
      error: /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
        src: "#alert-circle-outline",
        "aria-hidden": true
      }),
      progress: /*#__PURE__*/(0, _jsxRuntime.jsx)(_progressSpinner["default"], {
        value: progress
      })
    }[variant]
  }));
};
Status.displayName = "Status";
var TextField = /*#__PURE__*/(0, _react.forwardRef)(function (_ref2, ref) {
  var _classNames$use;
  var children = _ref2.children,
    id = _ref2.id,
    className = _ref2.className,
    label = _ref2.label,
    helper = _ref2.helper,
    statusIcon = _ref2.statusIcon,
    progress = _ref2.progress,
    _ref2$variant = _ref2.variant,
    variant = _ref2$variant === void 0 ? 'normal' : _ref2$variant,
    _ref2$size = _ref2.size,
    size = _ref2$size === void 0 ? 'normal' : _ref2$size,
    _ref2$tag = _ref2.tag,
    tag = _ref2$tag === void 0 ? 'div' : _ref2$tag,
    _ref2$placeholder = _ref2.placeholder,
    placeholder = _ref2$placeholder === void 0 ? variant === 'pure' ? label : undefined : _ref2$placeholder,
    inputProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded2);
  var controlId = [id, 'control'].join('-');
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    isTouched = _useState2[0],
    setIsTouched = _useState2[1];
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_group["default"], {
    id: id,
    className: _utils.classNames.use((_classNames$use = {}, (0, _defineProperty2["default"])(_classNames$use, variant, !['normal'].includes(variant)), (0, _defineProperty2["default"])(_classNames$use, size, size !== 'default'), (0, _defineProperty2["default"])(_classNames$use, "touched", isTouched), _classNames$use)).from(styles).join(className),
    tag: tag,
    children: [statusIcon != null && /*#__PURE__*/(0, _jsxRuntime.jsx)(Status, {
      value: statusIcon,
      variant: variant,
      progress: progress
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_control["default"], _objectSpread({
      ref: ref,
      id: controlId,
      className: _utils.classNames.use(isTouched && styles.touched),
      onBlur: function onBlur() {
        return !isTouched && setIsTouched(true);
      },
      "aria-invalid": variant === 'error',
      "aria-describedby": "".concat(id, "-message"),
      placeholder: placeholder,
      focus: ['error', 'success', 'focus'].includes(variant)
    }, inputProps)), children, /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
      id: "".concat(id, "-helper"),
      className: styles.helper,
      children: helper
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_label["default"], {
      htmlFor: controlId,
      children: label
    })]
  });
});
TextField.propTypes = {
  /**
   * Label for the text field
   */
  label: _propTypes["default"].node.isRequired,
  /**
   * Input's placeholder
   */
  placeholder: _propTypes["default"].string,
  /**
   * Size variation. Affects height only.
   */
  size: _propTypes["default"].oneOf(['normal', 'small', 'large']),
  /**
   * An ID that will be used to link input and label. It's necessary for
   * accessibility.
   */
  id: _propTypes["default"].string.isRequired,
  /**
   * Helper message to show bellow the input
   */
  helper: _propTypes["default"].node,
  /**
   * Helper variation. Affects label position and the colour.
   *
   * Avoid using `pure` with no `placeholder`, prefer to explicitly set it.
   * However, if you don't, the `placeholder` repeats the label text.
   */
  variant: _propTypes["default"].oneOf(['normal', 'pure', 'focus', 'success', 'error', 'progress']),
  /**
   * Adds a status icon to TextField at the right side of the input.
   *
   * If boolean is passed (preferable), the icon is based on the `variant`.
   *
   * If a `string` is passed, it's resolved as the icon path.
   */
  statusIcon: _propTypes["default"].oneOfType([_propTypes["default"].bool, _propTypes["default"].string]),
  /**
   * A number between `[0-1]` if you have determinate progress indication
   * for the particular text field.
   *
   * If not passed, the progress indicator appears in indeterminate state.
   *
   * Has no effect if the `variant` is different than `progress`.
   */
  progress: _propTypes["default"].number
};
var _default = TextField;
exports["default"] = _default;