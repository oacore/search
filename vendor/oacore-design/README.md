# Design

Shared UI components used across our frontend projects. For more info see [docs][docs].

The project requires [__Node.js__][node-download] and [__NPM__][npm-install] package manager. 

**⚠ NOTE:** In order to download our @oacore packages from Github NPM registry you will need to generate github token with package
read permission [here][github-token].


## How to install and setup it?
The installation and setup process is pretty straightforward. 

First of all you need to install the package:
```sh
npm install @oacore/design
```

Then you need to import CSS files globally in your entry file:

Via JS:
```js
import '@oacore/design/lib/index.css'
``` 

Via CSS:
```css
@import url("~@oacore/design/lib/index.css");
``` 

Optionally:

If you want to use custom icons in your project you will need to create config file. The config file needs to
export schema specified [here][config-file]. The file has to be named `design`
and the extension needs to follow [cosmiconfig rules][cosmicconfig]. We recommend you to use `design.config.js`.
 
## Run development mode

To develop the library you need to run these commands:

```sh
npm install        # to install all dependencies
npm run build      # to complile files and run docs in dev mode
```

If you want to develop this library simultaneously with other project you can link them as follows:

```
path_to_design_folder:/# npm link
path_to_project_where_design_is_a_dependency:/# npm link @oacore/design
```

⚠ You may run into the issue with the multiple react libraries. Therefore the best solution is to use aliases in you 
build tool:

For webpack you should have something like:

webpack.config.js
```js
{
  ...
  'resolve': {
    'alias': {
      'react': path.join(__dirname, 'node_modules', 'react'),
      'react-dom': path.join(__dirname, 'node_modules', 'react-dom')
  }
  ...
}
```

## Design vendor update on other repositories

Run `npm update @oacore/design`

## Load specific version

On 'package.json' set:

- specific branch

```
"dependencies": {
   "@oacore/design": "github:oacore/design#BRANCH_NAME,
   }
```

- local version

```
"dependencies": {
   "@oacore/design": "file:../path/design",
   }
```

- latest version

```
"dependencies": {
    "@oacore/design": "latest",
   }
```

For CHANGELOG refer [here][changelog].


[github-token]: https://github.com/settings/tokens
[node-download]: https://nodejs.org/en/download/
[npm-install]: https://www.npmjs.com/get-npm
[cosmicconfig]: https://github.com/davidtheclark/cosmiconfig#cosmiconfig
[config-file]: https://github.com/oacore/design/blob/master/design.config.js#L2
[changelog]: https://github.com/oacore/design/releases
[docs]: https://design.oacore.vercel.app/
