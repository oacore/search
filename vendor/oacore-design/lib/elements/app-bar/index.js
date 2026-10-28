"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "AppBarBrand", {
  enumerable: true,
  get: function get() {
    return _brand["default"];
  }
});
Object.defineProperty(exports, "AppBarItem", {
  enumerable: true,
  get: function get() {
    return _item["default"];
  }
});
exports["default"] = void 0;
var _bar = _interopRequireDefault(require("./bar"));
var _brand = _interopRequireDefault(require("./brand"));
var _item = _interopRequireDefault(require("./item"));
_bar["default"].Brand = _brand["default"];
_bar["default"].Item = _item["default"];
var _default = _bar["default"];
exports["default"] = _default;