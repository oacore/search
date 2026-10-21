// T-417 implementation loader (P0-07). The design contract is one census run
// against an implementation of the 23 design components, `useCookie` and
// `classNames`. IMPL selects it: `design` = the installed @oacore/design
// package, loaded through the exact import paths the app uses
// (findings/04 §1a). The copy (W0.5, W5), each port (7.1) and each antd unit
// (7.2) add their own entry here and must give a census identical to the
// package reference recorded by `RECORD=1` (T-417 c3).
const IMPLS = {
  design: () => {
    const root = require('@oacore/design')
    const lib = require('@oacore/design/lib')
    const elements = require('@oacore/design/lib/elements')
    const modules = require('@oacore/design/lib/modules')
    const utils = require('@oacore/design/lib/utils')
    const classNamesModule = require('@oacore/design/lib/utils/class-names')
    const iconModule = require('@oacore/design/lib/elements/icon')
    const logoModule = require('@oacore/design/lib/elements/logo')
    return {
      name: 'design',
      // the compiled package: its CSS (60 §6 rows 5, 6, 11, 15), its own
      // icon config (row 16) and the files the server runs
      root: require('path').dirname(
        require.resolve('@oacore/design/package.json')
      ),
      // every import path of the app, for the identity checks of c1
      paths: {
        '@oacore/design': root,
        '@oacore/design/lib': lib,
        '@oacore/design/lib/elements': elements,
        '@oacore/design/lib/modules': modules,
        '@oacore/design/lib/utils': utils,
        '@oacore/design/lib/utils/class-names': classNamesModule,
        '@oacore/design/lib/elements/icon': iconModule,
        '@oacore/design/lib/elements/logo': logoModule,
      },
      // the 23 components (findings/04 §0) as the app imports them
      components: {
        Button: root.Button,
        Card: root.Card,
        Cookies: root.Cookies,
        CookiesProvider: root.CookiesProvider,
        DataProviderLogo: root.DataProviderLogo,
        DesignProvider: root.DesignProvider,
        ExpandableList: root.ExpandableList,
        Fieldset: root.Fieldset,
        Footer: root.Footer,
        Form: root.Form,
        Header: root.Header,
        Histoslider: elements.Histoslider,
        Icon: root.Icon,
        Link: root.Link,
        LoadingBar: root.LoadingBar,
        MathMarkdown: elements.MathMarkdown,
        MetadataList: root.MetadataList,
        Modal: root.Modal,
        Popover: modules.Popover,
        ProgressSpinner: elements.ProgressSpinner,
        SearchResult: root.SearchResult,
        Select: root.Select,
        TextField: root.TextField,
      },
      useCookie: root.useCookie,
      // both shapes (60 §6 row 13): the namespace of `/lib/utils` and the
      // default class of `/lib/utils/class-names`
      classNamesNamespace: utils.classNames,
      classNamesDefault: classNamesModule.default,
    }
  },
}

const IMPL_NAMES = Object.keys(IMPLS)

const implName = (env = process.env) => env.T417_IMPL || 'design'

const loadImpl = (name = implName()) => {
  if (!IMPLS[name]) {
    throw new Error(
      `T-417: unknown implementation "${name}" (known: ${IMPL_NAMES.join(
        ', '
      )})`
    )
  }
  return IMPLS[name]()
}

module.exports = { loadImpl, implName, IMPL_NAMES }
