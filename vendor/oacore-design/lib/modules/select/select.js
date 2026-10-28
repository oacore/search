"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireWildcard(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _utils = require("../../utils");
var _hooks = require("./hooks");
var _advancedSearch = _interopRequireDefault(require("../header/advanced-search"));
var _elements = require("../../elements");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["id", "value", "onInput", "onChange", "className", "children", "label", "selectMenuClassName", "variant", "placeholder", "changeOnBlur", "prependIcon", "prependIconClassName", "clearButton", "clearButtonClassName", "clearOnFocus", "tag", "appendText", "useAdvancedSearch"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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
var Select = /*#__PURE__*/(0, _react.memo)(function (_ref) {
  var id = _ref.id,
    value = _ref.value,
    onInput = _ref.onInput,
    onChange = _ref.onChange,
    className = _ref.className,
    children = _ref.children,
    label = _ref.label,
    _ref$selectMenuClassN = _ref.selectMenuClassName,
    selectMenuClassName = _ref$selectMenuClassN === void 0 ? '' : _ref$selectMenuClassN,
    _ref$variant = _ref.variant,
    variant = _ref$variant === void 0 ? 'normal' : _ref$variant,
    _ref$placeholder = _ref.placeholder,
    placeholder = _ref$placeholder === void 0 ? variant === 'pure' ? label : undefined : _ref$placeholder,
    _ref$changeOnBlur = _ref.changeOnBlur,
    changeOnBlur = _ref$changeOnBlur === void 0 ? true : _ref$changeOnBlur,
    _ref$prependIcon = _ref.prependIcon,
    prependIcon = _ref$prependIcon === void 0 ? null : _ref$prependIcon,
    _ref$prependIconClass = _ref.prependIconClassName,
    prependIconClassName = _ref$prependIconClass === void 0 ? '' : _ref$prependIconClass,
    _ref$clearButton = _ref.clearButton,
    clearButton = _ref$clearButton === void 0 ? true : _ref$clearButton,
    _ref$clearButtonClass = _ref.clearButtonClassName,
    clearButtonClassName = _ref$clearButtonClass === void 0 ? '' : _ref$clearButtonClass,
    _ref$clearOnFocus = _ref.clearOnFocus,
    clearOnFocus = _ref$clearOnFocus === void 0 ? false : _ref$clearOnFocus,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'div' : _ref$tag,
    appendText = _ref.appendText,
    useAdvancedSearch = _ref.useAdvancedSearch,
    restInputProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  // custom select hooks
  var _useInput = (0, _hooks.useInput)(value, {
      onInput: onInput,
      onChange: onChange,
      changeOnBlur: changeOnBlur
    }),
    _useInput2 = (0, _slicedToArray2["default"])(_useInput, 5),
    inputRef = _useInput2[0],
    inputData = _useInput2[1],
    setInputData = _useInput2[2],
    isInputFocused = _useInput2[3],
    setIsInputFocused = _useInput2[4];
  var _useOptions = (0, _hooks.useOptions)(children, {
      selectId: id,
      setIsInputFocused: setIsInputFocused,
      setInputData: setInputData
    }),
    _useOptions2 = (0, _slicedToArray2["default"])(_useOptions, 6),
    selectMenuRef = _useOptions2[0],
    options = _useOptions2[1],
    activeOption = _useOptions2[2],
    setClickedElement = _useOptions2[3],
    handleInputKeyEvent = _useOptions2[4],
    handleInputBlurEvent = _useOptions2[5];
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    visibleAdvancedMenu = _useState2[0],
    setVisibleAdvancedMenu = _useState2[1];
  var _useState3 = (0, _react.useState)(false),
    _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
    visibleAppendTextIcon = _useState4[0],
    setVisibleAppendTextIcon = _useState4[1];
  var advancedTextRef = (0, _react.useRef)(null);
  var handleMouseUp = (0, _react.useCallback)(function (event) {
    var _inputRef$current, _selectMenuRef$curren;
    // detect if click was made outside of select
    // if so hide suggestion menu
    if ((_inputRef$current = inputRef.current) !== null && _inputRef$current !== void 0 && _inputRef$current.contains(event.target) || (_selectMenuRef$curren = selectMenuRef.current) !== null && _selectMenuRef$curren !== void 0 && _selectMenuRef$curren.contains(event.target)) return;
    if (isInputFocused) {
      // reset keyboard position in option menu
      setClickedElement(null);
      setIsInputFocused(false);
    }
  }, []);
  var onToggleVisibleAdvancedMenu = function onToggleVisibleAdvancedMenu() {
    setVisibleAdvancedMenu(!visibleAdvancedMenu);
  };

  // attach event listeners
  (0, _react.useEffect)(function () {
    window.addEventListener('mouseup', handleMouseUp);
    return function () {
      return window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_jsxRuntime.Fragment, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)(Tag, {
      className: _utils.classNames.use(styles.selectWrapper, isInputFocused && styles.focused).join(className),
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
        className: "sr-only",
        "aria-live": "assertive",
        children: _utils.canUseDOM && options.length && document.activeElement === inputRef.current ? "".concat(options.length, " suggestions found, to navigate use up and down arrows") : ''
      }), /*#__PURE__*/(0, _jsxRuntime.jsxs)(_elements.Form.Group, {
        tag: "div",
        className: variant === 'pure' ? styles.pure : '',
        children: [prependIcon && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Form.Addon, {
          place: "prepend",
          className: _utils.classNames.use(styles.prependIcon).join(prependIconClassName),
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Icon, {
            src: prependIcon
          })
        }), appendText && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Form.Addon, {
          className: _utils.classNames.use(styles.appendText),
          onClick: onToggleVisibleAdvancedMenu,
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)("p", {
            role: "presentation",
            children: appendText
          })
        }), clearButton && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Form.Addon, {
          place: "append",
          className: styles.appendIcon,
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Button, {
            className: _utils.classNames.use(styles.clearOutButton, inputData.value && styles.show).join(clearButtonClassName),
            onClick: function onClick() {
              setInputData({
                value: ''
              });
              inputRef.current.focus();
            },
            type: "button",
            children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Icon, {
              src: "#window-close"
            })
          })
        }), appendText && visibleAppendTextIcon && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Form.Addon, {
          ref: advancedTextRef,
          place: "append",
          className: _utils.classNames.use(styles.appendIcon, styles.infoAppend),
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Button, {
            className: _utils.classNames.use(styles.infoAppendButton, styles.show).join(clearButtonClassName),
            type: "button",
            onClick: onToggleVisibleAdvancedMenu,
            children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Icon, {
              src: "#information-outline"
            })
          })
        }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Form.Control, _objectSpread({
          ref: inputRef,
          id: "select-".concat(id),
          type: "text",
          placeholder: placeholder,
          autoComplete: "off",
          role: "combobox",
          "aria-expanded": Boolean(options.length),
          "aria-owns": "suggestion-results",
          "aria-autocomplete": "both",
          "aria-controls": "suggestion-results-".concat(id),
          "aria-activedescendant": activeOption !== null && activeOption !== void 0 && activeOption.id ? "suggestion-result-".concat(id, "-").concat(activeOption.id) : undefined,
          value: inputData.value,
          onFocus: function onFocus() {
            setIsInputFocused(true);
            setClickedElement(advancedTextRef);
            if (clearOnFocus) setInputData({
              value: ''
            });
            if (useAdvancedSearch) setVisibleAppendTextIcon(true);
          },
          onBlur: function onBlur(event) {
            if (inputData.value === '') setInputData({
              value: ''
            });
            handleInputBlurEvent(event, setVisibleAppendTextIcon);
          },
          onKeyDown: handleInputKeyEvent,
          onChange: function onChange(event) {
            if (inputData.value === event.target.value) return;
            setInputData({
              value: event.target.value
            });
          }
        }, restInputProps)), /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Form.Label, {
          htmlFor: "select-".concat(id),
          children: label
        })]
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)("ul", {
        id: "suggestion-results-".concat(id),
        className: _utils.classNames.use(styles.selectMenu, (0, _defineProperty2["default"])({}, styles.show, isInputFocused && !inputData.customValue)).join(selectMenuClassName),
        role: "listbox",
        ref: selectMenuRef,
        children: options
      })]
    }), useAdvancedSearch && /*#__PURE__*/(0, _jsxRuntime.jsx)(_advancedSearch["default"], {
      isVisible: visibleAdvancedMenu,
      setSearchValue: onInput,
      inputRef: inputRef,
      onClose: function onClose() {
        setVisibleAppendTextIcon(false);
        onToggleVisibleAdvancedMenu();
      }
    })]
  });
});
Select.propTypes = {
  /**
   * An ID that will be used to link input and label. It's necessary for
   * accessibility.
   */
  id: _propTypes["default"].string.isRequired,
  /* Label to show in input */
  label: _propTypes["default"].string.isRequired,
  /* The current value shown in input field */
  value: _propTypes["default"].string,
  /* Callback function called whenever input changes */
  onInput: _propTypes["default"].func,
  /* Callback function called whenever input loses focus */
  onChange: _propTypes["default"].func,
  /* Call onChange callback on blur event */
  changeOnBlur: _propTypes["default"].bool,
  /* Custom classname applied on select wrapper */
  className: _propTypes["default"].oneOfType([_propTypes["default"].string, _propTypes["default"].instanceOf(_utils.classNames["default"])]),
  /* Classname applied to select menu */
  selectMenuClassName: _propTypes["default"].string,
  /* Icon to prepend before input */
  prependIcon: _propTypes["default"].string,
  /* Classname applied to prepend icon */
  prependIconClassName: _propTypes["default"].string,
  /* Indicates whether clear button is shown */
  clearButton: _propTypes["default"].bool,
  /* Classname applied to clear button */
  clearButtonClassName: _propTypes["default"].string,
  /* Indicates whether input should be clear onFocus */
  clearOnFocus: _propTypes["default"].bool,
  /* Input's placeholder */
  placeholder: _propTypes["default"].string,
  /* Append text */
  appendText: _propTypes["default"].string,
  useAdvancedSearch: _propTypes["default"].bool,
  /**
   * Helper variation. Affects label display.
   *
   * If variant is pure label is shown only when select is not focused
   */
  variant: _propTypes["default"].oneOf(['normal', 'pure'])
};
var _default = Select;
exports["default"] = _default;