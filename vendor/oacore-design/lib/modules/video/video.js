"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _react = _interopRequireDefault(require("react"));
var _modal = _interopRequireDefault(require("../modal"));
var _jsxRuntime = require("react/jsx-runtime");
var styles = {
  "modal": "styles-modal-2Iq3Y",
  "video": "styles-video-9IZsX"
};
var Video = function Video(_ref) {
  var video = _ref.video,
    visibleModal = _ref.visibleModal,
    closeModal = _ref.closeModal;
  return visibleModal && /*#__PURE__*/(0, _jsxRuntime.jsx)(_modal["default"], {
    onClose: closeModal,
    "aria-label": "Service video",
    className: styles.modal,
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)("iframe", {
      className: styles.video,
      src: video === null || video === void 0 ? void 0 : video.src,
      title: video === null || video === void 0 ? void 0 : video.title,
      allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
      allowFullScreen: true
    })
  });
};
var _default = Video;
exports["default"] = _default;