"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireDefault(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _utils = _interopRequireDefault(require("./utils"));
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children"];
var MathMarkdown = function MathMarkdown(props) {
  var children = props.children,
    rest = (0, _objectWithoutProperties2["default"])(props, _excluded);
  if (!rest.enforceOutput && rest.output === 'mathml' && !_utils["default"].hasMathMLSupport()) rest.output = 'htmlAndMathml';
  if (children === null || children === undefined || typeof children !== 'string') return /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {});
  var renderUs = _utils["default"].latexify(children, rest);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
    children: renderUs
  });
};
MathMarkdown.displayName = "MathMarkdown";
var _default = MathMarkdown;
exports["default"] = _default;
MathMarkdown.propTypes = {
  children: _propTypes["default"].string,
  displayMode: _propTypes["default"].bool,
  leqno: _propTypes["default"].bool,
  fleqn: _propTypes["default"].bool,
  throwOnError: _propTypes["default"].bool,
  errorColor: _propTypes["default"].string,
  minRuleThickness: _propTypes["default"].number,
  colorIsTextColor: _propTypes["default"].bool,
  maxSize: _propTypes["default"].number,
  maxExpand: _propTypes["default"].number,
  strict: _propTypes["default"].oneOfType([_propTypes["default"].bool, _propTypes["default"].string, _propTypes["default"].func]),
  trust: _propTypes["default"].oneOfType([_propTypes["default"].bool, _propTypes["default"].func]),
  output: _propTypes["default"].oneOf(['html', 'mathml', 'htmlAndMathml']),
  enforceOutput: _propTypes["default"].bool,
  breakLine: _propTypes["default"].bool
};
MathMarkdown.defaultProps = {
  children: null,
  displayMode: false,
  output: 'htmlAndMathml',
  leqno: false,
  fleqn: false,
  throwOnError: true,
  errorColor: '#cc0000',
  minRuleThickness: 0,
  colorIsTextColor: false,
  strict: 'warn',
  trust: false,
  enforceOutput: false,
  breakLine: false
};