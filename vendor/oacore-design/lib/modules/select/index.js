"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "SelectOption", {
  enumerable: true,
  get: function get() {
    return _option["default"];
  }
});
exports["default"] = void 0;
var _select = _interopRequireDefault(require("./select"));
var _option = _interopRequireDefault(require("./option"));
_select["default"].Option = _option["default"];
var _default = _select["default"];
exports["default"] = _default;