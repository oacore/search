"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Form", {
  enumerable: true,
  get: function get() {
    return _form["default"];
  }
});
Object.defineProperty(exports, "TextField", {
  enumerable: true,
  get: function get() {
    return _textField["default"];
  }
});
var _form = _interopRequireDefault(require("./form"));
var _control = _interopRequireDefault(require("./control"));
var _label = _interopRequireDefault(require("./label"));
var _group = _interopRequireDefault(require("./group"));
var _addon = _interopRequireDefault(require("./addon"));
var _textField = _interopRequireDefault(require("./text-field"));
Object.assign(_form["default"], {
  Control: _control["default"],
  Label: _label["default"],
  Group: _group["default"],
  Addon: _addon["default"]
});