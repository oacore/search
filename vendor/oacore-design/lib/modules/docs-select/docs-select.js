"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
var _icon = _interopRequireDefault(require("../../elements/icon"));
var _jsxRuntime = require("react/jsx-runtime");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var styles = {
  "document-select": "styles-document-select-2X464",
  "document-select-label": "styles-document-select-label-2EG_W",
  "arrow": "styles-arrow-2bf5c",
  "document-dropdown": "styles-document-dropdown-1B3x8",
  "document-item": "styles-document-item-rtrfz",
  "documentSelect": "styles-document-select-2X464",
  "documentSelectLabel": "styles-document-select-label-2EG_W",
  "documentDropdown": "styles-document-dropdown-1B3x8",
  "documentItem": "styles-document-item-rtrfz"
};
var DocumentSelect = function DocumentSelect(_ref) {
  var list = _ref.list,
    handleSelect = _ref.handleSelect,
    selectedOption = _ref.selectedOption;
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    showOptions = _useState2[0],
    setShowOptions = _useState2[1];
  var dropdownRef = (0, _react.useRef)(null);
  var onSelectOptionClick = function onSelectOptionClick(option) {
    handleSelect(option);
    setShowOptions(false);
  };
  var handleClickOutside = function handleClickOutside(event) {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowOptions(false);
  };
  (0, _react.useEffect)(function () {
    document.addEventListener('click', handleClickOutside);
    return function () {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    className: styles.documentSelect,
    ref: dropdownRef,
    children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      onClick: function onClick() {
        return setShowOptions(!showOptions);
      },
      className: styles.documentSelectLabel,
      children: [selectedOption, /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
        className: styles.arrow,
        src: "#drop-arrow"
      })]
    }), showOptions && /*#__PURE__*/(0, _jsxRuntime.jsx)("ul", {
      className: styles.documentDropdown,
      children: list.map(function (option) {
        return (
          /*#__PURE__*/
          // eslint-disable-next-line max-len
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-noninteractive-element-interactions
          (0, _jsxRuntime.jsx)("li", {
            className: styles.documentItem,
            onClick: function onClick() {
              return onSelectOptionClick(option);
            },
            children: option
          }, option)
        );
      })
    })]
  });
};
DocumentSelect.displayName = "DocumentSelect";
var _default = DocumentSelect;
exports["default"] = _default;