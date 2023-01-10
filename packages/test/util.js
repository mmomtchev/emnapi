const { join } = require('path')
const common = require('./common.js')

const emnapi = require('../runtime')
const context = emnapi.createContext()

function getEntry (targetName) {
  return join(__dirname, `./.cgenbuild/${common.buildType}/${targetName}.${process.env.EMNAPI_TEST_NATIVE ? 'node' : 'js'}`)
}

exports.getEntry = getEntry

function loadPath (request, options) {
  try {
    const mod = require(request)

    if (typeof mod.default === 'function') {
      const p = new Promise((resolve, reject) => {
        mod.default().then(({ Module }) => {
          p.Module = Module
          try {
            resolve(Module.emnapiInit({
              context,
              ...(options || {})
            }))
          } catch (err) {
            reject(err)
          }
        })
      })
      return p
    } else {
      return Promise.resolve(mod)
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

exports.loadPath = loadPath

exports.load = function (targetName, options) {
  const request = getEntry(targetName)
  return loadPath(request, options)
}
