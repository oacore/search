"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useDesignContext = exports.initialState = exports["default"] = exports.DesignProvider = exports.DesignContext = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
var _context = require("./modules/header/context");
var _jsxRuntime = require("react/jsx-runtime");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var initialState = {
  header: _context.headerInitialState
};
exports.initialState = initialState;
var DesignContext = /*#__PURE__*/_react["default"].createContext(null);
exports.DesignContext = DesignContext;
var reducer = function reducer(_ref, action) {
  var header = _ref.header;
  return {
    header: (0, _context.headerReducer)(header, action)
  };
};
var useDesignContext = function useDesignContext() {
  var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    _ref2$skipUninitializ = _ref2.skipUninitializedWarning,
    skipUninitializedWarning = _ref2$skipUninitializ === void 0 ? false : _ref2$skipUninitializ;
  var context = (0, _react.useContext)(DesignContext);
  if (context === null && process.env.NODE_ENV !== 'production' && !skipUninitializedWarning) {
    console.warn("DesignContext hasn't been initialized yet.\n       Please wrap your application with <DesignProvider /> component.");
  }
  return context !== null && context !== void 0 ? context : [initialState, function () {}];
};
exports.useDesignContext = useDesignContext;
var DesignProvider = function DesignProvider(_ref3) {
  var children = _ref3.children;
  var _useReducer = (0, _react.useReducer)(reducer, initialState),
    _useReducer2 = (0, _slicedToArray2["default"])(_useReducer, 2),
    state = _useReducer2[0],
    dispatch = _useReducer2[1];
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(DesignContext.Provider, {
    value: [state, dispatch],
    children: children
  });
};
exports.DesignProvider = DesignProvider;
DesignProvider.displayName = "DesignProvider";
var _default = DesignProvider;
exports["default"] = _default;