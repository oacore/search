"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.use = exports.from = exports["default"] = void 0;
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _classnames = _interopRequireDefault(require("classnames"));
var useModule = function useModule(className, module) {
  if (typeof className != 'string') return className;
  return className.split(' ').map(function (name) {
    return Object.prototype.hasOwnProperty.call(module, name) ? module[name] : name;
  }).join(' ');
};
var ClassNames = /*#__PURE__*/function () {
  function ClassNames() {
    (0, _classCallCheck2["default"])(this, ClassNames);
    (0, _defineProperty2["default"])(this, "classList", []);
    (0, _defineProperty2["default"])(this, "module", {});
  }
  (0, _createClass2["default"])(ClassNames, [{
    key: "use",
    value: function use() {
      var _this$classList;
      for (var _len = arguments.length, classList = new Array(_len), _key = 0; _key < _len; _key++) {
        classList[_key] = arguments[_key];
      }
      var classNames = classList.map(function (c) {
        if (c instanceof ClassNames) return c.toString();
        return c;
      });
      (_this$classList = this.classList).push.apply(_this$classList, (0, _toConsumableArray2["default"])(classNames));
      return this;
    }
  }, {
    key: "from",
    value: function from(module) {
      Object.assign(this.module, module);
      return this;
    }
  }, {
    key: "join",
    value: function join(className) {
      if (className instanceof ClassNames) this.appendix = className.toString();else this.appendix = className;
      return this;
    }
  }, {
    key: "toString",
    value: function toString() {
      return [useModule((0, _classnames["default"])(this.classList), this.module), this.appendix].filter(function (s) {
        return s;
      }).join(' ');
    }
  }]);
  return ClassNames;
}();
var use = function use() {
  var _ClassNames;
  return (_ClassNames = new ClassNames()).use.apply(_ClassNames, arguments);
};
exports.use = use;
var from = function from() {
  var _ClassNames2;
  return (_ClassNames2 = new ClassNames()).from.apply(_ClassNames2, arguments);
};
exports.from = from;
ClassNames.use = use;
ClassNames.from = from;
var _default = ClassNames;
exports["default"] = _default;