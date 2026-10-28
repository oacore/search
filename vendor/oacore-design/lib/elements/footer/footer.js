"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _react = _interopRequireDefault(require("react"));
var _ = require("..");
var _utils = require("../../utils");
var _link = require("../link");
var _jsxRuntime = require("react/jsx-runtime");
var _excluded = ["children", "href", "className", "tag"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var styles = {
  "footer": "footer-footer-7joNV",
  "container": "footer-container-1XrUr",
  "section-logos": "footer-section-logos-1_Ejr",
  "section-card": "footer-section-card-3esBH",
  "logos": "footer-logos-28CCb",
  "footer-main-logo": "footer-footer-main-logo-1jMdX",
  "logo-icon": "footer-logo-icon-f7Kwu",
  "logo-icon-ou": "footer-logo-icon-ou-1-Lr4",
  "menu": "footer-menu-2JIRS",
  "menu-title": "footer-menu-title-2NNki",
  "contact-wrapper": "footer-contact-wrapper-17ZHP",
  "contact": "footer-contact-2b5lt",
  "footer-icons": "footer-footer-icons-2NPaF",
  "footer-icon": "footer-footer-icon-2g_ak",
  "item": "footer-item-1F33t",
  "card": "footer-card-1yZdd",
  "card-title": "footer-card-title-3Uaog",
  "card-desc": "footer-card-desc-30YMW",
  "card-img": "footer-card-img-o-6kR",
  "bottom": "footer-bottom-3E5D_",
  "logo-link": "footer-logo-link-j8Agm",
  "bottom-link": "footer-bottom-link-PaLMR",
  "sectionLogos": "footer-section-logos-1_Ejr",
  "sectionCard": "footer-section-card-3esBH",
  "footerMainLogo": "footer-footer-main-logo-1jMdX",
  "logoIcon": "footer-logo-icon-f7Kwu",
  "logoIconOu": "footer-logo-icon-ou-1-Lr4",
  "menuTitle": "footer-menu-title-2NNki",
  "contactWrapper": "footer-contact-wrapper-17ZHP",
  "footerIcons": "footer-footer-icons-2NPaF",
  "footerIcon": "footer-footer-icon-2g_ak",
  "cardTitle": "footer-card-title-3Uaog",
  "cardDesc": "footer-card-desc-30YMW",
  "cardImg": "footer-card-img-o-6kR",
  "logoLink": "footer-logo-link-j8Agm",
  "bottomLink": "footer-bottom-link-PaLMR"
}; // eslint-disable-next-line import/no-cycle
var MenuListItem = function MenuListItem(_ref) {
  var children = _ref.children,
    href = _ref.href,
    _ref$className = _ref.className,
    className = _ref$className === void 0 ? '' : _ref$className,
    _ref$tag = _ref.tag,
    Tag = _ref$tag === void 0 ? 'li' : _ref$tag,
    restProps = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(Tag, _objectSpread(_objectSpread({}, restProps), {}, {
    className: _utils.classNames.use(styles.item).join(className),
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)("a", {
      href: href,
      children: children
    })
  }));
};
MenuListItem.displayName = "MenuListItem";
var MenuList = function MenuList(_ref2) {
  var title = _ref2.title,
    children = _ref2.children,
    _ref2$className = _ref2.className,
    className = _ref2$className === void 0 ? '' : _ref2$className;
  var items = _react["default"].Children.map(children, function (child) {
    var _child$props$tag;
    if (child.type !== MenuListItem) return null;
    return /*#__PURE__*/_react["default"].cloneElement(child, {
      key: child.props.href,
      tag: (_child$props$tag = child.props.tag) !== null && _child$props$tag !== void 0 ? _child$props$tag : 'li'
    });
  });
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("h6", {
      className: styles.menuTitle,
      children: title
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)("ul", {
      className: "".concat(styles.list, " ").concat(className),
      children: items
    })]
  });
};
MenuList.displayName = "MenuList";
var Card = function Card() {
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    className: styles.card,
    children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: styles.cardContent,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("h6", {
        className: styles.cardTitle,
        children: "Writing about CORE?"
      }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("p", {
        className: styles.cardDesc,
        children: ["Discover our", ' ', /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Link, {
          href: "/about/research-outputs",
          children: "research outputs"
        }), " and cite our work."]
      }), ' ']
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Icon, {
      src: "#writing",
      alt: "writing",
      className: styles.cardImg
    })]
  });
};
Card.displayName = "Card";
var Footer = function Footer(_ref3) {
  var className = _ref3.className;
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("footer", {
    className: _utils.classNames.use(styles.footer).join(className),
    id: "footer",
    children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: styles.container,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
        className: _utils.classNames.use(styles.sectionLogos),
        children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
          className: styles.logos,
          children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Link, {
            href: "https://core.ac.uk",
            children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Icon, {
              src: "#coreLogo",
              alt: "core logo",
              className: styles.footerMainLogo
            })
          })
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("p", {
          className: styles.text,
          children: ["CORE (COnnecting REpositories) is a not-for-profit service supported by", ' ', /*#__PURE__*/(0, _jsxRuntime.jsx)(_link.BaseLink, {
            href: "https://core.ac.uk/governance/supporters#membership-list",
            children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_.MathMarkdown, {
              children: "CORE Members."
            })
          })]
        })]
      }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("menu", {
        className: _utils.classNames.use(styles.menu),
        children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)(MenuList, {
          title: "Product",
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/services",
            children: "Services"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/membership",
            children: "Membership"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/sponsorship",
            children: "Sponsorship"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/innovations/labs",
            children: "Labs"
          })]
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)(MenuList, {
          title: "Organisation",
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/about",
            children: "About us"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/about#our-mission",
            children: "Governance"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/about#team",
            children: "Team"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/benefits",
            children: "Data providers"
          })]
        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)(MenuList, {
          title: "Support",
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/terms",
            children: "Terms"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/faq",
            children: "FAQs"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "https://blog.core.ac.uk/",
            children: "Blog"
          }), /*#__PURE__*/(0, _jsxRuntime.jsx)(MenuList.Item, {
            href: "/about#contact",
            children: "Contact us"
          })]
        })]
      }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
        className: _utils.classNames.use(styles.section, styles.sectionCard),
        children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(Card, {}), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
          className: styles.contactWrapper,
          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
            className: styles.contact,
            children: "Follow us:"
          }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
            className: styles.footerIcons,
            children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_link.BaseLink, {
              target: "_blank",
              href: "https://twitter.com/oacore",
              children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Icon, {
                src: "#twitter",
                alt: "twitter",
                className: styles.footerIcon
              })
            }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_link.BaseLink, {
              target: "_blank",
              href: "https://www.linkedin.com/company/coreoa",
              children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Icon, {
                src: "#linkedin",
                alt: "linkedin",
                className: styles.footerIcon
              })
            }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_link.BaseLink, {
              target: "_blank",
              href: "https://github.com/oacore",
              children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Icon, {
                src: "#github",
                alt: "github",
                className: styles.footerIcon
              })
            })]
          })]
        })]
      })]
    }), /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: styles.bottom,
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_.Link, {
        className: styles.bottomLink,
        href: "/accessibility",
        children: "Accessibility"
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Link, {
        className: styles.bottomLink,
        href: "/cookies",
        children: "Cookies"
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_.Link, {
        className: styles.bottomLink,
        href: "/privacy",
        children: "Privacy"
      })]
    })]
  });
};
Footer.displayName = "Footer";
MenuList.Item = MenuListItem;
var _default = Footer;
exports["default"] = _default;