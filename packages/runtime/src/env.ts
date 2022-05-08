import { DeferredStore } from './Deferred'
import { HandleStore } from './Handle'
import { ScopeStore, IHandleScope, HandleScope, EscapableHandleScope } from './HandleScope'
import { LinkedList } from './LinkedList'
import { RefStore } from './Reference'
import { IStoreValue, Store } from './Store'
import { napi_status } from './type'
import { TypedArray, supportFinalizer, NULL, TryCatch, envStore, isReferenceType } from './util'

export interface ILastError {
  errorMessage: const_char_p
  engineReserved: void_p
  engineErrorCode: uint32_t
  errorCode: napi_status
  readonly data: Pointer<napi_extended_error_info>
}

export class Env implements IStoreValue {
  public id: number

  typedArrayMemoryMap = new WeakMap<TypedArray | DataView, void_p>()
  arrayBufferMemoryMap = new WeakMap<ArrayBuffer, void_p>()
  memoryPointerDeleter: FinalizationRegistry<void_p> = supportFinalizer
    ? new FinalizationRegistry<void_p>((heldValue) => {
      this.free(heldValue)
    })
    : null!

  public openHandleScopes: number = 0

  public instanceData = {
    data: 0,
    finalize_cb: 0,
    finalize_hint: 0
  }

  public handleStore!: HandleStore
  public scopeStore!: ScopeStore
  public refStore!: RefStore
  public deferredStore!: DeferredStore

  private scopeList = new LinkedList<IHandleScope>()

  private napiExtendedErrorInfoPtr: Pointer<napi_extended_error_info> = NULL

  public lastError: ILastError

  public tryCatch = new TryCatch()

  public static create (
    malloc: (size: number) => number,
    free: (ptr: number) => void,
    call_iii: (ptr: number, ...args: [number, number]) => number,
    call_viii: (ptr: number, ...args: [number, number, number]) => void,
    HEAP32: Int32Array,
    HEAPU32: Uint32Array,
    HEAPU8: Uint8Array
  ): Env {
    const env = new Env(malloc, free, call_iii, call_viii, HEAP32, HEAPU32, HEAPU8)
    envStore.add(env)
    env.refStore = new RefStore()
    env.handleStore = new HandleStore()
    env.handleStore.addGlobalConstants(env.id)
    env.deferredStore = new DeferredStore()
    env.scopeStore = new ScopeStore()
    env.scopeList = new LinkedList<IHandleScope>()
    // env.scopeList.push(HandleScope.create(env.id, null))
    env.napiExtendedErrorInfoPtr = env.malloc(16)
    return env
  }

  private constructor (
    public malloc: (size: number) => number,
    public free: (ptr: number) => void,
    public call_iii: (ptr: number, ...args: [number, number]) => number,
    public call_viii: (ptr: number, ...args: [number, number, number]) => void,
    public HEAP32: Int32Array,
    public HEAPU32: Uint32Array,
    public HEAPU8: Uint8Array
  ) {
    this.id = 0

    const lastError = {} as unknown as ILastError;

    (['errorMessage', 'engineReserved', 'engineErrorCode', 'errorCode']).forEach((key, index) => {
      const isUnsigned = key === 'engineErrorCode'
      const HEAP = isUnsigned ? this.HEAPU32 : this.HEAP32
      Object.defineProperty(lastError, key, {
        configurable: true,
        enumerable: true,
        get: () => {
          return this.napiExtendedErrorInfoPtr !== NULL ? HEAP[(this.napiExtendedErrorInfoPtr >> 2) + index] : NULL
        },
        set: isUnsigned
          ? (value: number) => {
              if (this.napiExtendedErrorInfoPtr !== NULL) {
                HEAP[(this.napiExtendedErrorInfoPtr >> 2) + index] = value >>> 0
              }
            }
          : (value: number) => {
              if (this.napiExtendedErrorInfoPtr !== NULL) {
                HEAP[(this.napiExtendedErrorInfoPtr >> 2) + index] = value
              }
            }
      })
    })

    Object.defineProperty(lastError, 'data', {
      configurable: true,
      enumerable: false,
      get: () => this.napiExtendedErrorInfoPtr
    })

    this.lastError = lastError
  }

  public openScope<Scope extends HandleScope> (ScopeConstructor: { create: (env: napi_env, parent: IHandleScope | null) => Scope }): Scope {
    const scope = ScopeConstructor.create(this.id, this.getCurrentScope() ?? null)
    this.scopeList.push(scope)
    this.openHandleScopes++
    return scope
  }

  public closeScope (scope: IHandleScope): void {
    scope.dispose()
    this.scopeList.pop()
    this.openHandleScopes--
  }

  public callInNewScope<Scope extends HandleScope, Args extends any[], ReturnValue = any> (
    ScopeConstructor: { create: (env: napi_env, parent: IHandleScope | null) => Scope },
    fn: (scope: Scope, ...args: Args) => ReturnValue,
    ...args: Args
  ): ReturnValue {
    const scope = this.openScope(ScopeConstructor)
    let ret: ReturnValue
    try {
      ret = fn(scope, ...args)
    } catch (err) {
      this.tryCatch.setError(err)
    }
    this.closeScope(scope)
    return ret!
  }

  public callInNewHandleScope<Args extends any[], T = any> (fn: (scope: HandleScope, ...args: Args) => T, ...args: Args): T {
    return this.callInNewScope(HandleScope, fn, ...args)
  }

  public callInNewEscapableHandleScope<Args extends any[], T = any> (fn: (scope: EscapableHandleScope, ...args: Args) => T, ...args: Args): T {
    return this.callInNewScope(EscapableHandleScope, fn, ...args)
  }

  public getCurrentScope (): IHandleScope {
    return this.scopeList.last.element
  }

  public ensureHandleId (value: any): napi_value {
    if (isReferenceType(value)) {
      let handle = this.handleStore.getObjectHandleExistsInStore(value)
      if (handle) return handle.id
      handle = this.handleStore.getObjectHandleAlive(value)
      if (!handle) {
        return this.getCurrentScope().add(value).id
      }
      if (handle.value === undefined) {
        // should always true
        const currentScope = this.getCurrentScope()
        handle.value = value
        Store.prototype.add.call(this.handleStore, handle)
        this.handleStore.tryAddToMap(handle, true)
        currentScope.addHandle(handle)
      }
      return handle.id
    }

    return this.getCurrentScope().add(value).id
  }

  public clearLastError (): napi_status {
    this.lastError.errorCode = napi_status.napi_ok
    this.lastError.engineErrorCode = 0
    this.lastError.engineReserved = 0
    this.lastError.errorMessage = 0

    return napi_status.napi_ok
  }

  public setLastError (error_code: napi_status, engine_error_code: uint32_t = 0, engine_reserved: void_p = 0): napi_status {
    this.lastError.errorCode = error_code
    this.lastError.engineErrorCode = engine_error_code
    this.lastError.engineReserved = engine_reserved

    return error_code
  }

  public getReturnStatus (): napi_status {
    return !this.tryCatch.hasCaught() ? napi_status.napi_ok : this.setLastError(napi_status.napi_pending_exception)
  }

  public callIntoModule<T> (fn: (env: Env, scope: IHandleScope) => T): T {
    const r = this.callInNewHandleScope((scope) => {
      this.clearLastError()
      return fn(this, scope)
    })
    if (this.tryCatch.hasCaught()) {
      const err = this.tryCatch.extractException()!
      throw err
    }
    return r
  }

  public getViewPointer (view: TypedArray | DataView): void_p {
    if (!supportFinalizer) {
      return NULL
    }
    if (view.buffer === this.HEAPU8.buffer) {
      return view.byteOffset
    }

    let pointer: void_p
    if (this.typedArrayMemoryMap.has(view)) {
      pointer = this.typedArrayMemoryMap.get(view)!
      this.HEAPU8.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), pointer)
      return pointer
    }

    pointer = this.malloc(view.byteLength)
    this.HEAPU8.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), pointer)
    this.typedArrayMemoryMap.set(view, pointer)
    this.memoryPointerDeleter.register(view, pointer)
    return pointer
  }

  public getArrayBufferPointer (arrayBuffer: ArrayBuffer): void_p {
    if ((!supportFinalizer) || (arrayBuffer === this.HEAPU8.buffer)) {
      return NULL
    }

    let pointer: void_p
    if (this.arrayBufferMemoryMap.has(arrayBuffer)) {
      pointer = this.arrayBufferMemoryMap.get(arrayBuffer)!
      this.HEAPU8.set(new Uint8Array(arrayBuffer), pointer)
      return pointer
    }

    pointer = this.malloc(arrayBuffer.byteLength)
    this.HEAPU8.set(new Uint8Array(arrayBuffer), pointer)
    this.arrayBufferMemoryMap.set(arrayBuffer, pointer)
    this.memoryPointerDeleter.register(arrayBuffer, pointer)
    return pointer
  }

  public dispose (): void {
    this.scopeList.clear()
    this.deferredStore.dispose()
    this.refStore.dispose()
    this.scopeStore.dispose()
    this.handleStore.dispose()
    this.tryCatch.extractException()
    try {
      this.free(this.napiExtendedErrorInfoPtr)
      this.napiExtendedErrorInfoPtr = NULL
    } catch (_) {}
    envStore.remove(this.id)
  }
}