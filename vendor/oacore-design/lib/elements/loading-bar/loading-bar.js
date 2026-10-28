"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var styles = {
  "loading-bar": "loading-bar-loading-bar-2YaxI",
  "fixed": "loading-bar-fixed-DHfYx",
  "stretching": "loading-bar-stretching-IcVvS",
  "loadingBar": "loading-bar-loading-bar-2YaxI"
};
var LoadingBar = function LoadingBar(_ref) {
  var className = _ref.className,
    _ref$fixed = _ref.fixed,
    fixed = _ref$fixed === void 0 ? false : _ref$fixed,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'div' : _ref$tag;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, {
    className: _utils.classNames.use(styles.loadingBar, fixed && styles.fixed).join(className)
  });
};
LoadingBar.displayName = "LoadingBar";
var _default = LoadingBar;
exports["default"] = _default;