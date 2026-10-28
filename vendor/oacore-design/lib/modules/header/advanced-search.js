"use strict";

var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _react = _interopRequireWildcard(require("react"));
var _elements = require("../../elements");
var _jsxRuntime = require("react/jsx-runtime");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var styles = {
  "container": "advanced-search-container-2LG3_",
  "title": "advanced-search-title--5aN8",
  "subtitle": "advanced-search-subtitle-2l1hy",
  "variants": "advanced-search-variants-9dr2P",
  "variant": "advanced-search-variant-2QtUL",
  "buttons": "advanced-search-buttons-1_1xg",
  "button-container": "advanced-search-button-container-1Mqt0",
  "clear-out-button": "advanced-search-clear-out-button-3lAXT",
  "toggle-text": "advanced-search-toggle-text-1dSCS",
  "buttonContainer": "advanced-search-button-container-1Mqt0",
  "clearOutButton": "advanced-search-clear-out-button-3lAXT",
  "toggleText": "advanced-search-toggle-text-1dSCS"
};
var ACTION_BUTTONS_VALUES = ['doi', 'title', 'oai', 'issn'];
var AdvancedSearch = /*#__PURE__*/(0, _react.memo)(function (_ref) {
  var isVisible = _ref.isVisible,
    onClose = _ref.onClose,
    setSearchValue = _ref.setSearchValue,
    inputRef = _ref.inputRef;
  var handleActionButtonClick = function handleActionButtonClick(value) {
    var inputValue = "".concat(value, ":\" \"");
    setSearchValue({
      value: inputValue
    });
    inputRef.current.focus();
    onClose();
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    className: styles.wrapper,
    children: isVisible && /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: styles.container,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("p", {
        className: styles.title,
        children: ["You are able to search across all fields including title, abstract, authors and full text (to find out about all the fields that you can search, please refer to the", ' ', /*#__PURE__*/(0, _jsxRuntime.jsx)("a", {
          href: "https://api.core.ac.uk/docs/v3",
          children: "API documentation"
        }), ")."]
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Button, {
        className: styles.clearOutButton,
        type: "button",
        onClick: onClose,
        children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Icon, {
          src: "#window-close"
        })
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)("p", {
        className: styles.subtitle,
        children: "To refine your searches you can use:"
      }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("ul", {
        className: styles.variants,
        children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("li", {
          className: styles.variant,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
            children: "\" \""
          }), " - to specify exact matching"]
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("li", {
          className: styles.variant,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
            children: "AND, OR"
          }), " - to add logic to to your search"]
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("li", {
          className: styles.variant,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
            children: "( )"
          }), " - to group your search terms"]
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("li", {
          className: styles.variant,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
            children: "property_name:\"value\""
          }), " - a value for a specific property, e.g.", ' ', /*#__PURE__*/(0, _jsxRuntime.jsx)("i", {
            children: "title:\u201DConnecting Repositories\u201D, doi:\u201D10...\u201D"
          })]
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("li", {
          className: styles.variant,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("span", {
            children: ['>', '<=']
          }), ' ', "- to query on numeric fields, e.g. ", /*#__PURE__*/(0, _jsxRuntime.jsx)("i", {
            children: "year>2020"
          })]
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("li", {
          className: styles.variant,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
            children: "_exists_:\"field_name\""
          }), " - to get all the records that have a certain field e.g. _exists_:issn"]
        })]
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)("p", {
        className: styles.subtitle,
        children: "To get you started quickly follow this links to prefill your search box:"
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)("ul", {
        className: styles.buttons,
        children: ACTION_BUTTONS_VALUES.map(function (value) {
          return /*#__PURE__*/(0, _jsxRuntime.jsx)("li", {
            className: styles.buttonContainer,
            children: /*#__PURE__*/(0, _jsxRuntime.jsxs)(_elements.Button, {
              variant: "outlined",
              onClick: function onClick() {
                return handleActionButtonClick(value);
              },
              children: ["search by ", value]
            })
          }, value);
        })
      })]
    })
  });
});
var _default = AdvancedSearch;
exports["default"] = _default;