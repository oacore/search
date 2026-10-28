"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = require("react");
var _reactSlick = _interopRequireDefault(require("react-slick"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "className", "slidesToShow", "slidesToScroll", "dots", "infinite", "useArrows", "autoplay", "autoplaySpeed", "draggable", "pauseOnFocus", "indicatorClass"];
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var style = {
  "carousel-indicators": "carousel-carousel-indicators-8P0hm",
  "carousel-indicator": "carousel-carousel-indicator-O5QQD",
  "carousel-indicator-active": "carousel-carousel-indicator-active-1Y1G5",
  "icon-prev": "carousel-icon-prev-3TDss",
  "icon-next": "carousel-icon-next-38RRP",
  "arrow-prev": "carousel-arrow-prev-3G3tO",
  "arrow-next": "carousel-arrow-next-3TXpt",
  "carouselIndicators": "carousel-carousel-indicators-8P0hm",
  "carouselIndicator": "carousel-carousel-indicator-O5QQD",
  "carouselIndicatorActive": "carousel-carousel-indicator-active-1Y1G5",
  "iconPrev": "carousel-icon-prev-3TDss",
  "iconNext": "carousel-icon-next-38RRP",
  "arrowPrev": "carousel-arrow-prev-3G3tO",
  "arrowNext": "carousel-arrow-next-3TXpt"
};
var CustomArrow = /*#__PURE__*/(0, _react.memo)(function (_ref) {
  var className = _ref.className,
    onClick = _ref.onClick,
    iconClass = _ref.iconClass,
    arrowClass = _ref.arrowClass;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    className: _utils.classNames.use(className, iconClass),
    onClick: onClick,
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: _utils.classNames.use(arrowClass)
    })
  });
});
var Carousel = /*#__PURE__*/(0, _react.memo)(function (_ref2) {
  var children = _ref2.children,
    className = _ref2.className,
    _ref2$slidesToShow = _ref2.slidesToShow,
    slidesToShow = _ref2$slidesToShow === void 0 ? 2 : _ref2$slidesToShow,
    _ref2$slidesToScroll = _ref2.slidesToScroll,
    slidesToScroll = _ref2$slidesToScroll === void 0 ? 1 : _ref2$slidesToScroll,
    _ref2$dots = _ref2.dots,
    dots = _ref2$dots === void 0 ? true : _ref2$dots,
    _ref2$infinite = _ref2.infinite,
    infinite = _ref2$infinite === void 0 ? true : _ref2$infinite,
    _ref2$useArrows = _ref2.useArrows,
    useArrows = _ref2$useArrows === void 0 ? true : _ref2$useArrows,
    _ref2$autoplay = _ref2.autoplay,
    autoplay = _ref2$autoplay === void 0 ? true : _ref2$autoplay,
    _ref2$autoplaySpeed = _ref2.autoplaySpeed,
    autoplaySpeed = _ref2$autoplaySpeed === void 0 ? 5000 : _ref2$autoplaySpeed,
    _ref2$draggable = _ref2.draggable,
    draggable = _ref2$draggable === void 0 ? true : _ref2$draggable,
    _ref2$pauseOnFocus = _ref2.pauseOnFocus,
    pauseOnFocus = _ref2$pauseOnFocus === void 0 ? true : _ref2$pauseOnFocus,
    indicatorClass = _ref2.indicatorClass,
    passProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded);
  var _useState = (0, _react.useState)(0),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    activeSlide = _useState2[0],
    setActiveSlide = _useState2[1];
  var settings = {
    dots: dots,
    infinite: infinite,
    slidesToShow: slidesToShow,
    slidesToScroll: slidesToScroll,
    arrows: useArrows,
    autoplay: autoplay,
    autoplaySpeed: autoplaySpeed,
    draggable: draggable,
    indicatorClass: indicatorClass,
    pauseOnFocus: pauseOnFocus,
    dotsClass: _utils.classNames.use(style.carouselIndicators, (0, _defineProperty2["default"])({}, indicatorClass, indicatorClass)),
    prevArrow: /*#__PURE__*/(0, _jsxRuntime.jsx)(CustomArrow, {
      iconClass: style.iconPrev,
      arrowClass: style.arrowPrev
    }),
    nextArrow: /*#__PURE__*/(0, _jsxRuntime.jsx)(CustomArrow, {
      iconClass: style.iconNext,
      arrowClass: style.arrowNext
    }),
    customPaging: function customPaging(index) {
      return /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
        className: _utils.classNames.use(style.carouselIndicator, (0, _defineProperty2["default"])({}, style.carouselIndicatorActive, index === activeSlide))
      });
    },
    beforeChange: function beforeChange(_, next) {
      setActiveSlide(next);
    },
    responsive: [{
      breakpoint: 800,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1
      }
    }]
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactSlick["default"], _objectSpread(_objectSpread(_objectSpread({}, settings), passProps), {}, {
      children: children
    }))
  });
});
var _default = Carousel;
exports["default"] = _default;