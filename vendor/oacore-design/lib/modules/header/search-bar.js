"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useSearchBar = exports["default"] = void 0;
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
var _throttleDebounce = require("throttle-debounce");
var _context = require("./context");
var _utils = require("../../utils");
var _ = require("..");
var _elements = require("../../elements");
var _context2 = require("../../context");
var _hooks = require("../../hooks");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["selectClassName"],
  _excluded2 = ["appBarItemClassName"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "container": "styles-container-1KefU",
  "nav": "styles-nav-1DaTS",
  "expanded": "styles-expanded-3EGw2",
  "logo-container": "styles-logo-container-261sh",
  "logo-link": "styles-logo-link-3SQhe",
  "logo": "styles-logo-3C3lk",
  "toggle-container": "styles-toggle-container-3kw9N",
  "toggle-button": "styles-toggle-button-3MDvL",
  "menu": "styles-menu-2MrzW",
  "menu-title": "styles-menu-title-zh5md",
  "menu-list": "styles-menu-list-2qL0f",
  "group": "styles-group-3_h4T",
  "item": "styles-item-34TYT",
  "group-title": "styles-group-title-1v3Na",
  "group-list": "styles-group-list-37aX1",
  "item-link": "styles-item-link--QpIs",
  "research-item": "styles-research-item-374cP",
  "services-menu": "styles-services-menu-3Y6g_",
  "services-overview-item": "styles-services-overview-item-9AF_0",
  "item-text": "styles-item-text-2y8nE",
  "services-overview-item-label": "styles-services-overview-item-label-2qM2Y",
  "services-overview-item-description": "styles-services-overview-item-description-1SQ-o",
  "communities-menu": "styles-communities-menu-3a1Ao",
  "about-menu": "styles-about-menu-3ZQZB",
  "member-menu-item": "styles-member-menu-item-tvwnB",
  "search-bar-item": "styles-search-bar-item-dB35D",
  "search-bar-item-icon": "styles-search-bar-item-icon-28R_6",
  "search-bar-item-icon-button": "styles-search-bar-item-icon-button-fqoOL",
  "select": "styles-select-3ZCU1",
  "support-menu": "styles-support-menu-36qjb",
  "separator": "styles-separator-3Hkfn",
  "peace": "styles-peace-1CGQO",
  "item-wrapper": "styles-item-wrapper-3TY65",
  "indicator": "styles-indicator-3zUpD",
  "logoContainer": "styles-logo-container-261sh",
  "logoLink": "styles-logo-link-3SQhe",
  "toggleContainer": "styles-toggle-container-3kw9N",
  "toggleButton": "styles-toggle-button-3MDvL",
  "menuTitle": "styles-menu-title-zh5md",
  "menuList": "styles-menu-list-2qL0f",
  "groupTitle": "styles-group-title-1v3Na",
  "groupList": "styles-group-list-37aX1",
  "itemLink": "styles-item-link--QpIs",
  "researchItem": "styles-research-item-374cP",
  "servicesMenu": "styles-services-menu-3Y6g_",
  "servicesOverviewItem": "styles-services-overview-item-9AF_0",
  "itemText": "styles-item-text-2y8nE",
  "servicesOverviewItemLabel": "styles-services-overview-item-label-2qM2Y",
  "servicesOverviewItemDescription": "styles-services-overview-item-description-1SQ-o",
  "communitiesMenu": "styles-communities-menu-3a1Ao",
  "aboutMenu": "styles-about-menu-3ZQZB",
  "memberMenuItem": "styles-member-menu-item-tvwnB",
  "searchBarItem": "styles-search-bar-item-dB35D",
  "searchBarItemIcon": "styles-search-bar-item-icon-28R_6",
  "searchBarItemIconButton": "styles-search-bar-item-icon-button-fqoOL",
  "supportMenu": "styles-support-menu-36qjb",
  "itemWrapper": "styles-item-wrapper-3TY65"
}; // eslint-disable-next-line import/no-cycle
var useSearchBar = function useSearchBar(config) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    _ref$isHidden = _ref.isHidden,
    isHidden = _ref$isHidden === void 0 ? true : _ref$isHidden;
  var _useDesignContext = (0, _context2.useDesignContext)({
      skipUninitializedWarning: true
    }),
    _useDesignContext2 = (0, _slicedToArray2["default"])(_useDesignContext, 2),
    searchBar = _useDesignContext2[0].header.searchBar,
    dispatch = _useDesignContext2[1];

  // track whether search bar is configured or not
  // we cannot use simple Boolean(searchBar) because
  // when DISABLE_SEARCH_BAR action is called it take some time to propagate
  // back here, i.e. useEffect warning message may be shown incorrectly
  var isConfigured = (0, _react.useRef)(Boolean(searchBar));
  (0, _react.useEffect)(function () {
    var isConfig = Boolean(config);
    if (isConfig) {
      if (isConfigured.current && process.env.NODE_ENV === 'development') {
        console.warn('Search bar is already configured.' + " It's recommended to use `useSearchBar` once per page." + ' Otherwise it may lead to undesired behaviour');
      }
      dispatch({
        type: _context.HEADER_ACTIONS.CONFIGURE_SEARCH_BAR,
        payload: _objectSpread(_objectSpread({}, config), {}, {
          isHidden: isHidden
        })
      });
      isConfigured.current = true;
    }
    return function () {
      if (isConfig) {
        isConfigured.current = false;
        dispatch({
          type: _context.HEADER_ACTIONS.DISABLE_SEARCH_BAR
        });
      }
    };
  }, []);
  (0, _react.useEffect)(function () {
    var isConfig = Boolean(config);
    if (isConfig && isConfigured.current && (searchBar === null || searchBar === void 0 ? void 0 : searchBar.isHidden) !== isHidden) {
      dispatch({
        type: _context.HEADER_ACTIONS.CONFIGURE_SEARCH_BAR,
        payload: {
          isHidden: isHidden
        }
      });
    }
  }, [isHidden]);
  return searchBar;
};
exports.useSearchBar = useSearchBar;
var SearchBar = function SearchBar() {
  // At this moment we are sure search bar is enabled and configured
  var _useSearchBar = useSearchBar(),
    initQuery = _useSearchBar.initQuery,
    getSuggestions = _useSearchBar.getSuggestions,
    onQueryChanged = _useSearchBar.onQueryChanged,
    _useSearchBar$suggest = _useSearchBar.suggestionsDelay,
    suggestionsDelay = _useSearchBar$suggest === void 0 ? 500 : _useSearchBar$suggest,
    propsIsHidden = _useSearchBar.isHidden,
    useAdvancedSearch = _useSearchBar.useAdvancedSearch,
    changeOnBlur = _useSearchBar.changeOnBlur,
    _useSearchBar$searchB = _useSearchBar.searchBarProps,
    _useSearchBar$searchB2 = _useSearchBar$searchB === void 0 ? {} : _useSearchBar$searchB,
    selectClassName = _useSearchBar$searchB2.selectClassName,
    restSearchBarProps = (0, _objectWithoutProperties2["default"])(_useSearchBar$searchB2, _excluded),
    _useSearchBar$appBarI = _useSearchBar.appBarItemProps,
    _useSearchBar$appBarI2 = _useSearchBar$appBarI === void 0 ? {} : _useSearchBar$appBarI,
    appBarItemClassName = _useSearchBar$appBarI2.appBarItemClassName,
    restAppBarItemProps = (0, _objectWithoutProperties2["default"])(_useSearchBar$appBarI2, _excluded2);
  var _useWindowSize = (0, _hooks.useWindowSize)(),
    width = _useWindowSize.width;
  var _useState = (0, _react.useState)([]),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    suggestions = _useState2[0],
    setSuggestions = _useState2[1];
  var _useState3 = (0, _react.useState)(initQuery || ''),
    _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
    value = _useState4[0],
    setValue = _useState4[1];
  var _useState5 = (0, _react.useState)(propsIsHidden),
    _useState6 = (0, _slicedToArray2["default"])(_useState5, 2),
    isHiddenSearchBar = _useState6[0],
    setIsHiddenSearchBar = _useState6[1];
  var searchInputRef = (0, _react.useRef)();
  var suggest = (0, _react.useCallback)((0, _throttleDebounce.throttle)(suggestionsDelay, false, function (searchTerm) {
    if (getSuggestions) setSuggestions(getSuggestions(searchTerm));
  }), [getSuggestions, suggestionsDelay]);
  var handleOnChange = function handleOnChange(data) {
    onQueryChanged(data.value);
  };
  var onToggleVisibleSearchBar = function onToggleVisibleSearchBar() {
    setIsHiddenSearchBar(!isHiddenSearchBar);
  };
  var onCloseSearchBar = function onCloseSearchBar() {
    setIsHiddenSearchBar(true);
  };
  var handleOnInput = function handleOnInput(data) {
    setValue(data.value);
    // if id doesn't exist it means user type own text
    // and didn't use suggestion
    if (!data.id) suggest(data.value);
  };
  if (propsIsHidden) (0, _hooks.useOutsideClick)(searchInputRef, onCloseSearchBar);
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_jsxRuntime.Fragment, {
    children: [!isHiddenSearchBar && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.AppBar.Item, _objectSpread(_objectSpread({
      className: _utils.classNames.use(styles.searchBarItem, appBarItemClassName),
      ref: searchInputRef
    }, restAppBarItemProps), {}, {
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Select, _objectSpread(_objectSpread({
        id: "app-bar-search",
        value: value,
        variant: "pure",
        onChange: handleOnChange,
        onInput: handleOnInput,
        changeOnBlur: changeOnBlur || width < 500,
        className: _utils.classNames.use(styles.select, selectClassName),
        useAdvancedSearch: useAdvancedSearch,
        appendText: useAdvancedSearch && 'How to search?'
      }, restSearchBarProps), {}, {
        children: suggestions.map(function (el) {
          return /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Select.Option, {
            id: el.id,
            value: el.value,
            icon: el.icon,
            children: el.value
          }, el.id);
        })
      }))
    })), isHiddenSearchBar && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.AppBar.Item, {
      className: _utils.classNames.use(styles.searchBarItem, styles.searchBarItemIcon),
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Button, {
        className: styles.searchBarItemIconButton,
        onClick: onToggleVisibleSearchBar,
        children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Icon, {
          src: "#magnify",
          alt: "Search icon"
        })
      })
    })]
  });
};
var SearchBarOrEmpty = function SearchBarOrEmpty() {
  var searchBarConfig = useSearchBar();
  if (!searchBarConfig) return null;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(SearchBar, {});
};
SearchBarOrEmpty.displayName = "SearchBarOrEmpty";
var _default = SearchBarOrEmpty;
exports["default"] = _default;