"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useCookieItems = exports.useCookieHandler = exports.useCookie = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = require("react");
var _reactCookie = require("react-cookie");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var cookiesContext = [{
  id: 'essential',
  name: 'essential_cookies_allowed',
  "default": false,
  required: true,
  title: 'Essential cookies only',
  description: '**Required** to make the site work, and to save the options you make here'
}, {
  id: 'analytics',
  name: 'analytics_cookies_allowed',
  "default": false,
  required: false,
  title: 'Analytics allowed',
  description: 'Lets us (anonymously) track site usage, so that we can measure performance and make improvements'
}];
var convertCookieValue = function convertCookieValue(value) {
  var cookieValue = value;
  if (['true', 'false'].includes(cookieValue)) cookieValue = cookieValue === 'true';
  return cookieValue;
};
var useCookieItems = function useCookieItems() {
  var _useCookies = (0, _reactCookie.useCookies)(),
    _useCookies2 = (0, _slicedToArray2["default"])(_useCookies, 1),
    cookies = _useCookies2[0];
  return cookiesContext.map(function (cookie) {
    // convert cookie to its boolean representation
    var cookieValue = convertCookieValue(cookies[cookie.name]);
    return _objectSpread(_objectSpread({}, cookie), {}, {
      value: cookieValue !== null && cookieValue !== void 0 ? cookieValue : cookie["default"]
    });
  });
};
exports.useCookieItems = useCookieItems;
var useCookie = function useCookie(cookieName) {
  var _cookiesContext$find;
  var _useCookies3 = (0, _reactCookie.useCookies)([cookieName]),
    _useCookies4 = (0, _slicedToArray2["default"])(_useCookies3, 1),
    cookies = _useCookies4[0];
  var cookieValue = convertCookieValue(cookies[cookieName]);
  return cookieValue !== null && cookieValue !== void 0 ? cookieValue : (_cookiesContext$find = cookiesContext.find(function (_ref) {
    var name = _ref.name;
    return name === cookieName;
  })) === null || _cookiesContext$find === void 0 ? void 0 : _cookiesContext$find["default"];
};
exports.useCookie = useCookie;
var useCookieHandler = function useCookieHandler() {
  var _useCookies5 = (0, _reactCookie.useCookies)(),
    _useCookies6 = (0, _slicedToArray2["default"])(_useCookies5, 3),
    setCookie = _useCookies6[1],
    removeCookie = _useCookies6[2];
  var items = useCookieItems();
  return (0, _react.useCallback)(function (event) {
    event.preventDefault();
    cookiesContext.forEach(function (_ref2) {
      var name = _ref2.name;
      return removeCookie(name);
    });
    var idsArray = event.target.id.split(',');
    var patch;
    // accept only essential cookies
    if (idsArray.length === 1) {
      patch = items.filter(function (el) {
        return el.name === idsArray[0];
      }).map(function (_ref3) {
        var name = _ref3.name;
        return [name, true];
      });
    }
    // assuming when user hit accept in popup form we accept all cookies
    else {
      patch = items.filter(function (_ref4) {
        var name = _ref4.name;
        return idsArray.includes(name);
      }).map(function (_ref5) {
        var name = _ref5.name;
        return [name, true];
      });
    }
    patch.forEach(function (_ref6) {
      var _ref7 = (0, _slicedToArray2["default"])(_ref6, 2),
        cookieName = _ref7[0],
        cookieValue = _ref7[1];
      setCookie(cookieName, cookieValue, {
        path: '/',
        maxAge: 1 * 365 * 24 * 60 * 60
      });
    });
  }, items);
};
exports.useCookieHandler = useCookieHandler;