/* eslint-env mocha */
import chai, {expect} from 'chai'
import {spy, stub} from 'sinon'
import sinonChai from 'sinon-chai'
import Module from 'module'
import * as modr from './modr'

chai.use(sinonChai)

describe('modr', function () {
  beforeEach(function () {
    // stub the original require
    this._originalRequire = Module.prototype.require
    this.fsModule = {isModule: true}
    this.nodeRequire = stub().returns(this.fsModule)
    Module.prototype.require = this.nodeRequire

    modr.register()
  })

  afterEach(function () {
    Module.prototype.require = this._originalRequire
    modr.removeAll()
    modr.deregister()
  })

  it('should register idempotently', function () {
    // register multiple times, but the result should be the same
    modr.register()
    modr.register()

    const fs = require('fs')
    expect(fs, 'file system module').to.equal(this.fsModule)
    expect(this.nodeRequire, 'original require').to.be.calledOnce

    modr.deregister()
    expect(Module.prototype.require).to.equal(this.nodeRequire)
  })

  it('should deregister idempotently', function () {
    modr.register()

    // deregister multiple times, but the result should be the same
    modr.deregister()
    modr.deregister()

    expect(Module.prototype.require).to.equal(this.nodeRequire)
  })

  it('should use plugins', function () {
    function sealModule (request, next) {
      return Object.seal(next(request))
    }
    const plugin = spy(sealModule)
    modr.use(plugin)

    const fs = require('fs')
    expect(fs, 'file system module').to.equal(this.fsModule)
    expect(Object.isSealed(fs), 'module is sealed').to.be.true
    expect(plugin, 'seal object plugin').to.be.calledOn(module)
    expect(this.nodeRequire, 'original require')
      .to.be.calledWith('fs')
      .and.to.be.calledOn(module)
  })

  it('should call plugins in reverse insert order', function () {
    function passThrough (request, next) {
      return next(request)
    }
    const firstPlugin = spy(passThrough)
    const secondPlugin = spy(passThrough)
    modr.use(firstPlugin)
    modr.use(secondPlugin)

    require('fs')
    expect(secondPlugin).to.be.calledBefore(firstPlugin)
    expect(firstPlugin).to.be.calledBefore(this.nodeRequire)
  })

  it('should remove a plugin', function () {
    function hijack (request, next) {
      return {someOtherModule: true}
    }
    const plugin = spy(hijack)
    const removePlugin = modr.use(plugin)
    removePlugin()

    require('fs')
    expect(plugin).to.not.be.called
  })

  it('should remove all plugins', function () {
    function hijack (request, next) {
      return {someOtherModule: true}
    }
    const firstPlugin = spy(hijack)
    const secondPlugin = spy(hijack)
    modr.use(firstPlugin)
    modr.use(secondPlugin)
    modr.removeAll()

    require('fs')
    expect(secondPlugin).to.not.be.called
    expect(firstPlugin).to.not.be.called
  })
})
