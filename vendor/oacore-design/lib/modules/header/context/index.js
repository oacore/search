"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "HEADER_ACTIONS", {
  enumerable: true,
  get: function get() {
    return _actions["default"];
  }
});
exports.headerInitialState = void 0;
Object.defineProperty(exports, "headerReducer", {
  enumerable: true,
  get: function get() {
    return _reducer["default"];
  }
});
var _reducer = _interopRequireDefault(require("./reducer"));
var _actions = _interopRequireDefault(require("./actions"));
var headerInitialState = {
  searchBar: null
};
exports.headerInitialState = headerInitialState;