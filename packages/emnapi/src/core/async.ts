/* eslint-disable @typescript-eslint/restrict-plus-operands */
// declare const PThread: any

function __emnapi_worker_unref (pid: number): void {
  // if (ENVIRONMENT_IS_PTHREAD) return
  // const worker = napiModule.PThread.pthreads[pid]
  // if (typeof worker.unref === 'function') {
  //   worker.unref()
  // }
}

function emnapiAddSendListener (worker: any): boolean {
  if (!worker) return false
  if (worker._emnapiSendListener) return true
  const handler = function (e: any): void {
    const data = ENVIRONMENT_IS_NODE ? e : e.data
    const __emnapi__ = data.__emnapi__
    if (__emnapi__ && __emnapi__.type === 'async-send') {
      if (ENVIRONMENT_IS_PTHREAD) {
        const postMessage = napiModule.postMessage!
        postMessage({ __emnapi__ })
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const callback = __emnapi__.payload.callback
        $makeDynCall('vp', 'callback')(__emnapi__.payload.data)
      }
    }
  }
  const dispose = function (): void {
    if (ENVIRONMENT_IS_NODE) {
      worker.off('message', handler)
    } else {
      worker.removeEventListener('message', handler, false)
    }
    delete worker._emnapiSendListener
  }
  worker._emnapiSendListener = { handler, dispose }
  if (ENVIRONMENT_IS_NODE) {
    worker.on('message', handler)
  } else {
    worker.addEventListener('message', handler, false)
  }
  return true
}

function __emnapi_async_send_js (type: number, callback: number, data: number): void {
  if (ENVIRONMENT_IS_PTHREAD) {
    const postMessage = napiModule.postMessage!
    postMessage({
      __emnapi__: {
        type: 'async-send',
        payload: {
          callback,
          data
        }
      }
    })
  } else {
    switch (type) {
      case 0: __emnapi_set_immediate(callback, data); break
      case 1: __emnapi_next_tick(callback, data); break
      default: break
    }
  }
}

function ptrToString (ptr: number): string {
  return '0x' + ('00000000' + ptr.toString(16)).slice(-8)
}

let nextTid = 1
function spawnThread (startArg: number, threadId?: Int32Array): number {
  if (ENVIRONMENT_IS_PTHREAD) {
    const threadIdBuffer = new SharedArrayBuffer(4)
    const id = new Int32Array(threadIdBuffer)
    const postMessage = napiModule.postMessage!
    postMessage({
      __emnapi__: {
        type: 'thread-spawn',
        payload: {
          startArg,
          threadId: id
        }
      }
    })
    Atomics.wait(id, 0, 0)
    const tid = Atomics.load(id, 0)
    return tid
  }

  let worker: any
  try {
    if (typeof onCreateWorker !== 'function') {
      throw new TypeError('createNapiModule `options.onCreateWorker` is not provided')
    }
    worker = onCreateWorker()
  } catch (err) {
    const EAGAIN = 6
    const ret = -EAGAIN
    if (threadId) {
      Atomics.store(threadId, 0, ret)
      Atomics.notify(threadId, 0)
    }
    err(err.message)
    return ret
  }

  worker.onmessage = function (e: any) {
    if (e.data.__emnapi__) {
      const type = e.data.__emnapi__.type
      const payload = e.data.__emnapi__.payload
      if (type === 'loaded') {
        if (typeof worker.unref === 'function') {
          worker.unref()
        }
        if (payload.err) {
          err('failed to load in child thread: ' + (payload.err.message || payload.err))
        }
      } else if (type === 'thread-spawn') {
        spawnThread(payload.startArg, payload.threadId)
      }
    }
  }
  worker.onerror = (e: any) => {
    let message = 'worker sent an error!'
    if (worker.pthread_ptr) {
      message = 'Pthread ' + ptrToString(worker.pthread_ptr) + ' sent an error!'
    }
    err(message + ' ' + e.message)
    throw e
  }
  if (ENVIRONMENT_IS_NODE) {
    worker.on('message', function (data: any) {
      worker.onmessage({
        data
      })
    })
    worker.on('error', function (e: any) {
      worker.onerror(e)
    })
    worker.on('detachedExit', function () {})
  }
  // napiModule.emnapi.addSendListener(worker)
  emnapiAddSendListener(worker)
  const tid = nextTid
  nextTid++
  // napiModule.PThread.pthreads[tid] = worker
  // worker.pthread_ptr = tid
  const msg = {
    __emnapi__: {
      type: 'load',
      payload: {
        wasmModule,
        wasmMemory,
        tid,
        arg: startArg
      }
    }
  }
  if (threadId) {
    Atomics.store(threadId, 0, tid)
    Atomics.notify(threadId, 0)
  }
  worker.postMessage(msg)
  return tid
}
napiModule.spawnThread = spawnThread

function _pthread_atfork (): number {
  return 0
}

emnapiImplementInternal('pthread_atfork', 'ippp', _pthread_atfork)
emnapiImplementInternal('_emnapi_worker_unref', 'vp', __emnapi_worker_unref)
emnapiImplementInternal('_emnapi_async_send_js', 'vipp', __emnapi_async_send_js)
emnapiImplementHelper('$emnapiAddSendListener', undefined, emnapiAddSendListener, undefined, 'addSendListener')
