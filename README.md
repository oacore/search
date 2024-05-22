# CORE Search


## Installation & Preview

The project requires [__Node.js__][node-download] and
[__NPM__][npm-install] package manager.


After cloning this repository you will need to generate Github Token with package read permission [here][github-token] in order to download our @oacore packages from Github NPM registry.


```sh
export NPM_TOKEN=<github_token_with_packages_read_permission>
export API_KEY=<apikey_from_core>
npm install      # to install all dependencies
npm run dev      # to start simple development server
```

Open [localhost:3000](http://localhost:3000) to preview.

## Production deployment

For using on production you need to run these commands:

```sh
npm install        # to install all dependencies
npm run build      # to build all files for next server (stored in .next folder)
npm run start      # to start simple development server
```

Fix broken dependencies:
`npm install --legacy-peer-deps`

Server starts listen on `0.0.0.0:3000`

[github-token]: https://github.com/settings/tokens
[node-download]: https://nodejs.org/en/download/
[npm-install]: https://www.npmjs.com/get-npm
