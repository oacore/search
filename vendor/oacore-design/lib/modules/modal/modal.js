"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _reactFocusLock = _interopRequireDefault(require("react-focus-lock"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _title = _interopRequireDefault(require("./title"));
var _footer = _interopRequireDefault(require("./footer"));
var _content = _interopRequireDefault(require("./content"));
var _portal = _interopRequireDefault(require("./portal"));
var _elements = require("../../elements");
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "onClose", "className", "hideManually"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "overlay-root": "modal-overlay-root-HYDcG",
  "overlay": "modal-overlay-1Ki3X",
  "title": "modal-title-2gcDL",
  "footer": "modal-footer-3rxbf",
  "content": "modal-content-3Y4Xs",
  "modal": "modal-modal-210sN",
  "close-button": "modal-close-button-1qkbz",
  "overlayRoot": "modal-overlay-root-HYDcG",
  "closeButton": "modal-close-button-1qkbz"
};
var checkAccessibility = function checkAccessibility(props, propName, componentName) {
  if (!props['aria-label'] && !props['aria-labelledby']) {
    return new Error("One of props 'aria-label' or 'aria-labelledby' isRequired in '".concat(componentName, "'."));
  }
  if (!props['aria-label'] && !props['aria-labelledby']) {
    return new Error("One of props 'aria-label' or 'aria-labelledby' was not specified in '".concat(componentName, "'."));
  }
  if (props['aria-label'] && props['aria-labelledby']) {
    return new Error("Props 'aria-label' and 'aria-labelledby' in '".concat(componentName, "' mutually exclusive."));
  }
  return null;
};
var Modal = function Modal(_ref) {
  var children = _ref.children,
    onClose = _ref.onClose,
    className = _ref.className,
    _ref$hideManually = _ref.hideManually,
    hideManually = _ref$hideManually === void 0 ? false : _ref$hideManually,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  var modalRef = (0, _react.useRef)(null);
  var handleKeyDown = (0, _react.useCallback)(function (event) {
    if (hideManually || !onClose) return;
    if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) onClose(event);
  }, [hideManually]);
  var handleClick = (0, _react.useCallback)(function (event) {
    if (hideManually || !onClose) return;
    if (modalRef.current && modalRef.current.contains(event.target) ||
    // If the click is on the scrollbar we don't want to close the modal.
    event.pageX > event.target.ownerDocument.documentElement.offsetWidth || event.pageY > event.target.ownerDocument.documentElement.offsetHeight) return;
    onClose(event);
  }, [hideManually]);
  (0, _react.useEffect)(function () {
    document.body.style.overflow = 'hidden';
    return function () {
      document.body.style.overflow = 'unset';
    };
  }, []);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(_portal["default"], {
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: styles.overlayRoot,
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactFocusLock["default"], {
        returnFocus: true,
        children: /*#__PURE__*/(0, _jsxRuntime.jsx)("div", _objectSpread(_objectSpread({
          className: styles.overlay,
          onClick: handleClick,
          onKeyDown: handleKeyDown
        }, restProps), {}, {
          children: /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", _objectSpread(_objectSpread({
            ref: function ref(_ref2) {
              modalRef.current = _ref2;
              // make sure disableBodyScroll is not called after
              // component unmount with ref === null
            },

            role: "dialog",
            className: _utils.classNames.use(styles.modal).join(className)
          }, restProps), {}, {
            children: [!hideManually && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Button, {
              className: styles.closeButton,
              "aria-label": "Close",
              onClick: function onClick(event) {
                return onClose(event);
              },
              children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Icon, {
                src: "#window-close"
              })
            }), children]
          }))
        }))
      })
    })
  });
};
Modal.displayName = "Modal";
Modal.Title = _title["default"];
Modal.Content = _content["default"];
Modal.Footer = _footer["default"];
Modal.propTypes = {
  'id': _propTypes["default"].string,
  'children': _propTypes["default"].node,
  /**
   *  Callback called when modal is being closed
   */
  'onClose': _propTypes["default"].func,
  /**
   *  Describes the title of the modal
   */
  'aria-label': checkAccessibility,
  /**
   * Points to modal label.
   * Ideally it should be used in conjunction with Modal.Title
   */
  'aria-labelledby': checkAccessibility,
  /**
   * If set to true onClose callback is not triggered on overlay click
   * or hitting ESC button.
   */
  'hideManually': _propTypes["default"].bool,
  /**
   *  The location where the modal is rendered
   */
  'selector': _propTypes["default"].string,
  /**
   * className applied on modal
   */
  'className': _propTypes["default"].string
};
var _default = Modal;
exports["default"] = _default;