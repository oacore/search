"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
var _reactMarkdown = _interopRequireDefault(require("react-markdown"));
var _utils = require("../../utils");
var _icon = _interopRequireDefault(require("../../elements/icon"));
var _jsxRuntime = require("react/jsx-runtime");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var styles = {
  "sider-wrapper": "styles-sider-wrapper-23svF",
  "sider-mullty": "styles-sider-mullty-YCsf4",
  "sider": "styles-sider-REoIr",
  "sider-item": "styles-sider-item-3S136",
  "sider-item-link": "styles-sider-item-link-3bySb",
  "active-item": "styles-active-item-Q39r_",
  "hidden-item": "styles-hidden-item-1_tzA",
  "logo": "styles-logo-34_HR",
  "placeholder": "styles-placeholder-1L-aO",
  "siderWrapper": "styles-sider-wrapper-23svF",
  "siderMullty": "styles-sider-mullty-YCsf4",
  "siderItem": "styles-sider-item-3S136",
  "siderItemLink": "styles-sider-item-link-3bySb",
  "activeItem": "styles-active-item-Q39r_",
  "hiddenItem": "styles-hidden-item-1_tzA"
};
var DocumentationMembershipNav = function DocumentationMembershipNav(_ref) {
  var textData = _ref.textData,
    setHighlight = _ref.setHighlight,
    activeIndex = _ref.activeIndex,
    setNavActiveIndex = _ref.setNavActiveIndex,
    mulltyDocs = _ref.mulltyDocs;
  var _useState = (0, _react.useState)(null),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    activeItem = _useState2[0],
    setActiveItem = _useState2[1];
  var headerHeight = 56;
  var mobileHeaderHeight = 150;
  var handleClick = function handleClick(obj, item) {
    window.location.href = obj.href;
    setActiveItem(item);
    setHighlight(+item);
    setNavActiveIndex(null);
    var element = document.getElementById(obj.href.replace('#', ''));
    if (element) {
      var rect = element.getBoundingClientRect();
      var isMobile = window.matchMedia('(max-width: 768px)').matches;
      var adjustedHeaderHeight = isMobile ? mobileHeaderHeight : headerHeight;
      window.scrollTo({
        top: rect.top + window.scrollY - adjustedHeaderHeight,
        behavior: 'smooth',
        block: 'center'
      });
    }
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    className: _utils.classNames.use((0, _defineProperty2["default"])({}, styles.siderWrapper, mulltyDocs)),
    children: [mulltyDocs && /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: styles.placeholder,
      children: "Outline"
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("ul", {
      className: styles.sider,
      children: Object.values(textData.navItems).map(function (item, i) {
        var _classNames$use2;
        return (
          /*#__PURE__*/
          // eslint-disable-next-line max-len
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions,jsx-a11y/click-events-have-key-events
          (0, _jsxRuntime.jsxs)("li", {
            className: _utils.classNames.use(styles.siderItem, (_classNames$use2 = {}, (0, _defineProperty2["default"])(_classNames$use2, styles.hiddenItem, item.hidden), (0, _defineProperty2["default"])(_classNames$use2, styles.activeItem, !activeIndex ? activeItem === i : activeIndex === i), _classNames$use2)),
            onClick: function onClick() {
              return handleClick(item, i);
            },
            children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactMarkdown["default"], {
              className: styles.siderItemLink,
              children: item.item
            }), activeItem === i || activeIndex === i ? /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
              className: styles.logo,
              children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
                src: "#active-arrow"
              })
            }) : '']
          }, item.item)
        );
      })
    })]
  });
};
DocumentationMembershipNav.displayName = "DocumentationMembershipNav";
var _default = DocumentationMembershipNav;
exports["default"] = _default;