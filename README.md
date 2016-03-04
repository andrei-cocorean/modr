modr -- extend require() calls
==============================

## Install

    npm install --save modr

## Register

Before you add any plugins you need to register modr. This step replaces Node's module loader so that modr can intercept calls to require().

```javascript
require('modr').register()
// or
require('modr/register')
```

## Add your own plugins

For example you can require modules promisified with [bluebird](http://bluebirdjs.com/).

```javascript
const bluebird = require('bluebird')
const modr = require('modr')
modr.use(requirePromisified)

/**
 * @param  {string}   request The string passed to require()
 * @param  {Function} next    The next plugin in the chain. The chain ends with the original require function.
 *                            You can short-circuit the chain by not calling next()
 * @return {*}                Module exports that will be returned to the client
 */
function requirePromisified (request, next) {
  const promisifiedRe = /!promisify$/
  const isPromisified = promisifiedRe.test(request)
  if (!isPromisified) return next(request)

  const moduleName = request.replace(promisifiedRe, '')
  return bluebird.promisifyAll(next(moduleName))
}

const fs = require('fs!promisify')
fs.readFileAsync('README.md')
  .then(content => { /**/ })
  .catch(err => { /**/ })
```

You can also use conditional plugins:

```javascript
function requireOptional (request, next) {
  try {
    return next(request)
  } catch (err) {
    return null
  }
}

// call the plugin only if the predicate returns true
modr.use(request => request === 'express', requireOptional)

// express will be null if the module is not found
const express = require('express')

// require will throw an error if babel is not found
const babel = require('babel')
```

## Remove plugins

```javascript
const modr = require('modr')
const removePlugin = modr.use(requirePromisified)

/* ... */

// remove requirePromisified
removePlugin()

// remove all plugins
modr.removeAll()

// completely deregister modr
modr.deregister()

```

## Caveats

Node's module loader is synchronous so plugins should be synchronous as well.
