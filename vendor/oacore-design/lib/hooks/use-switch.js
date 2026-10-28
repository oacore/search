"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = require("react");
var useSwitch = function useSwitch() {
  var val = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  var _useState = (0, _react.useState)(val),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    value = _useState2[0],
    setValue = _useState2[1];
  return [value, function (event) {
    return setValue(event.target.checked);
  }];
};
var _default = useSwitch;
exports["default"] = _default;