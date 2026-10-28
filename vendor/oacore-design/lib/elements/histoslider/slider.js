"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _jsxRuntime = require("react/jsx-runtime");
var _this = void 0;
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var styles = {
  "histoslider": "histoslider-histoslider-e1hL_",
  "range": "histoslider-range-gykSf",
  "range-dots": "histoslider-range-dots-1a0Ci",
  "histograms": "histoslider-histograms-jkdFi",
  "histogram-item": "histoslider-histogram-item-2QAoA",
  "label-left": "histoslider-label-left-2oGjf",
  "label-right": "histoslider-label-right-1uA2E",
  "info": "histoslider-info-3X3gT",
  "info-box": "histoslider-info-box-TwKDC",
  "rangeDots": "histoslider-range-dots-1a0Ci",
  "histogramItem": "histoslider-histogram-item-2QAoA",
  "labelLeft": "histoslider-label-left-2oGjf",
  "labelRight": "histoslider-label-right-1uA2E",
  "infoBox": "histoslider-info-box-TwKDC"
};
var Slider = function Slider(_ref) {
  var propsSelection = _ref.selection,
    scale = _ref.scale,
    width = _ref.width,
    height = _ref.height,
    reset = _ref.reset,
    rangeColor = _ref.rangeColor,
    unselectedColor = _ref.unselectedColor,
    showLabels = _ref.showLabels,
    onChange = _ref.onChange,
    dragChange = _ref.dragChange;
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    dragging = _useState2[0],
    setDragging = _useState2[1];
  var _useState3 = (0, _react.useState)(),
    _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
    dragIndex = _useState4[0],
    setDragIndex = _useState4[1];
  var dragStart = function dragStart(index, e) {
    e.stopPropagation();
    if (!dragging) {
      setDragging(true);
      setDragIndex(index);
      dragChange(true);
    }
  };
  var dragEnd = function dragEnd(e) {
    e.stopPropagation();
    setDragging(false);
    setDragIndex(null);
    dragChange(false);
  };
  (0, _react.useEffect)(function () {
    window.addEventListener('mouseup', dragEnd, false);
    return function () {
      return window.removeEventListener('mouseup', dragEnd, false);
    };
  }, []);
  var dragFromSVG = function dragFromSVG(e) {
    if (!dragging) {
      var selection = (0, _toConsumableArray2["default"])(propsSelection);
      var selected = scale.invert(e.nativeEvent.offsetX);
      var svgDragIndex;
      if (Math.abs(selected - selection[0]) > Math.abs(selected - selection[1])) {
        selection[1] = selected;
        svgDragIndex = 0;
      } else {
        selection[0] = selected;
        svgDragIndex = 1;
      }
      onChange(selection);
      setDragging(true);
      setDragIndex(svgDragIndex);
      dragChange(true);
    }
  };
  var mouseMove = function mouseMove(e) {
    if (dragging) {
      var selection = (0, _toConsumableArray2["default"])(propsSelection);
      selection[dragIndex] = Math.round(scale.invert(e.nativeEvent.offsetX));
      onChange(selection);
    }
  };
  var selectionWidth = Math.abs(scale(propsSelection[1]) - scale(propsSelection[0]));
  var selectionSorted = Array.from(propsSelection).sort(function (a, b) {
    return +a - +b;
  });
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    className: styles.range,
    children: [showLabels ? /*#__PURE__*/(0, _jsxRuntime.jsxs)(_jsxRuntime.Fragment, {
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
        className: styles.labelLeft,
        children: propsSelection[0]
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
        className: styles.labelRight,
        children: propsSelection[1] - 1
      })]
    }) : null, /*#__PURE__*/(0, _jsxRuntime.jsxs)("svg", {
      style: {
        overflow: 'visible',
        marginBottom: showLabels ? '4rem' : '0'
      },
      height: height,
      width: width,
      onMouseDown: dragFromSVG,
      onDoubleClick: reset,
      onMouseMove: mouseMove,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("rect", {
        height: 4,
        fill: unselectedColor,
        x: 0,
        y: 10,
        width: width
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)("rect", {
        height: 4,
        fill: rangeColor,
        x: scale(selectionSorted[0]),
        y: 10,
        width: selectionWidth
      }), propsSelection.map(function (m, i) {
        return /*#__PURE__*/(0, _jsxRuntime.jsxs)("g", {
          tabIndex: 0,
          transform: "translate(".concat(scale(m), ", 0)"),
          style: {
            outline: 'none'
          },
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("circle", {
            style: {
              fill: rangeColor,
              stroke: rangeColor
            },
            r: 9,
            cx: 0,
            cy: 12.5,
            strokeWidth: "1"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)("circle", {
            style: {
              fill: rangeColor,
              stroke: rangeColor
            },
            onMouseDown: dragStart.bind(_this, i),
            r: 9,
            cx: 0,
            cy: 12,
            strokeWidth: "1",
            className: styles.rangeDots
          })]
        }, "handle-".concat(m));
      })]
    })]
  });
};
Slider.displayName = "Slider";
Slider.propTypes = {
  selection: _propTypes["default"].arrayOf(_propTypes["default"].number).isRequired,
  height: _propTypes["default"].number,
  width: _propTypes["default"].number,
  scale: _propTypes["default"].func,
  reset: _propTypes["default"].func,
  dragChange: _propTypes["default"].func,
  onChange: _propTypes["default"].func,
  showLabels: _propTypes["default"].bool,
  rangeColor: _propTypes["default"].string,
  unselectedColor: _propTypes["default"].string
};
var _default = Slider;
exports["default"] = _default;