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
 * Tell modr to use the plugin when it loads future modules.
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
 * @param  {function} plugin
 */
export function use (plugin) {
  pluginStack.push(plugin)
  return function removePlugin () {
    const pluginIdx = pluginStack.indexOf(plugin)
    if (pluginIdx >= 0) {
      pluginStack.splice(pluginIdx, 1)
    }
  }
}

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

    // call the next plugin or the original require
    if (pluginIdx >= 0) {
      const plugin = pluginStack[pluginIdx]
      return plugin.call(this, request, next)
    }
    return nodeRequire.call(this, request)
  }
  return next(request)
}
