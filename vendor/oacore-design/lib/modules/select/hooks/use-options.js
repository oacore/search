"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var useOptions = function useOptions(children, _ref) {
  var selectId = _ref.selectId,
    setIsInputFocused = _ref.setIsInputFocused,
    setInputData = _ref.setInputData;
  var selectMenuRef = (0, _react.useRef)(null);
  var _useState = (0, _react.useState)(null),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    activeOption = _useState2[0],
    setActiveOption = _useState2[1];
  // keep track on which element is currently clicked with onMouseDown event
  var _useState3 = (0, _react.useState)(null),
    _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
    clickedElement = _useState4[0],
    setClickedElement = _useState4[1];
  var changeActiveOption = function changeActiveOption(option) {
    var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
        hide: true
      },
      hide = _ref2.hide;
    setInputData({
      value: option.value,
      id: option.id,
      customValue: option.customValue
    });
    setActiveOption(option);
    if (hide) {
      setIsInputFocused(false);
      setActiveOption(null);
    }
    if (option.customValue) {
      setActiveOption(null);
      setInputData(_objectSpread(_objectSpread({}, option), {}, {
        value: ''
      }));
    }
  };
  var options = _react["default"].Children.toArray(children).filter(function (child) {
    return child.type.displayName === 'SelectOption';
  }).map(function (element) {
    var overrideProps = {
      'id': "suggestion-result-".concat(selectId, "-").concat(element.props.id),
      'value': element.props.value,
      'data-select-id': element.props.id,
      'onMouseDown': function onMouseDown() {
        // Firefox and Safari have relatedTarget null.
        // Therefore we cannot use onClick event
        // since it's not getting fired
        // because onBlur input listener cause rerender.
        setClickedElement(element.props.id);
      },
      'onMouseUp': function onMouseUp(event) {
        if (clickedElement === element.props.id) {
          var _element$props;
          changeActiveOption({
            value: element.props.value,
            id: element.props.id,
            customValue: ((_element$props = element.props) === null || _element$props === void 0 ? void 0 : _element$props.customValue) || false
          });
        }
        setClickedElement(null);
        event.stopPropagation();
      },
      'selected': element.props.id === (activeOption === null || activeOption === void 0 ? void 0 : activeOption.id)
    };
    return /*#__PURE__*/_react["default"].cloneElement(element, _objectSpread(_objectSpread({}, element.props), overrideProps));
  }) || [];
  var handleInputKeyEvent = function handleInputKeyEvent(event) {
    var pos = options.findIndex(function (s) {
      return s.props['data-select-id'] === (activeOption === null || activeOption === void 0 ? void 0 : activeOption.id);
    }) || options.length;
    var direction = 1;
    var suggestion = {};
    switch (event.key) {
      case 'Esc': // IE/Edge specific value
      case 'Escape':
        setIsInputFocused(false);
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        setIsInputFocused(false);
        break;
      case 'Up': // IE/Edge specific value
      case 'ArrowUp':
      case 'Down': // IE/Edge specific value
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        if (options.length === 0) return;
        if (activeOption == null) {
          // eslint-disable-next-line prefer-destructuring
          suggestion = options[0];
          changeActiveOption({
            value: suggestion.props.value,
            id: suggestion.props['data-select-id']
          }, {
            hide: false
          });
        } else {
          direction = ['ArrowDown', 'Down'].includes(event.key) ? 1 : -1;
          pos = (pos + direction) % options.length;
          suggestion = options[pos];
          changeActiveOption({
            value: suggestion.props.value,
            id: suggestion.props['data-select-id']
          }, {
            hide: false
          });
        }
        selectMenuRef.current.querySelector("#suggestion-result-".concat(selectId, "-").concat(suggestion.props['data-select-id'])).scrollIntoView(false);
        break;
      default:
    }
  };
  var handleInputBlurEvent = function handleInputBlurEvent(event, setVisibleAppendTextIcon) {
    // check if onBlur happen within select
    var el = event.relatedTarget;
    if (!el) {
      setClickedElement(null);
      setIsInputFocused(false, event);
      setVisibleAppendTextIcon(false);
    }
    if (clickedElement === null && !(el && el.dataset.selectId === clickedElement)) setIsInputFocused(false, event);
  };
  return [selectMenuRef, options, activeOption, setClickedElement, handleInputKeyEvent, handleInputBlurEvent];
};
var _default = useOptions;
exports["default"] = _default;