"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireWildcard(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _elements = require("../../elements");
var _utils = require("../../utils");
var _link = require("../../elements/link");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["renderRedirectLink", "children", "id", "className", "searchId", "useLogo", "data"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "container": "styles-container-2Sli1",
  "container-recommended": "styles-container-recommended-2a9gS",
  "text-upper-header": "styles-text-upper-header-3Z0Zx",
  "header": "styles-header-13tcI",
  "title": "styles-title-1k6Ib",
  "thumbnail": "styles-thumbnail-1xurx",
  "thumbnail-caption": "styles-thumbnail-caption-2Qdvz",
  "thumbnail-caption-empty": "styles-thumbnail-caption-empty-VoVAO",
  "content": "styles-content-35LN7",
  "link": "styles-link-ezM5z",
  "footnote": "styles-footnote-2WLsl",
  "repository-link": "styles-repository-link-xUkbI",
  "full-text-hosted": "styles-full-text-hosted-Zi-vo",
  "full-text-linked": "styles-full-text-linked-1RAey",
  "full-text-missing": "styles-full-text-missing-itR-a",
  "metadata-list": "styles-metadata-list-34iT8",
  "data-provider": "styles-data-provider-DvgWY",
  "containerRecommended": "styles-container-recommended-2a9gS",
  "textUpperHeader": "styles-text-upper-header-3Z0Zx",
  "thumbnailCaption": "styles-thumbnail-caption-2Qdvz",
  "thumbnailCaptionEmpty": "styles-thumbnail-caption-empty-VoVAO",
  "repositoryLink": "styles-repository-link-xUkbI",
  "fullTextHosted": "styles-full-text-hosted-Zi-vo",
  "fullTextLinked": "styles-full-text-linked-1RAey",
  "fullTextMissing": "styles-full-text-missing-itR-a",
  "metadataList": "styles-metadata-list-34iT8",
  "dataProvider": "styles-data-provider-DvgWY"
};
var texts = {
  pdfAvailable: 'Get PDF',
  linkAvailable: 'Full text link',
  metadataOnly: 'No full text'
};
var PREFIX = 'work';
var labels = {
  author: 'Author',
  fieldOfStudy: 'Field of study',
  publicationDate: 'Publication date',
  publicationVenue: 'Publication venue',
  dataProviders: 'Data providers'
};
var formatDate = function formatDate(date) {
  return date === null || date === void 0 ? void 0 : date.toString();
};
var typeToVariant = function typeToVariant(fullTextLink) {
  var variant;
  if (fullTextLink == null) variant = 'missing';else if (fullTextLink.includes('core')) variant = 'hosted';else variant = 'linked';
  return variant;
};
var fullTextStatus = function fullTextStatus() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    title = _ref.title,
    fullTextLink = _ref.fullTextLink;
  // A trick to detect if any data exists.
  // Prevents fake 'Full text is missing' when still loading.
  if (title == null && fullTextLink == null) return null;
  var status;
  if (fullTextLink == null) status = texts.metadataOnly;else if (fullTextLink.includes('core')) status = texts.pdfAvailable;else status = texts.linkAvailable;
  return status;
};
var SearchResult = function SearchResult(_ref2) {
  var renderRedirectLink = _ref2.renderRedirectLink,
    children = _ref2.children,
    id = _ref2.id,
    className = _ref2.className,
    searchId = _ref2.searchId,
    _ref2$useLogo = _ref2.useLogo,
    useLogo = _ref2$useLogo === void 0 ? true : _ref2$useLogo,
    _ref2$data = _ref2.data,
    _ref2$data2 = _ref2$data === void 0 ? {} : _ref2$data,
    workId = _ref2$data2.workId,
    title = _ref2$data2.title,
    _ref2$data2$author = _ref2$data2.author,
    author = _ref2$data2$author === void 0 ? [] : _ref2$data2$author,
    publicationDate = _ref2$data2.publicationDate,
    publicationVenue = _ref2$data2.publicationVenue,
    fieldOfStudy = _ref2$data2.fieldOfStudy,
    metadataLink = _ref2$data2.metadataLink,
    fullTextLink = _ref2$data2.fullTextLink,
    thumbnailUrl = _ref2$data2.thumbnailUrl,
    _ref2$data2$dataProvi = _ref2$data2.dataProviders,
    dataProviders = _ref2$data2$dataProvi === void 0 ? [] : _ref2$data2$dataProvi,
    _ref2$data2$isRecomme = _ref2$data2.isRecommended,
    isRecommended = _ref2$data2$isRecomme === void 0 ? false : _ref2$data2$isRecomme,
    htmlProps = (0, _objectWithoutProperties2["default"])(_ref2, _excluded);
  var styleRecommended = isRecommended ? styles.containerRecommended : '';
  var textUpperHeader = /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    className: styles.textUpperHeader,
    children: "Recommended from our members"
  });
  var idFor = function idFor(scope) {
    return "".concat(id, "-").concat(scope);
  };
  var getLogoLink = function getLogoLink(dataProvider) {
    var _useState = (0, _react.useState)([]),
      _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
      logoFetched = _useState2[0],
      setLogoFetched = _useState2[1];
    (0, _react.useEffect)(function () {
      function fetchData() {
        return _fetchData.apply(this, arguments);
      }
      function _fetchData() {
        _fetchData = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee() {
          var link, response;
          return _regenerator["default"].wrap(function _callee$(_context) {
            while (1) switch (_context.prev = _context.next) {
              case 0:
                _context.prev = 0;
                link = "https://api.core.ac.uk/data-providers/".concat(dataProvider.id, "/logo");
                _context.next = 4;
                return fetch(link);
              case 4:
                response = _context.sent;
                if (response.ok) {
                  setLogoFetched( /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.DataProviderLogo, {
                    imageSrc: link,
                    size: "sm",
                    alt: dataProvider.name
                  }, dataProvider.name));
                }
                _context.next = 11;
                break;
              case 8:
                _context.prev = 8;
                _context.t0 = _context["catch"](0);
                // eslint-disable-next-line no-console
                console.log(_context.t0);
              case 11:
              case "end":
                return _context.stop();
            }
          }, _callee, null, [[0, 8]]);
        }));
        return _fetchData.apply(this, arguments);
      }
      fetchData();
    }, []);
    return logoFetched;
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_elements.Card, _objectSpread(_objectSpread({
    id: "".concat(PREFIX, "-").concat(id),
    className: _utils.classNames.use(styles.container, styles["full-text-".concat(typeToVariant(fullTextLink))], styleRecommended).join(className),
    itemScope: true,
    itemType: "https://schema.org/ScholarlyArticle"
  }, htmlProps), {}, {
    children: [isRecommended ? textUpperHeader : '', /*#__PURE__*/(0, _jsxRuntime.jsxs)("header", {
      className: styles.header,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.Heading, {
        level: "3",
        className: styles.title,
        itemProp: "name",
        children: metadataLink ? /*#__PURE__*/(0, _jsxRuntime.jsx)(_link.BaseLink, {
          href: metadataLink,
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.MathMarkdown, {
            children: title
          })
        }) : title
      }), useLogo && /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.LogoGroup, {
        children: dataProviders.map(function (dataProvider) {
          return getLogoLink(dataProvider);
        })
      })]
    }), /*#__PURE__*/(0, _jsxRuntime.jsxs)(_elements.MetadataList, {
      className: styles.metadataList,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.MetadataList.Item, {
        id: idFor('author'),
        label: labels.author,
        children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.ExpandableList, {
          "aria-label": labels.author,
          children: author.map(function (a, index) {
            return /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.ExpandableList.Item, {
              itemProp: "author",
              itemScope: true,
              itemType: "https://schema.org/Person",
              children: /*#__PURE__*/(0, _jsxRuntime.jsx)("a", {
                href: renderRedirectLink && searchId ? "/search?q=author:(".concat(a.name, ")&t=").concat(searchId, "-").concat(workId) : "/search?q=author:(".concat(a.name, ")"),
                className: styles.link,
                children: /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
                  itemProp: "name",
                  children: a.name.replace(',', ' ')
                })
              })
            }, "".concat(a.name, "-").concat(index));
          })
        })
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.MetadataList.Item, {
        id: idFor('venue'),
        label: labels.publicationVenue,
        children: publicationVenue
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.MetadataList.Item, {
        id: idFor('publication-date'),
        label: labels.publicationDate,
        itemProp: "datePublished",
        children: formatDate(publicationDate)
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.MetadataList.Item, {
        id: idFor('field'),
        label: labels.fieldOfStudy,
        itemProp: "about",
        children: fieldOfStudy
      })]
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("figure", {
      className: _utils.classNames.use(styles.thumbnail),
      children: /*#__PURE__*/(0, _jsxRuntime.jsxs)(_link.BaseLink, {
        href: fullTextLink,
        children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("img", {
          src: thumbnailUrl,
          itemProp: "image",
          alt: "",
          loading: "lazy"
        }), /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
          className: styles.thumbnailCaption,
          children: fullTextStatus({
            title: title,
            fullTextLink: fullTextLink
          })
        })]
      })
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: styles.content,
      itemProp: "abstract",
      children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_elements.MathMarkdown, {
        children: children
      })
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
      className: styles.footnote,
      children: dataProviders.map(function (dataProvider) {
        return dataProvider.name && /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
          itemProp: "publisher",
          itemScope: true,
          itemType: "https://schema.org/Organization",
          className: styles.dataProvider,
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_link.BaseLink, {
            href: renderRedirectLink && searchId ? "/data-providers/".concat(dataProvider.id, "?t=").concat(searchId, "-").concat(workId) : "/data-providers/".concat(dataProvider.id),
            className: styles.repositoryLink,
            children: /*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
              itemProp: "name",
              children: dataProvider.name
            })
          })
        }, dataProvider.id);
      })
    })]
  }));
};
SearchResult.displayName = "SearchResult";
SearchResult.propTypes = {
  id: _propTypes["default"].string.isRequired,
  searchId: _propTypes["default"].string,
  useLogo: _propTypes["default"].bool,
  renderRedirectLink: _propTypes["default"].bool,
  data: _propTypes["default"].shape({
    workId: _propTypes["default"].oneOfType([_propTypes["default"].string, _propTypes["default"].number]),
    title: _propTypes["default"].string,
    author: _propTypes["default"].arrayOf(_propTypes["default"].shape({
      name: _propTypes["default"].string
    })),
    publicationDate: _propTypes["default"].string,
    publicationVenue: _propTypes["default"].string,
    metadataLink: _propTypes["default"].string,
    fullTextLink: _propTypes["default"].string,
    thumbnailUrl: _propTypes["default"].string,
    dataProvider: _propTypes["default"].arrayOf(_propTypes["default"].shape({
      id: _propTypes["default"].number,
      name: _propTypes["default"].string,
      downloadUrl: _propTypes["default"].string
    }))
  })
};
var _default = SearchResult;
exports["default"] = _default;