"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _react = require("react");
var useOutsideClick = function useOutsideClick(ref, closeElement) {
  function handleClickOutside(event) {
    if (ref.current && !ref.current.contains(event.target)) closeElement();
  }
  // eslint-disable-next-line consistent-return
  (0, _react.useEffect)(function () {
    if (typeof window !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
      return function () {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, []);
};
var _default = useOutsideClick;
exports["default"] = _default;