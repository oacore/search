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
var _context = _interopRequireDefault(require("./context"));
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "id", "level", "tag"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var Section = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var children = _ref.children,
    id = _ref.id,
    forceLevel = _ref.level,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'section' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  var parentContext = (0, _react.useContext)(_context["default"]);
  var level = forceLevel !== null && forceLevel !== void 0 ? forceLevel : parentContext.level + 1;
  var headingId = "".concat(id, "-title");
  var ariaProps = {
    'aria-labelledby': headingId
  };
  var currentContext = {
    level: level,
    id: id,
    headingId: headingId
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread(_objectSpread({
    ref: ref
  }, ariaProps), restProps), {}, {
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_context["default"].Provider, {
      value: currentContext,
      children: children
    })
  }));
});
Section.propTypes = {
  /**
   * A section level to force the current section heading level over the one
   * passed via the context.
   *
   * If `null` or no value (`undefined`) is passed, the prop is ignored.
   * Otherwise, it forces descendent Heading to use the passed level.
   *
   * Be aware, forcing the section level impacts not only the current section
   * heading but all descendent sections too.
   *
   * The prop is created to provide the full control over the component if
   * the automatic system does not work. However, we recommend avoid using it.
   */
  level: _propTypes["default"].oneOf([undefined, null, 1, 2, 3, 4, 5, 6])
};
var _default = Section;
exports["default"] = _default;