/* eslint-disable no-new-func */
/* eslint-disable @typescript-eslint/no-implied-eval */

declare const __EMNAPI_RUNTIME_REPLACE__: string
declare const __EMNAPI_RUNTIME_INIT__: string

mergeInto(LibraryManager.library, {
  $emnapiGetDynamicCalls: function () {
    return {
      call_vi (_ptr: number, a: int32_t): void {
        return makeDynCall('vi', '_ptr')(a)
      },
      call_ii (_ptr: number, a: int32_t): int32_t {
        return makeDynCall('ii', '_ptr')(a)
      },
      call_iii (_ptr: number, a: int32_t, b: int32_t): int32_t {
        return makeDynCall('iii', '_ptr')(a, b)
      },
      call_viii (_ptr: number, a: int32_t, b: int32_t, c: int32_t): void {
        return makeDynCall('viii', '_ptr')(a, b, c)
      }
    }
  },

  $emnapi: undefined,
  $emnapi__postset: __EMNAPI_RUNTIME_REPLACE__,

  $errorMessagesPtr: undefined,

  $emnapiInit__postset: 'emnapiInit();',
  $emnapiInit__deps: ['$emnapiGetDynamicCalls', '$emnapi', '$errorMessagesPtr'],
  $emnapiInit: function () {
    let registered = false
    let emnapiExports: any
    let exportsKey: string
    let env: emnapi.Env | undefined

    const dynCalls = emnapiGetDynamicCalls()

    let malloc: ((size: number) => number) | undefined
    let free: ((ptr: number) => void) | undefined

    let _napi_register_wasm_v1: (
      (env: napi_env, exports: napi_value) => napi_value) | undefined

    function callInStack<R, T extends () => R> (f: T): R {
      const stack = stackSave()
      let r: any
      try {
        r = f()
      } catch (err) {
        stackRestore(stack)
        throw err
      }
      stackRestore(stack)
      return r
    }

    function moduleRegister (): any {
      if (registered) return emnapiExports
      registered = true
      try {
        env = emnapi.Env.create(
          malloc!,
          free!,
          dynCalls.call_iii,
          dynCalls.call_viii,
          HEAP32,
          HEAPU32,
          HEAPU8
        )
        emnapiExports = env.callIntoModule((envObject, scope) => {
          const exports = {}
          const exportsHandle = scope.add(exports)
          const napiValue = _napi_register_wasm_v1!(envObject.id, exportsHandle.id)
          return (!napiValue) ? undefined : envObject.handleStore.get(napiValue)!.value
        })
        return emnapiExports
      } catch (err) {
        registered = false
        throw err
      }
    }

    addOnInit(function (Module) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      __EMNAPI_RUNTIME_INIT__

      _napi_register_wasm_v1 = Module._napi_register_wasm_v1
      delete Module._napi_register_wasm_v1
      const _emnapi_runtime_init = Module._emnapi_runtime_init
      delete Module._emnapi_runtime_init

      callInStack(() => {
        const malloc_pp = stackAlloc(4)
        const free_pp = stackAlloc(4)
        const key_pp = stackAlloc(4)
        const errormessages_pp = stackAlloc(4)
        _emnapi_runtime_init(malloc_pp, free_pp, key_pp, errormessages_pp)
        const malloc_p = HEAP32[malloc_pp >> 2]
        const free_p = HEAP32[free_pp >> 2]
        const key_p = HEAP32[key_pp >> 2]
        malloc = function (size: number) {
          return dynCalls.call_ii(malloc_p, size)
        }
        free = function (ptr: number) {
          return dynCalls.call_vi(free_p, ptr)
        }
        exportsKey = (key_p ? UTF8ToString(key_p) : 'emnapiExports') || 'emnapiExports'
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        errorMessagesPtr = HEAP32[errormessages_pp >> 2] || 0
      })

      // Module.emnapiModuleRegister = moduleRegister
      let exports: any
      try {
        exports = moduleRegister()
      } catch (err) {
        if (typeof Module.onEmnapiInitialized === 'function') {
          Module.onEmnapiInitialized(err || new Error(String(err)))
          return
        } else {
          throw err
        }
      }
      Module[exportsKey] = exports
      if (typeof Module.onEmnapiInitialized === 'function') {
        Module.onEmnapiInitialized(null, exports)
      }
    })
  }
})