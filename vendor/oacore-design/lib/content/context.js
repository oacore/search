"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultContext = exports["default"] = void 0;
var _react = require("react");
var defaultContext = {
  level: 1,
  parentId: null
};
exports.defaultContext = defaultContext;
var SectionContext = /*#__PURE__*/(0, _react.createContext)(defaultContext);
var _default = SectionContext;
exports["default"] = _default;