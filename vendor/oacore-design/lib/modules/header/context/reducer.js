"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _actions = _interopRequireDefault(require("./actions"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var reducer = function reducer(state, _ref) {
  var _state$searchBar;
  var type = _ref.type,
    payload = _ref.payload;
  switch (type) {
    case _actions["default"].CONFIGURE_SEARCH_BAR:
      return _objectSpread(_objectSpread({}, state), {}, {
        searchBar: _objectSpread(_objectSpread({}, (_state$searchBar = state === null || state === void 0 ? void 0 : state.searchBar) !== null && _state$searchBar !== void 0 ? _state$searchBar : {}), payload)
      });
    case _actions["default"].DISABLE_SEARCH_BAR:
      return _objectSpread(_objectSpread({}, state), {}, {
        searchBar: null
      });
    default:
      return state;
  }
};
var _default = reducer;
exports["default"] = _default;