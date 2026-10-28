"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireDefault(require("react"));
var _ = require("..");
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var styles = {
  "fieldset": "fieldset-fieldset-2vQmh",
  "title": "fieldset-title-1yf3g",
  "boxes": "fieldset-boxes-3_sDQ",
  "box-item": "fieldset-box-item-2sAPu",
  "box-item-active": "fieldset-box-item-active-3j3M-",
  "description": "fieldset-description-ScE_H",
  "icon": "fieldset-icon-2Y8M1",
  "boxItem": "fieldset-box-item-2sAPu",
  "boxItemActive": "fieldset-box-item-active-3j3M-"
}; // eslint-disable-next-line import/no-cycle
var Fieldset = function Fieldset(_ref) {
  var className = _ref.className,
    items = _ref.items,
    icon = _ref.icon,
    onClick = _ref.onClick,
    title = _ref.title;
  var _React$useState = _react["default"].useState(),
    _React$useState2 = (0, _slicedToArray2["default"])(_React$useState, 2),
    activeBox = _React$useState2[0],
    setActiveBox = _React$useState2[1];
  _react["default"].useEffect(function () {
    setActiveBox(items[0].value);
  }, []);
  var onHandleClick = function onHandleClick(value) {
    onClick(value);
    setActiveBox(value);
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("fieldset", {
    className: _utils.classNames.use(styles.fieldset).join(className),
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("legend", {
      className: styles.title,
      children: title
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: styles.boxes,
      children: items.map(function (_ref2) {
        var label = _ref2.label,
          id = _ref2.id,
          value = _ref2.value;
        return /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Card, {
          variant: "outlined",
          className: _utils.classNames.use(styles.boxItem, (0, _defineProperty2["default"])({}, styles.boxItemActive, activeBox === value)),
          onClick: function onClick() {
            return onHandleClick(value);
          },
          children: /*#__PURE__*/(0, _jsxRuntime.jsxs)(_.Card.Description, {
            className: styles.description,
            children: [icon && /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Icon, {
              src: icon,
              className: styles.icon
            }), /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
              children: label
            })]
          })
        }, id);
      })
    })]
  });
};
Fieldset.displayName = "Fieldset";
var _default = Fieldset;
exports["default"] = _default;