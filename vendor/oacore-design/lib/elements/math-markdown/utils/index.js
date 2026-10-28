"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _hasMathMLSupport = _interopRequireDefault(require("./hasMathMLSupport"));
var _latexify = _interopRequireDefault(require("./latexify"));
var _default = {
  hasMathMLSupport: _hasMathMLSupport["default"],
  latexify: _latexify["default"]
};
exports["default"] = _default;