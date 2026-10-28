"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
var _default = canUseDOM;
exports["default"] = _default;