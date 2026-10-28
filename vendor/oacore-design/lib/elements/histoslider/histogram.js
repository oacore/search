"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireDefault(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _this = void 0;
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
var Histogram = function Histogram(_ref) {
  var height = _ref.height,
    data = _ref.data,
    selection = _ref.selection,
    reset = _ref.reset,
    selectedBarColor = _ref.selectedBarColor,
    unselectedColor = _ref.unselectedColor,
    scale = _ref.scale,
    barBorderRadius = _ref.barBorderRadius,
    barPadding = _ref.barPadding,
    width = _ref.width,
    max = _ref.max,
    onChange = _ref.onChange,
    showLabels = _ref.showLabels;
  var _React$useState = _react["default"].useState({
      displaybox: 'block'
    }),
    _React$useState2 = (0, _slicedToArray2["default"])(_React$useState, 2),
    style = _React$useState2[0],
    setStyle = _React$useState2[1];
  var _React$useState3 = _react["default"].useState({
      year: null,
      count: null
    }),
    _React$useState4 = (0, _slicedToArray2["default"])(_React$useState3, 2),
    hoveredItem = _React$useState4[0],
    setHoveredItem = _React$useState4[1];
  var selectBucket = function selectBucket(bucket) {
    onChange([bucket.x0, bucket.x]);
  };
  var onHoverItem = function onHoverItem(bucket) {
    setStyle({
      displaybox: 'block'
    });
    setHoveredItem({
      year: bucket.x0,
      count: bucket.y
    });
  };
  var onLeaveItem = function onLeaveItem() {
    setStyle({
      displaybox: 'none'
    });
    setHoveredItem({
      year: null,
      count: null
    });
  };
  var selectionSorted = Array.from(selection).sort(function (a, b) {
    return +a - +b;
  });
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_jsxRuntime.Fragment, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("svg", {
      width: width,
      height: height,
      className: styles.histograms,
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)("g", {
        transform: "translate(0, ".concat(height, ")"),
        children: /*#__PURE__*/(0, _jsxRuntime.jsx)("g", {
          transform: "scale(1,-1)",
          children: data.map(function (bucket) {
            var color = unselectedColor;
            if (selectionSorted[0] > bucket.x || selectionSorted[1] < bucket.x0) color = unselectedColor;else if (selectionSorted[0] <= bucket.x0 && selectionSorted[1] >= bucket.x) {
              // Entire block is covered
              color = selectedBarColor;
            }
            return /*#__PURE__*/(0, _jsxRuntime.jsxs)("g", {
              transform: "translate(".concat(scale(bucket.x0) + barPadding / 2, " 0)"),
              children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("rect", {
                fill: unselectedColor,
                width: scale(bucket.x) - scale(bucket.x0) - barPadding,
                height: bucket.y / max * height,
                rx: barBorderRadius,
                ry: barBorderRadius,
                x: 0
              }), /*#__PURE__*/(0, _jsxRuntime.jsx)("rect", {
                fill: color,
                onClick: selectBucket.bind(_this, bucket),
                onDoubleClick: reset.bind(_this),
                style: {
                  cursor: 'pointer'
                },
                width: scale(bucket.x) - scale(bucket.x0) - barPadding,
                height: bucket.y / max * height,
                x: 0,
                onMouseEnter: function onMouseEnter() {
                  return onHoverItem(bucket);
                },
                onMouseLeave: onLeaveItem,
                className: _utils.classNames.use(styles.histogramItem)
              })]
            }, bucket.x0);
          })
        })
      })
    }), showLabels && hoveredItem.year && /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      style: {
        display: style.displaybox
      },
      className: styles.info,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
        children: hoveredItem.year
      }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
        className: styles.infoBox,
        children: ["Articles - ", /*#__PURE__*/(0, _jsxRuntime.jsxs)("span", {
          children: [" ", hoveredItem.count]
        })]
      })]
    })]
  });
};
var _default = Histogram;
exports["default"] = _default;
Histogram.propTypes = {
  data: _propTypes["default"].arrayOf(_propTypes["default"].shape({
    x0: _propTypes["default"].number,
    x: _propTypes["default"].number,
    y: _propTypes["default"].number
  })).isRequired,
  selection: _propTypes["default"].arrayOf(_propTypes["default"].number).isRequired,
  barBorderRadius: _propTypes["default"].number,
  width: _propTypes["default"].number,
  height: _propTypes["default"].number,
  reset: _propTypes["default"].func,
  onChange: _propTypes["default"].func,
  showLabels: _propTypes["default"].bool,
  selectedBarColor: _propTypes["default"].string,
  unselectedColor: _propTypes["default"].string,
  scale: _propTypes["default"].func,
  barPadding: _propTypes["default"].number,
  max: _propTypes["default"].number
};