"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _react = _interopRequireDefault(require("react"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var styles = {
  "group": "group-group-2Ka5T"
};
var LogoGroup = function LogoGroup(_ref) {
  var children = _ref.children,
    className = _ref.className;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    className: _utils.classNames.use(styles.group).join(className),
    children: children
  });
};
LogoGroup.displayName = "LogoGroup";
var _default = LogoGroup;
exports["default"] = _default;