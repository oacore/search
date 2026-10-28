"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "TableBody", {
  enumerable: true,
  get: function get() {
    return _body["default"];
  }
});
Object.defineProperty(exports, "TableCell", {
  enumerable: true,
  get: function get() {
    return _cell["default"];
  }
});
Object.defineProperty(exports, "TableFooter", {
  enumerable: true,
  get: function get() {
    return _footer["default"];
  }
});
Object.defineProperty(exports, "TableHead", {
  enumerable: true,
  get: function get() {
    return _head["default"];
  }
});
Object.defineProperty(exports, "TableHeadCell", {
  enumerable: true,
  get: function get() {
    return _headCell["default"];
  }
});
Object.defineProperty(exports, "TableRow", {
  enumerable: true,
  get: function get() {
    return _row["default"];
  }
});
exports["default"] = void 0;
var _table = _interopRequireDefault(require("./table"));
var _head = _interopRequireDefault(require("./head"));
var _headCell = _interopRequireDefault(require("./head-cell"));
var _body = _interopRequireDefault(require("./body"));
var _row = _interopRequireDefault(require("./row"));
var _cell = _interopRequireDefault(require("./cell"));
var _footer = _interopRequireDefault(require("./footer"));
_table["default"].Head = _head["default"];
_table["default"].HeadCell = _headCell["default"];
_table["default"].Body = _body["default"];
_table["default"].Row = _row["default"];
_table["default"].Cell = _cell["default"];
_table["default"].Footer = _footer["default"];
var _default = _table["default"];
exports["default"] = _default;