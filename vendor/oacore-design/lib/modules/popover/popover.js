"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _headless = _interopRequireDefault(require("@tippyjs/react/headless"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _utils = require("../../utils");
var _elements = require("../../elements");
var _jsxRuntime = require("react/jsx-runtime");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "content": "popover-content-3mgoY"
};
var hideOnBlurPlugin = {
  name: 'hideOnBlur',
  defaultValue: true,
  fn: function fn(instance) {
    return {
      onCreate: function onCreate() {
        instance.popper.addEventListener('focusout', function (event) {
          if (instance.props.hideOnBlur && event.relatedTarget && !instance.popper.contains(event.relatedTarget)) instance.hide();
        });
      }
    };
  }
};

/**
 * The Popover component is backed by [Tippy.js](https://github.com/atomiks/tippyjs).
 *
 * **Not all props are documented here.** Please refer to [Tippy documentation](https://atomiks.github.io/tippyjs/v6/all-props/#trigger) for all possible props which can be passed down.
 */
var Popover = function Popover(_ref) {
  var content = _ref.content,
    visible = _ref.visible,
    _ref$interactive = _ref.interactive,
    interactive = _ref$interactive === void 0 ? false : _ref$interactive,
    _ref$trigger = _ref.trigger,
    trigger = _ref$trigger === void 0 ? visible !== undefined ? undefined : 'mouseenter focus' : _ref$trigger,
    _ref$placement = _ref.placement,
    placement = _ref$placement === void 0 ? 'auto' : _ref$placement,
    _ref$hideOnBlur = _ref.hideOnBlur,
    hideOnBlur = _ref$hideOnBlur === void 0 ? true : _ref$hideOnBlur,
    _ref$delay = _ref.delay,
    delay = _ref$delay === void 0 ? 0 : _ref$delay,
    className = _ref.className,
    children = _ref.children,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'div' : _ref$tag;
  return (
    /*#__PURE__*/
    // Wrapper needed for accessibility
    // See more: https://atomiks.github.io/tippyjs/v6/accessibility/#interactivity
    (0, _jsxRuntime.jsx)(Tag, {
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_headless["default"], {
        visible: visible,
        trigger: trigger,
        placement: placement,
        interactive: interactive,
        delay: delay,
        plugins: [hideOnBlurPlugin],
        hideOnBlur: hideOnBlur,
        render: function render(attrs) {
          return /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Card, _objectSpread(_objectSpread({
            className: _utils.classNames.use(styles.content, className)
          }, attrs), {}, {
            children: content
          }));
        },
        children: children
      })
    })
  );
};
Popover.displayName = "Popover";
Popover.propTypes = {
  /**
   * Single child which triggers the popover content to show, the element should
   * be focusable. (You can add tabindex="0")
   * See more at https://atomiks.github.io/tippyjs/v6/accessibility/#use-natively-focusable-elements
   */
  children: _propTypes["default"].node.isRequired,
  /**
   * Content to show, either react element or pure text.
   */
  content: _propTypes["default"].oneOfType([_propTypes["default"].node, _propTypes["default"].func]).isRequired,
  /**
   * Indicates visibility of Popover.Content.
   * Note should be applied only when trigger is set to manual
   */
  visible: _propTypes["default"].bool,
  /**
   * Indicates whether content can be hovered over
   * and clicked inside without hiding
   */
  interactive: _propTypes["default"].bool,
  /**
   * Indicated whether the popover contents should be hidden on blur.
   */
  hideOnBlur: _propTypes["default"].bool,
  /**
   * Preferred position of the content. The position may not be reflected
   * if opposite placement has more space or overflow occurs.
   */
  placement: _propTypes["default"].oneOf(['top', 'top-start', 'top-end', 'left', 'left-start', 'left-end', 'right', 'right-start', 'right-end', 'bottom', 'bottom-start', 'bottom-end', 'auto', 'auto-start', 'auto-end']),
  /**
   * Delay in ms before content shows or hides
   */
  delay: _propTypes["default"].oneOfType([_propTypes["default"].number, _propTypes["default"].array]),
  /**
   * Determines the events that cause the content to show.
   * Multiple event names are separated by spaces.
   * Possible events: mouseenter focus click, focusin, manual
   */
  trigger: _propTypes["default"].string,
  /**
   * className applied on popover content
   */
  className: _propTypes["default"].oneOfType([_propTypes["default"].string, _propTypes["default"].objectOf(_utils.classNames)])
};
var _default = Popover;
exports["default"] = _default;