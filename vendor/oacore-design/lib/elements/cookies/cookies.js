"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
var _popup = _interopRequireDefault(require("./popup"));
var _hooks = require("../../hooks");
var _jsxRuntime = require("react/jsx-runtime");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
// eslint-disable-next-line import/no-cycle

var Cookies = function Cookies() {
  var cookieHandler = (0, _hooks.useCookieHandler)();
  var _useState = (0, _react.useState)(!(0, _hooks.useCookie)('essential_cookies_allowed')),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    visibleCookiePopup = _useState2[0],
    setVisibleCookiePopup = _useState2[1];
  var cookieItems = (0, _hooks.useCookieItems)();
  var cookieItemNames = cookieItems.map(function (_ref) {
    var name = _ref.name;
    return name;
  });
  (0, _react.useEffect)(function () {
    if (typeof window !== 'undefined' && window.location.pathname === '/cookies') setVisibleCookiePopup(false);
  }, []);
  var onAcceptCookies = (0, _react.useCallback)(function (e) {
    setVisibleCookiePopup(false);
    cookieHandler(e);
  }, []);
  return visibleCookiePopup && typeof window !== 'undefined' && /*#__PURE__*/(0, _jsxRuntime.jsx)(_popup["default"], {
    onSubmit: onAcceptCookies,
    cookieItems: cookieItemNames
  });
};
var _default = Cookies;
exports["default"] = _default;