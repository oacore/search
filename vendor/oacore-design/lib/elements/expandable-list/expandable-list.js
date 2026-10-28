"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireWildcard(require("react"));
var _ = require("..");
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children"],
  _excluded2 = ["children", "className"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "list": "expandable-list-list-2znM0",
  "show-more": "expandable-list-show-more-2ndlc",
  "hide": "expandable-list-hide-2DCLG",
  "showMore": "expandable-list-show-more-2ndlc"
}; // eslint-disable-next-line import/no-cycle
var ExpandableListItem = function ExpandableListItem(_ref) {
  var children = _ref.children,
    htmlProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("li", _objectSpread(_objectSpread({}, htmlProps), {}, {
    children: children
  }));
};
ExpandableListItem.displayName = "ExpandableListItem";
var ExpandableList = function ExpandableList(_ref2) {
  var children = _ref2.children,
    className = _ref2.className,
    htmlProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded2);
  var showMoreRef = (0, _react.useRef)(null);
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    isExpanded = _useState2[0],
    setIsExpanded = _useState2[1];
  (0, _react.useEffect)(function () {
    if (isExpanded) {
      try {
        showMoreRef.current.parentElement.nextElementSibling.firstChild.focus();
      } catch (e) {
        // ignore error when element is not focusable,
        // i.e. element is for example just text node
      }
    }
  }, [isExpanded]);
  var childrenArray = _react["default"].Children.toArray(children);
  if (childrenArray.length <= 4) {
    return /*#__PURE__*/(0, _jsxRuntime.jsx)("ol", _objectSpread(_objectSpread({
      className: _utils.classNames.use(styles.list).join(className)
    }, htmlProps), {}, {
      children: childrenArray
    }));
  }
  var handleButtonClick = (0, _react.useCallback)(function () {
    if (!isExpanded) setIsExpanded(true);
  }, [isExpanded]);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("ol", _objectSpread(_objectSpread({
    className: _utils.classNames.use(styles.list).join(className)
  }, htmlProps), {}, {
    children: [/*#__PURE__*/_react["default"].cloneElement(childrenArray[0], {
      'aria-setsize': childrenArray.length
    }), /*#__PURE__*/_react["default"].cloneElement(childrenArray[1], {
      'aria-setsize': childrenArray.length
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("li", {
      "aria-setsize": childrenArray.length,
      className: _utils.classNames.use(styles.showMore, isExpanded && styles.hide),
      children: /*#__PURE__*/(0, _jsxRuntime.jsxs)(_.Button, {
        ref: showMoreRef,
        onFocus: handleButtonClick
        /* onFocus doesn't work in Safari hence additional listener */,
        onClick: handleButtonClick,
        title: "Show more",
        children: ["+", childrenArray.length - 2, "\xA0more"]
      })
    }), childrenArray.slice(2).map(function (el) {
      return /*#__PURE__*/_react["default"].cloneElement(el, {
        'aria-setsize': childrenArray.length,
        'className': _utils.classNames.use(!isExpanded && styles.hide, el.props.className)
      });
    })]
  }));
};
ExpandableList.displayName = "ExpandableList";
ExpandableList.displayName = 'ExpandableList';
ExpandableListItem.displayName = 'ExpandableList.Item';
ExpandableList.Item = ExpandableListItem;
var _default = ExpandableList;
exports["default"] = _default;