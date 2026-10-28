"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = require("react");
var useInput = function useInput(value, _ref) {
  var onInput = _ref.onInput,
    onChange = _ref.onChange,
    changeOnBlur = _ref.changeOnBlur;
  var inputRef = (0, _react.useRef)(null);
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    isInitialised = _useState2[0],
    setIsInitialised = _useState2[1];
  var inputEventType = (0, _react.useRef)(null);
  var _useState3 = (0, _react.useState)({
      value: value
    }),
    _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
    inputData = _useState4[0],
    changeInputData = _useState4[1];
  var _useState5 = (0, _react.useState)(null),
    _useState6 = (0, _slicedToArray2["default"])(_useState5, 2),
    isInputFocused = _useState6[0],
    setIsInputFocusedInternal = _useState6[1];
  (0, _react.useEffect)(function () {
    if (value !== inputData.value) changeInputData({
      value: value
    });
  }, [value]);
  (0, _react.useEffect)(function () {
    onInput(inputData);
  }, [inputData.value]);
  (0, _react.useEffect)(function () {
    if (!isInitialised) {
      setIsInitialised(true);
      return;
    }
    if (!isInputFocused) {
      if (changeOnBlur || !changeOnBlur && inputEventType.current !== 'blur') onChange(inputData);
      // hide cursor from input field
      inputRef.current.blur();
      if (inputData.customValue) inputRef.current.focus();
    }
  }, [isInputFocused]);
  var setIsInputFocused = (0, _react.useCallback)(function (isInputFocusedInner, event) {
    inputEventType.current = event === null || event === void 0 ? void 0 : event.type;
    setIsInputFocusedInternal(isInputFocusedInner);
  }, [isInputFocused]);
  return [inputRef, inputData, changeInputData, isInputFocused, setIsInputFocused];
};
var _default = useInput;
exports["default"] = _default;