"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _propTypes = _interopRequireDefault(require("prop-types"));
var _button = _interopRequireDefault(require("../button"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className", "sticky", "order", "onClick", "tag"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "sticky": "styles-sticky-3tUpM",
  "head-cell": "styles-head-cell-y0nGZ",
  "sortable": "styles-sortable-1hV1a",
  "asc": "styles-asc-1uDJb",
  "desc": "styles-desc-3B49S",
  "headCell": "styles-head-cell-y0nGZ"
};
/**
 * Simple table cell component for headings.
 */
var getSortOrder = function getSortOrder(order) {
  switch (order) {
    case 'asc':
      return ['ascending', 'Sorted ascending'];
    case 'desc':
      return ['descending', 'Sorted descending'];
    case null:
      return ['none', 'Not sortable'];
    default:
      return ['none', 'Not sorted'];
  }
};
var HeadCell = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var children = _ref.children,
    className = _ref.className,
    _ref$sticky = _ref.sticky,
    sticky = _ref$sticky === void 0 ? false : _ref$sticky,
    _ref$order = _ref.order,
    order = _ref$order === void 0 ? null : _ref$order,
    onClick = _ref.onClick,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'th' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({
    className: _utils.classNames.use({
      sticky: sticky,
      headCell: true,
      sortable: order != null,
      asc: order === 'asc',
      desc: order === 'desc'
    }).from(styles).join(className),
    ref: ref,
    role: "columnheader",
    "aria-sort": getSortOrder(order)[0],
    scope: "col"
  }, restProps), {}, {
    children: /*#__PURE__*/(0, _jsxRuntime.jsxs)(_button["default"], {
      type: "button",
      tabIndex: 0,
      "aria-disabled": order === null,
      onClick: onClick,
      children: [children, /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
        className: "sr-only",
        children: getSortOrder(order)[1]
      })]
    })
  }));
});
HeadCell.propTypes = {
  sticky: _propTypes["default"].bool,
  order: _propTypes["default"].oneOf([null, 'any', 'asc', 'desc']),
  onClick: _propTypes["default"].func
};
var _default = HeadCell;
exports["default"] = _default;