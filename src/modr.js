import Module from 'module'

let nodeRequire = null
let pluginStack = []
let isRegistered = false

/**
 * Register modr globally so that it intercepts calls to require.
 * This function is idempotent.
 */
export function register () {
  if (isRegistered) return

  isRegistered = true
  nodeRequire = Module.prototype.require
  Module.prototype.require = modrequire
}

/**
 * Deregister modr and restore the original require function.
 * This function is idempotent.
 */
export function deregister () {
  if (!isRegistered) return

  isRegistered = false
  Module.prototype.require = nodeRequire
  nodeRequire = null
}

/**
 * Tell modr to use the plugin when it loads future modules that match the predicate.
 *
 * Each plugin is a function that accepts 2 parameters: request, next
 *   - request is the parameter passed to the require() call (for the first
 *     plugin) or to the next() call for subsequent plugins.
 *   - next is a function taking 1 parameter, request and represents the next
 *     plugin in the chain. Any plugin can short-circuite the chain by not
 *     calling next().
 *
 * Because Node's require is synchronous, plugins should be synchronous
 * as well.
 *
 * The plugin stack is LIFO, so the following configuration will first execute
 * requirePromisify followed by logRequire followed by Node's require.
 *
 * function logRequire (request, next) {
 *   console.log('required module: ', request)
 *   return next(request)
 * }
 *
 * function requirePromisify (request, next) {
 *   return bluebird.promisifyAll(next(request))
 * }
 *
 * modr.use(logRequire)
 * modr.use(requirePromisify)
 *
 * The predicate is a function (request) -> bool. If it returns true the request is passed
 * through the plugin. The default predicate always returns true.
 *
 * e.g. the following will promisify only the 'fs' module:
 * modr.use(request => request === 'fs', requirePromisify)
 *
 * Both the predicate and plugin receive to the parent module as the context.
 * i.e. the module that called require().
 *
 * @param  {function} predicate
 * @param  {function} plugin
 * @return {function} a function that removes the plugin from the stack
 */
export function use (...pair) {
  // if the predicate is missing add the default one
  if (pair.length < 2) {
    pair.unshift(alwaysTrue)
  }
  pluginStack.push(pair)

  return function removePlugin () {
    const pluginIdx = pluginStack.indexOf(pair)
    if (pluginIdx >= 0) {
      pluginStack.splice(pluginIdx, 1)
    }
  }
}

function alwaysTrue () { return true }

/**
 * Removes all custom plugins from modr. This function is idempotent.
 */
export function removeAll () {
  pluginStack = []
}

function modrequire (request) {
  let pluginIdx = pluginStack.length
  const next = request => {
    pluginIdx--

    // call the original require at the bottom of the stack
    if (pluginIdx < 0) return nodeRequire.call(this, request)

    // call the plugin if the predicate matches
    const [predicate, plugin] = pluginStack[pluginIdx]
    if (predicate.call(this, request)) return plugin.call(this, request, next)

    return next(request)
  }
  return next(request)
}
