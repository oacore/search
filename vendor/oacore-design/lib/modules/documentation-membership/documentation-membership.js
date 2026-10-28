"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _react = _interopRequireDefault(require("react"));
var _reactMarkdown = _interopRequireDefault(require("react-markdown"));
var _utils = require("../../utils");
var _icon = _interopRequireDefault(require("../../elements/icon"));
var _jsxRuntime = require("react/jsx-runtime");
var styles = {
  "documentation-wrapper": "styles-documentation-wrapper-2ddf2",
  "mullty-wrapper": "styles-mullty-wrapper-1TTKb",
  "documentation-inner-wrapper": "styles-documentation-inner-wrapper-2Nx_p",
  "divider": "styles-divider-yB8dF",
  "documentation-header": "styles-documentation-header-2Otqx",
  "sub-border": "styles-sub-border-3cEMh",
  "placement": "styles-placement-2qJqA",
  "placement-height": "styles-placement-height-1oqBl",
  "documentation-item": "styles-documentation-item-3I58t",
  "documentation-item-title": "styles-documentation-item-title-2seyZ",
  "documentation-text": "styles-documentation-text-3F6WO",
  "membership": "styles-membership-HC8ca",
  "image": "styles-image-dOD6M",
  "logo-banner": "styles-logo-banner-1X2yy",
  "logo-personalised": "styles-logo-personalised-HOb2e",
  "sub-title-wrapper": "styles-sub-title-wrapper-3-m26",
  "type-wrapper": "styles-type-wrapper-31cce",
  "link-wrapper": "styles-link-wrapper-39nB-",
  "link-text": "styles-link-text-3_DU7",
  "documentation-sub-title": "styles-documentation-sub-title-qcbUp",
  "enabled": "styles-enabled-3KXq6",
  "disabled": "styles-disabled-Z24-G",
  "highlighted": "styles-highlighted-2lPtb",
  "card-wrapper": "styles-card-wrapper-3anVj",
  "text-alignment": "styles-text-alignment-2dBbU",
  "img-wrapper": "styles-img-wrapper-1OoMt",
  "img-spread": "styles-img-spread-20zvA",
  "text": "styles-text-2KxF_",
  "badge-image": "styles-badge-image-1MUjM",
  "badge-image-height": "styles-badge-image-height-30IDN",
  "header-wrapper": "styles-header-wrapper-3_Z3M",
  "docs-title": "styles-docs-title-2WIeq",
  "video-wrapper": "styles-video-wrapper-131PK",
  "tutorial-wrapper": "styles-tutorial-wrapper-3RYh3",
  "navigator": "styles-navigator-3rd0R",
  "navigator-logo": "styles-navigator-logo-3riFc",
  "documentationWrapper": "styles-documentation-wrapper-2ddf2",
  "mulltyWrapper": "styles-mullty-wrapper-1TTKb",
  "documentationInnerWrapper": "styles-documentation-inner-wrapper-2Nx_p",
  "documentationHeader": "styles-documentation-header-2Otqx",
  "subBorder": "styles-sub-border-3cEMh",
  "placementHeight": "styles-placement-height-1oqBl",
  "documentationItem": "styles-documentation-item-3I58t",
  "documentationItemTitle": "styles-documentation-item-title-2seyZ",
  "documentationText": "styles-documentation-text-3F6WO",
  "logoBanner": "styles-logo-banner-1X2yy",
  "logoPersonalised": "styles-logo-personalised-HOb2e",
  "subTitleWrapper": "styles-sub-title-wrapper-3-m26",
  "typeWrapper": "styles-type-wrapper-31cce",
  "linkWrapper": "styles-link-wrapper-39nB-",
  "linkText": "styles-link-text-3_DU7",
  "documentationSubTitle": "styles-documentation-sub-title-qcbUp",
  "cardWrapper": "styles-card-wrapper-3anVj",
  "textAlignment": "styles-text-alignment-2dBbU",
  "imgWrapper": "styles-img-wrapper-1OoMt",
  "imgSpread": "styles-img-spread-20zvA",
  "badgeImage": "styles-badge-image-1MUjM",
  "badgeImageHeight": "styles-badge-image-height-30IDN",
  "headerWrapper": "styles-header-wrapper-3_Z3M",
  "docsTitle": "styles-docs-title-2WIeq",
  "videoWrapper": "styles-video-wrapper-131PK",
  "tutorialWrapper": "styles-tutorial-wrapper-3RYh3",
  "navigatorLogo": "styles-navigator-logo-3riFc"
};
var DocumentationMembership = function DocumentationMembership(_ref) {
  var headerTitle = _ref.headerTitle,
    headerCaption = _ref.headerCaption,
    highlight = _ref.highlight,
    nav = _ref.nav,
    docs = _ref.docs,
    imageSource = _ref.imageSource,
    docsTitle = _ref.docsTitle,
    mulltyDocs = _ref.mulltyDocs,
    handleContentOpen = _ref.handleContentOpen,
    videoIcon = _ref.videoIcon,
    tutorialIcon = _ref.tutorialIcon,
    tutorial = _ref.tutorial,
    redirectLink = _ref.redirectLink,
    showNavigator = _ref.showNavigator,
    handleScrollToTop = _ref.handleScrollToTop;
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    className: _utils.classNames.use(styles.documentationWrapper, (0, _defineProperty2["default"])({}, styles.mulltyWrapper, mulltyDocs)),
    children: [headerTitle && /*#__PURE__*/(0, _jsxRuntime.jsx)("h2", {
      className: styles.documentationHeader,
      children: headerTitle
    }), headerCaption, /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: _utils.classNames.use(styles.placement, (0, _defineProperty2["default"])({}, styles.placementHeight, imageSource)),
      children: [nav, /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
        className: _utils.classNames.use(styles.documentationInnerWrapper, (0, _defineProperty2["default"])({}, styles.innerSpacing, mulltyDocs)),
        children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
          className: styles.headerWrapper,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
            className: styles.docsTitle,
            children: docsTitle
          }), tutorial &&
          /*#__PURE__*/
          // eslint-disable-next-line max-len
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
          (0, _jsxRuntime.jsxs)("div", {
            className: styles.videoWrapper,
            rel: "noreferrer",
            onClick: function onClick() {
              return handleContentOpen({
                src: tutorial.src,
                title: tutorial.title
              });
            },
            children: [tutorial === null || tutorial === void 0 ? void 0 : tutorial.text, /*#__PURE__*/(0, _jsxRuntime.jsx)("img", {
              src: tutorialIcon,
              alt: "video icon"
            })]
          })]
        }), docs === null || docs === void 0 ? void 0 : docs.map(function (item, index) {
          var _item$tutorial, _item$redirect, _item$redirect2, _item$images;
          return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_jsxRuntime.Fragment, {
            children: [item.divider && /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
              className: styles.divider
            }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
              className: styles.documentationItem,
              id: item.id,
              children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("h3", {
                className: _utils.classNames.use(styles.documentationItemTitle, (0, _defineProperty2["default"])({}, styles.highlighted, highlight === index)),
                children: item.title
              }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
                className: styles.subTitleWrapper,
                children: [item.membershipTypes && /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
                  className: styles.typeWrapper,
                  children: [Object.entries(item === null || item === void 0 ? void 0 : item.membershipTypes).map(function (value) {
                    return /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
                      className: _utils.classNames.use(styles.membership).join(value[1] === 'Yes' ? styles.enabled : styles.disabled),
                      children: value[0]
                    }, item.id + value[0] + value[1]);
                  }), item.tutorial &&
                  /*#__PURE__*/
                  // eslint-disable-next-line max-len
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
                  (0, _jsxRuntime.jsxs)("div", {
                    onClick: function onClick() {
                      return handleContentOpen(item.tutorial);
                    },
                    className: styles.tutorialWrapper,
                    children: [(_item$tutorial = item.tutorial) === null || _item$tutorial === void 0 ? void 0 : _item$tutorial.text, /*#__PURE__*/(0, _jsxRuntime.jsx)("img", {
                      src: videoIcon,
                      alt: "tutorial icon"
                    })]
                  })]
                }), item.redirect && /*#__PURE__*/(0, _jsxRuntime.jsxs)("a", {
                  target: "_blank",
                  href: (_item$redirect = item.redirect) === null || _item$redirect === void 0 ? void 0 : _item$redirect.link,
                  className: styles.linkWrapper,
                  rel: "noreferrer",
                  children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
                    className: styles.linkText,
                    children: (_item$redirect2 = item.redirect) === null || _item$redirect2 === void 0 ? void 0 : _item$redirect2.text
                  }), /*#__PURE__*/(0, _jsxRuntime.jsx)("img", {
                    alt: "redirect",
                    src: redirectLink
                  })]
                })]
              }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactMarkdown["default"], {
                linkTarget: "_blank",
                className: styles.test,
                children: item.descriptionAbout
              }), /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
                children: item === null || item === void 0 || (_item$images = item.images) === null || _item$images === void 0 ? void 0 : _item$images.map(function (img, i) {
                  var _classNames$use5, _img$source, _classNames$use6;
                  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
                    className: styles.cardWrapper,
                    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
                      className: _utils.classNames.use((_classNames$use5 = {}, (0, _defineProperty2["default"])(_classNames$use5, styles.imgWrapper, img.source), (0, _defineProperty2["default"])(_classNames$use5, styles.imgSpread, imageSource), _classNames$use5)),
                      children: /*#__PURE__*/(0, _jsxRuntime.jsx)("img", {
                        className: _utils.classNames.use(styles.image, (_classNames$use6 = {}, (0, _defineProperty2["default"])(_classNames$use6, styles.logoBanner, item.id === 'logo-banner'), (0, _defineProperty2["default"])(_classNames$use6, styles.logoPersonalised, item.id === 'personalised-banner'), (0, _defineProperty2["default"])(_classNames$use6, styles.badgeImage, img.source), (0, _defineProperty2["default"])(_classNames$use6, styles.badgeImageHeight, (_img$source = img.source) === null || _img$source === void 0 ? void 0 : _img$source.includes('square')), _classNames$use6)),
                        src: img.file,
                        alt: "image"
                        // eslint-disable-next-line react/no-array-index-key
                      }, item.id + i)
                    }), img.source && /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
                      className: styles.textAlignment,
                      children: /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
                        className: styles.text,
                        children: img.source
                      })
                    })]
                  });
                })
              }), (item === null || item === void 0 ? void 0 : item.subTitle) && /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactMarkdown["default"], {
                className: styles.documentationSubTitle,
                children: item === null || item === void 0 ? void 0 : item.subTitle
              }), (item === null || item === void 0 ? void 0 : item.subDescription) && /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactMarkdown["default"], {
                className: _utils.classNames.use(styles.documentationSubDescription, (0, _defineProperty2["default"])({}, styles.subBorder, item.border)),
                children: item === null || item === void 0 ? void 0 : item.subDescription
              })]
            }, item.id)]
          });
        })]
      }), showNavigator &&
      /*#__PURE__*/
      // eslint-disable-next-line max-len
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
      (0, _jsxRuntime.jsx)("div", {
        className: styles.navigator,
        onClick: handleScrollToTop,
        children: /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
          className: styles.navigatorLogo,
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_icon["default"], {
            src: "#active-arrow"
          })
        })
      })]
    })]
  });
};
DocumentationMembership.displayName = "DocumentationMembership";
var _default = DocumentationMembership;
exports["default"] = _default;