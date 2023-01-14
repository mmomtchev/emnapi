/* eslint-disable camelcase */
'use strict'
const assert = require('assert')
const { load } = require('../util')
const child_process = require('child_process')

if (process.argv[2] === 'child') {
  load('cleanup_hook')
} else {
  module.exports = new Promise((resolve) => {
    const { stdout } =
      child_process.spawnSync(process.execPath, [
        '--expose-gc', ...(process.env.MEMORY64 ? ['--experimental-wasm-memory64'] : []), __filename, 'child'])
    assert.strictEqual(stdout.toString().trim(), 'cleanup(42)')
    resolve()
  })
}