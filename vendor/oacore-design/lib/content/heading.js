"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireWildcard(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _elements = require("../elements");
var _context = _interopRequireDefault(require("./context"));
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "id", "level"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var SectionHeading = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var _ref2;
  var children = _ref.children,
    forceId = _ref.id,
    forceLevel = _ref.level,
    passProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  var parentContext = (0, _react.useContext)(_context["default"]);
  var level = (_ref2 = forceLevel !== null && forceLevel !== void 0 ? forceLevel : parentContext.level) !== null && _ref2 !== void 0 ? _ref2 : 1;
  var id = forceId !== null && forceId !== void 0 ? forceId : parentContext.headingId;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Heading, _objectSpread(_objectSpread({
    ref: ref,
    id: id,
    level: level
  }, passProps), {}, {
    children: children
  }));
});
SectionHeading.propTypes = {
  /**
   * A local level to force the current heading heading level over the one
   * passed via the context from the parent sectioning element.
   *
   * If `null` or no value (`undefined`) is passed, the prop is ignored.
   * Otherwise, it forces the current Heading to use the passed level.
   *
   * In contrast to the forced `level` in the Section, this one impacts
   * only the current heading and will not have effect on nested sections.
   *
   * The prop is created to provide the full control over the component if
   * the automatic system does not work. However, we recommend avoid using it.
   */
  level: _propTypes["default"].oneOf([undefined, null, 1, 2, 3, 4, 5, 6])
};
var _default = SectionHeading;
exports["default"] = _default;