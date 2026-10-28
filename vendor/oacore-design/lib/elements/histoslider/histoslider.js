"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireDefault(require("react"));
var _d3Array = require("d3-array");
var _d3Scale = require("d3-scale");
var _propTypes = _interopRequireDefault(require("prop-types"));
var _histogram = _interopRequireDefault(require("./histogram"));
var _slider = _interopRequireDefault(require("./slider"));
var _utils = require("../../utils");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["data", "width", "height", "padding", "sliderHeight", "selection", "selectFunc", "className"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
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
var Histoslider = function Histoslider(_ref) {
  var data = _ref.data,
    width = _ref.width,
    height = _ref.height,
    padding = _ref.padding,
    sliderHeight = _ref.sliderHeight,
    propsSelection = _ref.selection,
    selectFunc = _ref.selectFunc,
    className = _ref.className,
    props = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  var _React$useState = _react["default"].useState(false),
    _React$useState2 = (0, _slicedToArray2["default"])(_React$useState, 2),
    dragging = _React$useState2[0],
    setDragging = _React$useState2[1];
  var dragChange = function dragChange(drag) {
    setDragging(drag);
  };
  var onChange = function onChange(selection) {
    var sortedData = data.sort(function (a, b) {
      return +a.x0 - +b.x0;
    });
    var extent = [(0, _d3Array.min)(sortedData, function (_ref2) {
      var x0 = _ref2.x0;
      return +x0;
    }), (0, _d3Array.max)(sortedData, function (_ref3) {
      var x = _ref3.x;
      return +x;
    })];
    selectFunc(selection.map(function (d) {
      return Math.max(extent[0], Math.min(extent[1], +d));
    }));
  };
  var reset = function reset() {
    selectFunc([data[0].x0, data[data.length - 1].x0 + 1]);
  };
  var innerHeight = height - padding * 2;
  var innerWidth = width - padding * 2;
  var histogramHeight = innerHeight - sliderHeight;
  var sortedData = data.sort(function (a, b) {
    return +a.x0 - +b.x0;
  });
  var extent = [(0, _d3Array.min)(sortedData, function (_ref4) {
    var x0 = _ref4.x0;
    return +x0;
  }), (0, _d3Array.max)(sortedData, function (_ref5) {
    var x = _ref5.x;
    return +x;
  })];
  var maxValue = (0, _d3Array.max)(sortedData, function (_ref6) {
    var y = _ref6.y;
    return +y;
  });
  var scale = (0, _d3Scale.scaleLinear)().domain(extent).range([0, innerWidth]);
  scale.clamp(true);
  var selection = propsSelection || extent;
  var overrides = {
    selection: selection,
    data: sortedData,
    dragChange: dragChange,
    dragging: dragging,
    scale: scale,
    max: maxValue,
    onChange: onChange,
    reset: reset,
    width: innerWidth
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    style: {
      width: width,
      padding: padding
    },
    className: _utils.classNames.use(styles.histoslider).join(className),
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_histogram["default"], _objectSpread({}, _objectSpread(_objectSpread(_objectSpread({}, props), overrides), {}, {
      height: histogramHeight
    }))), /*#__PURE__*/(0, _jsxRuntime.jsx)(_slider["default"], _objectSpread({}, _objectSpread(_objectSpread(_objectSpread({}, props), overrides), {}, {
      height: sliderHeight
    })))]
  });
};
Histoslider.displayName = "Histoslider";
Histoslider.propTypes = {
  data: _propTypes["default"].arrayOf(_propTypes["default"].shape({
    x0: _propTypes["default"].number,
    x: _propTypes["default"].number,
    y: _propTypes["default"].number
  })).isRequired,
  selectFunc: _propTypes["default"].func.isRequired,
  selectedBarColor: _propTypes["default"].string,
  unselectedColor: _propTypes["default"].string,
  rangeColor: _propTypes["default"].string,
  width: _propTypes["default"].number,
  height: _propTypes["default"].number,
  selection: _propTypes["default"].arrayOf(_propTypes["default"].number),
  barBorderRadius: _propTypes["default"].number,
  barPadding: _propTypes["default"].number,
  padding: _propTypes["default"].number,
  showOnDrag: _propTypes["default"].bool,
  sliderHeight: _propTypes["default"].number,
  handleLabelFormat: _propTypes["default"].string,
  formatLabelFunction: _propTypes["default"].func,
  disableHistogram: _propTypes["default"].bool,
  showLabels: _propTypes["default"].bool
};
Histoslider.defaultProps = {
  selectedBarColor: '#EF8237',
  rangeColor: '#b75400',
  unselectedColor: '#E0E0E0',
  showOnDrag: false,
  width: 300,
  height: 200,
  barBorderRadius: 2,
  barPadding: 2,
  padding: 20,
  sliderHeight: 20,
  handleLabelFormat: '0.5P',
  formatLabelFunction: undefined,
  showLabels: false
};
var _default = Histoslider;
exports["default"] = _default;