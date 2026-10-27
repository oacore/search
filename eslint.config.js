// ESLint 10 flat config (CS-LINT-1). The rules are the ones the former
// `@oacore/eslint-config-react` 1.0.6 (airbnb 18 and airbnb-base 14 with
// eslint-config-prettier 6) gave every file under ESLint 7, generated from
// docs/upgrade/findings/baselines/eslint-resolved-config.*.json:
// 245 enabled rules, written out with their resolved options.
// Left out: prettier/prettier (Prettier runs on its own). Pinned to the
// ESLint 7 behaviour where ESLint 10 changed a default or the parser changed
// the AST:
// no-unused-vars, no-useless-computed-key, no-shadow-restricted-names,
// no-inner-declarations, no-constant-condition, class-methods-use-this,
// no-irregular-whitespace.
// import/no-cycle loses `disableScc` (an eslint-plugin-import 2.x option
// that eslint-plugin-import-x does not have). eslint-plugin-import-x is
// registered under the key `import`, so the rule names and the inline
// `eslint-disable` comments stay as they are. It lints .js and .jsx files
// outside .gitignore, as `eslint --ignore-path .gitignore --ext .js,.jsx .`
// did. Never run with --fix (R-049).
const fs = require('fs')
const path = require('path')

const { defineConfig, globalIgnores } = require('eslint/config')
const globals = require('globals')
const tseslint = require('typescript-eslint')
const importPlugin = require('eslint-plugin-import-x')
const jsxA11y = require('eslint-plugin-jsx-a11y')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')

// .gitignore as ESLint 7's --ignore-path read it: a pattern with a slash
// before its end is anchored at the repository root, any other pattern
// matches at every depth; later lines win, `!` re-includes
const gitignore = fs
  .readFileSync(path.join(__dirname, '.gitignore'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const negated = line.startsWith('!')
    const pattern = negated ? line.slice(1) : line
    const anchored = pattern.replace(/\/$/, '').includes('/')
    const glob = anchored ? pattern.replace(/^\//, '') : `**/${pattern}`
    return negated ? `!${glob}` : glob
  })

// ESLint 10 removed rule-context methods that eslint-plugin-react 7.37.5
// still calls in one enabled rule (react/jsx-filename-extension:
// context.getFilename()); its rules get a context that has them again
const withContextMethods = (plugin) => ({
  ...plugin,
  rules: Object.fromEntries(
    Object.entries(plugin.rules).map(([name, rule]) => [
      name,
      {
        ...rule,
        create: (context) =>
          rule.create(
            Object.create(context, {
              getFilename: { value: () => context.filename },
              getPhysicalFilename: { value: () => context.physicalFilename },
              getSourceCode: { value: () => context.sourceCode },
            })
          ),
      },
    ])
  ),
})

const coreRules = {
  'curly': ['error', 'multi-or-nest'],
  'eqeqeq': ['error', 'smart'],
  'function-call-argument-newline': ['error', 'consistent'],
  'max-len': [
    'error',
    {
      code: 80,
      tabWidth: 2,
      ignoreComments: false,
      ignoreTrailingComments: false,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    },
  ],
  'no-console': [
    'error',
    {
      allow: ['warn', 'error'],
    },
  ],
  'no-param-reassign': [
    'error',
    {
      props: false,
    },
  ],
  'no-plusplus': [
    'error',
    {
      allowForLoopAfterthoughts: true,
    },
  ],
  'arrow-body-style': ['error', 'as-needed'],
  'strict': ['error', 'never'],
  'constructor-super': ['error'],
  'no-class-assign': ['error'],
  'no-const-assign': ['error'],
  'no-dupe-class-members': ['error'],
  'no-new-symbol': ['error'],
  'no-this-before-super': ['error'],
  'no-useless-computed-key': [
    'error',
    {
      enforceForClassMembers: false,
    },
  ],
  'no-useless-constructor': ['error'],
  'no-useless-rename': [
    'error',
    {
      ignoreDestructuring: false,
      ignoreImport: false,
      ignoreExport: false,
    },
  ],
  'no-var': ['error'],
  'object-shorthand': [
    'error',
    'always',
    {
      ignoreConstructors: false,
      avoidQuotes: true,
    },
  ],
  'prefer-const': [
    'error',
    {
      destructuring: 'any',
      ignoreReadBeforeAssign: true,
    },
  ],
  'prefer-destructuring': [
    'error',
    {
      VariableDeclarator: {
        array: false,
        object: true,
      },
      AssignmentExpression: {
        array: true,
        object: false,
      },
    },
    {
      enforceForRenamedProperties: false,
    },
  ],
  'prefer-numeric-literals': ['error'],
  'prefer-rest-params': ['error'],
  'prefer-spread': ['error'],
  'prefer-template': ['error'],
  'require-yield': ['error'],
  'symbol-description': ['error'],
  'no-delete-var': ['error'],
  'no-label-var': ['error'],
  'no-restricted-globals': [
    'error',
    {
      name: 'isFinite',
      message:
        'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
    },
    {
      name: 'isNaN',
      message:
        'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan',
    },
    'addEventListener',
    'blur',
    'close',
    'closed',
    'confirm',
    'defaultStatus',
    'defaultstatus',
    'event',
    'external',
    'find',
    'focus',
    'frameElement',
    'frames',
    'history',
    'innerHeight',
    'innerWidth',
    'length',
    'location',
    'locationbar',
    'menubar',
    'moveBy',
    'moveTo',
    'name',
    'onblur',
    'onerror',
    'onfocus',
    'onload',
    'onresize',
    'onunload',
    'open',
    'opener',
    'opera',
    'outerHeight',
    'outerWidth',
    'pageXOffset',
    'pageYOffset',
    'parent',
    'print',
    'removeEventListener',
    'resizeBy',
    'resizeTo',
    'screen',
    'screenLeft',
    'screenTop',
    'screenX',
    'screenY',
    'scroll',
    'scrollbars',
    'scrollBy',
    'scrollTo',
    'scrollX',
    'scrollY',
    'self',
    'status',
    'statusbar',
    'stop',
    'toolbar',
    'top',
  ],
  'no-shadow': ['error'],
  'no-shadow-restricted-names': [
    'error',
    {
      reportGlobalThis: false,
    },
  ],
  'no-undef': ['error'],
  'no-undef-init': ['error'],
  'no-unused-vars': [
    'error',
    {
      vars: 'all',
      args: 'after-used',
      ignoreRestSiblings: true,
      caughtErrors: 'none',
    },
  ],
  'no-use-before-define': [
    'error',
    {
      functions: true,
      classes: true,
      variables: true,
    },
  ],
  'camelcase': [
    'error',
    {
      properties: 'never',
      ignoreDestructuring: false,
      ignoreImports: false,
      ignoreGlobals: false,
    },
  ],
  'func-names': ['warn'],
  'lines-between-class-members': [
    'error',
    'always',
    {
      exceptAfterSingleLine: false,
    },
  ],
  'lines-around-directive': [
    'error',
    {
      before: 'always',
      after: 'always',
    },
  ],
  'new-cap': [
    'error',
    {
      newIsCap: true,
      newIsCapExceptions: [],
      capIsNew: false,
      capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
      properties: true,
    },
  ],
  'no-array-constructor': ['error'],
  'no-bitwise': ['error'],
  'no-continue': ['error'],
  'no-lonely-if': ['error'],
  'no-multi-assign': ['error'],
  'no-nested-ternary': ['error'],
  'no-new-object': ['error'],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ForInStatement',
      message:
        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
    },
    {
      selector: 'ForOfStatement',
      message:
        'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
    },
    {
      selector: 'LabeledStatement',
      message:
        'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
    },
    {
      selector: 'WithStatement',
      message:
        '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
    },
  ],
  'no-underscore-dangle': [
    'error',
    {
      allow: [],
      allowAfterThis: false,
      allowAfterSuper: false,
      enforceInMethodNames: true,
      allowAfterThisConstructor: false,
      allowFunctionParams: true,
    },
  ],
  'no-unneeded-ternary': [
    'error',
    {
      defaultAssignment: false,
    },
  ],
  'one-var': ['error', 'never'],
  'operator-assignment': ['error', 'always'],
  'prefer-object-spread': ['error'],
  'spaced-comment': [
    'error',
    'always',
    {
      line: {
        exceptions: ['-', '+'],
        markers: ['=', '!', '/'],
      },
      block: {
        exceptions: ['-', '+'],
        markers: ['=', '!', ':', '::'],
        balanced: true,
      },
    },
  ],
  'global-require': ['error'],
  'no-buffer-constructor': ['error'],
  'no-new-require': ['error'],
  'no-path-concat': ['error'],
  'for-direction': ['error'],
  'getter-return': [
    'error',
    {
      allowImplicit: true,
    },
  ],
  'no-async-promise-executor': ['error'],
  'no-await-in-loop': ['error'],
  'no-compare-neg-zero': ['error'],
  'no-cond-assign': ['error', 'always'],
  'no-constant-condition': [
    'warn',
    {
      checkLoops: 'all',
    },
  ],
  'no-control-regex': ['error'],
  'no-debugger': ['error'],
  'no-dupe-args': ['error'],
  'no-dupe-keys': ['error'],
  'no-duplicate-case': ['error'],
  'no-empty': ['error'],
  'no-empty-character-class': ['error'],
  'no-ex-assign': ['error'],
  'no-extra-boolean-cast': ['error'],
  'no-func-assign': ['error'],
  'no-inner-declarations': [
    'error',
    'functions',
    {
      blockScopedFunctions: 'disallow',
    },
  ],
  'no-invalid-regexp': ['error'],
  'no-irregular-whitespace': [
    'error',
    {
      skipJSXText: true,
    },
  ],
  'no-misleading-character-class': ['error'],
  'no-obj-calls': ['error'],
  'no-prototype-builtins': ['error'],
  'no-regex-spaces': ['error'],
  'no-sparse-arrays': ['error'],
  'no-template-curly-in-string': ['error'],
  'no-unreachable': ['error'],
  'no-unsafe-finally': ['error'],
  'no-unsafe-negation': ['error'],
  'use-isnan': ['error'],
  'valid-typeof': [
    'error',
    {
      requireStringLiterals: true,
    },
  ],
  'array-callback-return': [
    'error',
    {
      allowImplicit: true,
      checkForEach: false,
    },
  ],
  'block-scoped-var': ['error'],
  'class-methods-use-this': [
    'error',
    {
      exceptMethods: [],
      enforceForClassFields: false,
    },
  ],
  'consistent-return': ['error'],
  'default-case': [
    'error',
    {
      commentPattern: '^no default$',
    },
  ],
  'dot-notation': [
    'error',
    {
      allowKeywords: true,
      allowPattern: '',
    },
  ],
  'guard-for-in': ['error'],
  'max-classes-per-file': ['error', 1],
  'no-alert': ['warn'],
  'no-caller': ['error'],
  'no-case-declarations': ['error'],
  'no-else-return': [
    'error',
    {
      allowElseIf: false,
    },
  ],
  'no-empty-function': [
    'error',
    {
      allow: ['arrowFunctions', 'functions', 'methods'],
    },
  ],
  'no-empty-pattern': ['error'],
  'no-eval': ['error'],
  'no-extend-native': ['error'],
  'no-extra-bind': ['error'],
  'no-extra-label': ['error'],
  'no-fallthrough': ['error'],
  'no-global-assign': [
    'error',
    {
      exceptions: [],
    },
  ],
  'no-implied-eval': ['error'],
  'no-iterator': ['error'],
  'no-labels': [
    'error',
    {
      allowLoop: false,
      allowSwitch: false,
    },
  ],
  'no-lone-blocks': ['error'],
  'no-loop-func': ['error'],
  'no-multi-str': ['error'],
  'no-new': ['error'],
  'no-new-func': ['error'],
  'no-new-wrappers': ['error'],
  'no-octal': ['error'],
  'no-octal-escape': ['error'],
  'no-proto': ['error'],
  'no-redeclare': ['error'],
  'no-restricted-properties': [
    'error',
    {
      object: 'arguments',
      property: 'callee',
      message: 'arguments.callee is deprecated',
    },
    {
      object: 'global',
      property: 'isFinite',
      message: 'Please use Number.isFinite instead',
    },
    {
      object: 'self',
      property: 'isFinite',
      message: 'Please use Number.isFinite instead',
    },
    {
      object: 'window',
      property: 'isFinite',
      message: 'Please use Number.isFinite instead',
    },
    {
      object: 'global',
      property: 'isNaN',
      message: 'Please use Number.isNaN instead',
    },
    {
      object: 'self',
      property: 'isNaN',
      message: 'Please use Number.isNaN instead',
    },
    {
      object: 'window',
      property: 'isNaN',
      message: 'Please use Number.isNaN instead',
    },
    {
      property: '__defineGetter__',
      message: 'Please use Object.defineProperty instead.',
    },
    {
      property: '__defineSetter__',
      message: 'Please use Object.defineProperty instead.',
    },
    {
      object: 'Math',
      property: 'pow',
      message: 'Use the exponentiation operator (**) instead.',
    },
  ],
  'no-return-assign': ['error', 'always'],
  'no-return-await': ['error'],
  'no-script-url': ['error'],
  'no-self-assign': [
    'error',
    {
      props: true,
    },
  ],
  'no-self-compare': ['error'],
  'no-sequences': ['error'],
  'no-throw-literal': ['error'],
  'no-unused-expressions': [
    'error',
    {
      allowShortCircuit: false,
      allowTernary: false,
      allowTaggedTemplates: false,
      enforceForJSX: false,
    },
  ],
  'no-unused-labels': ['error'],
  'no-useless-catch': ['error'],
  'no-useless-concat': ['error'],
  'no-useless-escape': ['error'],
  'no-useless-return': ['error'],
  'no-void': ['error'],
  'no-with': ['error'],
  'prefer-promise-reject-errors': [
    'error',
    {
      allowEmptyReject: true,
    },
  ],
  'radix': ['error'],
  'vars-on-top': ['error'],
  'yoda': ['error'],
}

const importRules = {
  'import/order': [
    'error',
    {
      'groups': ['builtin', 'external', ['parent', 'sibling'], 'index'],
      'newlines-between': 'always',
      'distinctGroup': true,
      'named': false,
      'warnOnUnassignedImports': false,
    },
  ],
  'import/no-unresolved': [
    'error',
    {
      commonjs: true,
      caseSensitive: true,
      caseSensitiveStrict: false,
    },
  ],
  'import/named': ['error'],
  'import/export': ['error'],
  'import/no-named-as-default': ['error'],
  'import/no-named-as-default-member': ['error'],
  'import/no-extraneous-dependencies': [
    'error',
    {
      devDependencies: [
        'test/**',
        'tests/**',
        'spec/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        'test.{js,jsx}',
        'test-*.{js,jsx}',
        '**/*{.,_}{test,spec}.{js,jsx}',
        '**/jest.config.js',
        '**/jest.setup.js',
        '**/vue.config.js',
        '**/webpack.config.js',
        '**/webpack.config.*.js',
        '**/rollup.config.js',
        '**/rollup.config.*.js',
        '**/gulpfile.js',
        '**/gulpfile.*.js',
        '**/Gruntfile{,.js}',
        '**/protractor.conf.js',
        '**/protractor.conf.*.js',
        '**/karma.conf.js',
      ],
      optionalDependencies: false,
    },
  ],
  'import/no-mutable-exports': ['error'],
  'import/no-amd': ['error'],
  'import/first': ['error'],
  'import/no-duplicates': ['error'],
  'import/extensions': [
    'error',
    'ignorePackages',
    {
      js: 'never',
      mjs: 'never',
      jsx: 'never',
    },
  ],
  'import/newline-after-import': ['error'],
  'import/prefer-default-export': ['error'],
  'import/no-absolute-path': ['error'],
  'import/no-dynamic-require': ['error'],
  'import/no-webpack-loader-syntax': ['error'],
  'import/no-named-default': ['error'],
  'import/no-self-import': ['error'],
  'import/no-cycle': [
    'error',
    {
      maxDepth: '∞',
      ignoreExternal: false,
      allowUnsafeDynamicCyclicDependency: false,
    },
  ],
  'import/no-useless-path-segments': [
    'error',
    {
      commonjs: true,
    },
  ],
}

const reactRules = {
  'react/prop-types': [
    'error',
    {
      skipUndeclared: true,
      ignore: ['children', 'class', 'className', 'id', 'tag'],
    },
  ],
  'react/state-in-constructor': ['error', 'never'],
  'react/forbid-prop-types': [
    'error',
    {
      forbid: ['any', 'array', 'object'],
      checkContextTypes: true,
      checkChildContextTypes: true,
    },
  ],
  'react/jsx-boolean-value': [
    'error',
    'never',
    {
      always: [],
    },
  ],
  'react/jsx-no-bind': [
    'error',
    {
      ignoreRefs: true,
      allowArrowFunctions: true,
      allowFunctions: false,
      allowBind: false,
      ignoreDOMComponents: true,
    },
  ],
  'react/jsx-no-duplicate-props': [
    'error',
    {
      ignoreCase: true,
    },
  ],
  'react/jsx-no-undef': ['error'],
  'react/jsx-pascal-case': [
    'error',
    {
      allowAllCaps: true,
      ignore: [],
    },
  ],
  'react/jsx-uses-react': ['error'],
  'react/jsx-uses-vars': ['error'],
  'react/no-danger': ['warn'],
  'react/no-deprecated': ['error'],
  'react/no-did-update-set-state': ['error'],
  'react/no-will-update-set-state': ['error'],
  'react/no-is-mounted': ['error'],
  'react/no-string-refs': ['error'],
  'react/no-unknown-property': ['error'],
  'react/prefer-es6-class': ['error', 'always'],
  'react/prefer-stateless-function': [
    'error',
    {
      ignorePureComponents: true,
    },
  ],
  'react/react-in-jsx-scope': ['error'],
  'react/require-render-return': ['error'],
  'react/self-closing-comp': ['error'],
  'react/sort-comp': [
    'error',
    {
      order: [
        'static-variables',
        'static-methods',
        'instance-variables',
        'lifecycle',
        '/^handle.+$/',
        '/^on.+$/',
        'getters',
        'setters',
        '/^(get|set)(?!(InitialState$|DefaultProps$|ChildContext$)).+$/',
        'instance-methods',
        'everything-else',
        'rendering',
      ],
      groups: {
        lifecycle: [
          'displayName',
          'propTypes',
          'contextTypes',
          'childContextTypes',
          'mixins',
          'statics',
          'defaultProps',
          'constructor',
          'getDefaultProps',
          'getInitialState',
          'state',
          'getChildContext',
          'getDerivedStateFromProps',
          'componentWillMount',
          'UNSAFE_componentWillMount',
          'componentDidMount',
          'componentWillReceiveProps',
          'UNSAFE_componentWillReceiveProps',
          'shouldComponentUpdate',
          'componentWillUpdate',
          'UNSAFE_componentWillUpdate',
          'getSnapshotBeforeUpdate',
          'componentDidUpdate',
          'componentDidCatch',
          'componentWillUnmount',
        ],
        rendering: ['/^render.+$/', 'render'],
      },
    },
  ],
  'react/jsx-no-target-blank': [
    'error',
    {
      enforceDynamicLinks: 'always',
      links: true,
      forms: false,
    },
  ],
  'react/jsx-filename-extension': [
    'error',
    {
      extensions: ['.jsx'],
    },
  ],
  'react/jsx-no-comment-textnodes': ['error'],
  'react/no-render-return-value': ['error'],
  'react/no-find-dom-node': ['error'],
  'react/no-danger-with-children': ['error'],
  'react/no-unused-prop-types': [
    'error',
    {
      customValidators: [],
      skipShapeProps: true,
    },
  ],
  'react/style-prop-object': ['error'],
  'react/no-unescaped-entities': ['error'],
  'react/no-children-prop': ['error'],
  'react/no-array-index-key': ['error'],
  'react/require-default-props': [
    'error',
    {
      forbidDefaultForRequired: true,
    },
  ],
  'react/forbid-foreign-prop-types': [
    'warn',
    {
      allowInPropTypes: true,
    },
  ],
  'react/void-dom-elements-no-children': ['error'],
  'react/default-props-match-prop-types': [
    'error',
    {
      allowRequiredDefaults: false,
    },
  ],
  'react/no-redundant-should-component-update': ['error'],
  'react/no-unused-state': ['error'],
  'react/no-typos': ['error'],
  'react/jsx-curly-brace-presence': [
    'error',
    {
      props: 'never',
      children: 'never',
    },
  ],
  'react/destructuring-assignment': ['error', 'always'],
  'react/no-access-state-in-setstate': ['error'],
  'react/button-has-type': [
    'error',
    {
      button: true,
      submit: true,
      reset: false,
    },
  ],
  'react/no-this-in-sfc': ['error'],
  'react/jsx-fragments': ['error', 'syntax'],
  'react/static-property-placement': ['error', 'property assignment'],
}

const jsxA11yRules = {
  'jsx-a11y/anchor-has-content': [
    'error',
    {
      components: [],
    },
  ],
  'jsx-a11y/aria-role': [
    'error',
    {
      ignoreNonDOM: false,
    },
  ],
  'jsx-a11y/aria-props': ['error'],
  'jsx-a11y/aria-proptypes': ['error'],
  'jsx-a11y/aria-unsupported-elements': ['error'],
  'jsx-a11y/alt-text': [
    'error',
    {
      'elements': ['img', 'object', 'area', 'input[type="image"]'],
      'img': [],
      'object': [],
      'area': [],
      'input[type="image"]': [],
    },
  ],
  'jsx-a11y/img-redundant-alt': ['error'],
  'jsx-a11y/label-has-associated-control': [
    'error',
    {
      labelComponents: [],
      labelAttributes: [],
      controlComponents: [],
      assert: 'both',
      depth: 25,
    },
  ],
  'jsx-a11y/control-has-associated-label': [
    'error',
    {
      labelAttributes: ['label'],
      controlComponents: [],
      ignoreElements: [
        'audio',
        'canvas',
        'embed',
        'input',
        'textarea',
        'tr',
        'video',
      ],
      ignoreRoles: [
        'grid',
        'listbox',
        'menu',
        'menubar',
        'radiogroup',
        'row',
        'tablist',
        'toolbar',
        'tree',
        'treegrid',
      ],
      depth: 5,
    },
  ],
  'jsx-a11y/mouse-events-have-key-events': ['error'],
  'jsx-a11y/no-access-key': ['error'],
  'jsx-a11y/interactive-supports-focus': ['error'],
  'jsx-a11y/role-has-required-aria-props': ['error'],
  'jsx-a11y/role-supports-aria-props': ['error'],
  'jsx-a11y/tabindex-no-positive': ['error'],
  'jsx-a11y/heading-has-content': [
    'error',
    {
      components: [''],
    },
  ],
  'jsx-a11y/html-has-lang': ['error'],
  'jsx-a11y/lang': ['error'],
  'jsx-a11y/no-distracting-elements': [
    'error',
    {
      elements: ['marquee', 'blink'],
    },
  ],
  'jsx-a11y/scope': ['error'],
  'jsx-a11y/click-events-have-key-events': ['error'],
  'jsx-a11y/no-static-element-interactions': [
    'error',
    {
      handlers: [
        'onClick',
        'onMouseDown',
        'onMouseUp',
        'onKeyPress',
        'onKeyDown',
        'onKeyUp',
      ],
    },
  ],
  'jsx-a11y/no-noninteractive-element-interactions': [
    'error',
    {
      handlers: [
        'onClick',
        'onMouseDown',
        'onMouseUp',
        'onKeyPress',
        'onKeyDown',
        'onKeyUp',
      ],
    },
  ],
  'jsx-a11y/aria-activedescendant-has-tabindex': ['error'],
  'jsx-a11y/iframe-has-title': ['error'],
  'jsx-a11y/no-autofocus': [
    'error',
    {
      ignoreNonDOM: true,
    },
  ],
  'jsx-a11y/no-redundant-roles': ['error'],
  'jsx-a11y/media-has-caption': [
    'error',
    {
      audio: [],
      video: [],
      track: [],
    },
  ],
  'jsx-a11y/no-interactive-element-to-noninteractive-role': [
    'error',
    {
      tr: ['none', 'presentation'],
    },
  ],
  'jsx-a11y/no-noninteractive-element-to-interactive-role': [
    'error',
    {
      ul: [
        'listbox',
        'menu',
        'menubar',
        'radiogroup',
        'tablist',
        'tree',
        'treegrid',
      ],
      ol: [
        'listbox',
        'menu',
        'menubar',
        'radiogroup',
        'tablist',
        'tree',
        'treegrid',
      ],
      li: ['menuitem', 'option', 'row', 'tab', 'treeitem'],
      table: ['grid'],
      td: ['gridcell'],
    },
  ],
  'jsx-a11y/no-noninteractive-tabindex': [
    'error',
    {
      tags: [],
      roles: ['tabpanel'],
    },
  ],
  'jsx-a11y/anchor-is-valid': [
    'error',
    {
      components: ['Link'],
      specialLink: ['to'],
      aspects: ['noHref', 'invalidHref', 'preferButton'],
    },
  ],
}

module.exports = defineConfig([
  globalIgnores(
    [
      ...gitignore,
      // ESLint 7 skipped dotfiles and dot-directories by default
      '**/.*',
      // ESLint 7 linted only --ext .js,.jsx
      '**/*.mjs',
      '**/*.cjs',
      // data/** is ignored by .gitignore already; vendored third-party files
      // stay unlinted (CS-W0-12)
      'data/**',
      'vendor/**',
    ],
    'Not linted'
  ),
  {
    name: 'search/javascript',
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2018,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2015,
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    plugins: {
      'import': importPlugin,
      'jsx-a11y': withContextMethods(jsxA11y),
      'react': withContextMethods(react),
      'react-hooks': reactHooks,
    },
    settings: {
      'import-x/ignore': [
        'design/index.js$',
        '\\.(coffee|scss|css|less|hbs|svg|json)$',
      ],
      'import-x/resolver': {
        node: {
          paths: ['.'],
          extensions: ['.js', '.jsx', '.json'],
        },
      },
      'import-x/extensions': ['.js', '.mjs', '.jsx'],
      'import-x/core-modules': [],
      'react': {
        pragma: 'React',
        version: 'detect',
      },
      'propWrapperFunctions': ['forbidExtraProps', 'exact', 'Object.freeze'],
    },
    rules: {
      ...coreRules,
      ...importRules,
      ...reactRules,
      ...jsxA11yRules,
      // rules-of-hooks only (CS-LINT-2, Q-047): its five findings on the
      // existing code are bulk suppressions in eslint-suppressions.json and
      // the source stays as it is; exhaustive-deps and the React Compiler
      // rules stay off
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    // the override the former @oacore/eslint-config-base gave config files
    name: 'search/config-files',
    files: ['**/*.config.js'],
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
        },
      ],
    },
  },
  {
    // Test harness (40 §7 rule 7): Jest and Node globals, test-only
    // devDependency imports, and the patterns the harness relies on (require
    // inside jest.isolateModules, loops in table tests); production code is
    // unchanged
    name: 'search/test-harness',
    files: ['test/**/*.js', 'test/**/*.jsx', 'e2e/**/*.js', 'jest.config.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      'import/no-extraneous-dependencies': 'off',
      'global-require': 'off',
      'import/no-dynamic-require': 'off',
      'no-restricted-syntax': 'off',
      'no-plusplus': 'off',
      'no-bitwise': 'off',
      'max-len': [
        'error',
        {
          code: 80,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreUrls: true,
        },
      ],
    },
  },
])
