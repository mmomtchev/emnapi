/* eslint-disable @typescript-eslint/indent */
/* eslint-disable no-unreachable */

// declare const PThread: any
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// declare function __emnapi_async_send_js (callback: number, data: number): void
declare function __emnapi_set_immediate (callback: number, data: number): void
declare function __emnapi_next_tick (callback: number, data: number): void

mergeInto(LibraryManager.library, {
  _emnapi_set_immediate__sig: 'vpp',
  _emnapi_set_immediate__deps: ['$emnapiInit', '$emnapiCtx'],
  _emnapi_set_immediate: function (callback: number, data: number): void {
    emnapiCtx.feature.setImmediate(() => {
      $makeDynCall('vp', 'callback')(data)
    })
  },

  _emnapi_next_tick__sig: 'vpp',
  _emnapi_next_tick: function (callback: number, data: number): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.resolve().then(() => {
      $makeDynCall('vp', 'callback')(data)
    })
  },

  $emnapiAddSendListener: function (worker: any) {
    if (worker && !worker._emnapiSendListener) {
      worker._emnapiSendListener = function _emnapiSendListener (e: any) {
        const data = ENVIRONMENT_IS_NODE ? e : e.data
        if (data.emnapiAsyncSend) {
          if (ENVIRONMENT_IS_PTHREAD) {
            postMessage({
              emnapiAsyncSend: data.emnapiAsyncSend
            })
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const callback = data.emnapiAsyncSend.callback
            $makeDynCall('vp', 'callback')(data.emnapiAsyncSend.data)
          }
        }
      }
      if (ENVIRONMENT_IS_NODE) {
        worker.on('message', worker._emnapiSendListener)
      } else {
        worker.addEventListener('message', worker._emnapiSendListener, false)
      }
    }
  },

  _emnapi_async_send_js__sig: 'vipp',
  _emnapi_async_send_js__deps: [
    '$PThread',
    '$emnapiAddSendListener',
    '_emnapi_set_immediate',
    '_emnapi_next_tick'
  ],
  _emnapi_async_send_js: function (type: number, callback: number, data: number): void {
    if (ENVIRONMENT_IS_PTHREAD) {
      postMessage({
        emnapiAsyncSend: {
          callback,
          data
        }
      })
    } else {
      switch (type) {
        case 0: __emnapi_set_immediate(callback, data); break
        case 1: __emnapi_next_tick(callback, data); break
        default: break
      }
    }
  },
  // if EMNAPI_USE_PROXYING=1 (default is 1 if emscripten version >= 3.1.9),
  // _emnapi_async_send_js and $emnapiAddSendListener won't be linked into runtime code
  _emnapi_async_send_js__postset:
    'PThread.unusedWorkers.forEach(emnapiAddSendListener);' +
    'PThread.runningWorkers.forEach(emnapiAddSendListener);' +
    'var __original_getNewWorker = PThread.getNewWorker; PThread.getNewWorker = function () {' +
      'var r = __original_getNewWorker.apply(this, arguments);' +
      'emnapiAddSendListener(r);' +
      'return r;' +
    '};'
})

function _emnapi_call_into_module (env: napi_env, callback: number, data: number): void {
  const envObject = emnapiCtx.envStore.get(env)!
  const scope = emnapiCtx.openScope(envObject)
  try {
    envObject.callIntoModule(() => {
      $makeDynCall('vpp', 'callback')(env, data)
    })
  } finally {
    emnapiCtx.closeScope(envObject, scope)
  }
}

emnapiImplement('_emnapi_call_into_module', 'vppp', _emnapi_call_into_module)
