"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _katex = _interopRequireDefault(require("katex"));
var _react = require("react");
var _jsxRuntime = require("react/jsx-runtime");
/* eslint-disable react/no-array-index-key */

var latexify = function latexify(string, options) {
  var regularExpression = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\]|\\\([\s\S]+?\\\)|\$[^$\\]*(?:\\.[^$\\]*)*\$/g;
  var blockRegularExpression = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\]/g;
  var stripDollars = function stripDollars(stringToStrip) {
    return stringToStrip[0] === '$' && stringToStrip[1] !== '$' ? stringToStrip.slice(1, -1) : stringToStrip.slice(2, -2);
  };
  var getDisplay = function getDisplay(stringToDisplay) {
    return stringToDisplay.match(blockRegularExpression) ? 'block' : 'inline';
  };
  var renderLatexString = function renderLatexString(s, t) {
    var renderedString;
    try {
      var opts = Object.create(options);
      if (t === 'block') opts.displayMode = true;
      renderedString = _katex["default"].renderToString(s, opts);
    } catch (err) {
      console.error('couldn`t convert string', s);
      return s;
    }
    return renderedString;
  };
  var result = [];
  var latexMatch = string.match(regularExpression);
  var stringWithoutLatex = string.split(regularExpression);
  if (latexMatch) {
    stringWithoutLatex.forEach(function (s, index) {
      result.push({
        string: s,
        type: 'text'
      });
      if (latexMatch[index]) {
        result.push({
          string: stripDollars(latexMatch[index]),
          type: getDisplay(latexMatch[index])
        });
      }
    });
  } else {
    result.push({
      string: string,
      type: 'text'
    });
  }
  var processResult = function processResult(resultToProcess) {
    return resultToProcess.map(function (r, rootIdx) {
      if (r.type === 'text') {
        if (options.breakLine) {
          var arr = r.string.split('\n\n');
          return /*#__PURE__*/(0, _jsxRuntime.jsx)(_react.Fragment, {
            children: arr.map(function (s, idx) {
              return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_react.Fragment, {
                children: [s, idx !== arr.length - 1 ? /*#__PURE__*/(0, _jsxRuntime.jsx)("br", {}) : null]
              }, "breakLine-".concat(r, "-").concat(idx));
            })
          }, "breakLine-".concat(rootIdx));
        }
        return /*#__PURE__*/(0, _jsxRuntime.jsx)(_react.Fragment, {
          children: r.string
        }, "noBreakLine-".concat(r, "-").concat(rootIdx));
      }
      return /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML: {
          __html: renderLatexString(r.string, r.type)
        }
      }, "formula-".concat(rootIdx));
    });
  };
  return processResult(result);
};
var _default = latexify;
exports["default"] = _default;