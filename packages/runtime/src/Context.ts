import { EnvStore } from './EnvStore'
import { ScopeStore } from './ScopeStore'
import { RefStore } from './RefStore'
import { DeferredStore } from './DeferredStore'
import { HandleStore } from './Handle'
import type { Handle } from './Handle'
import type { HandleScope } from './HandleScope'
import type { Env } from './env'
import {
  _global,
  supportReflect,
  supportFinalizer,
  supportBigInt,
  supportNewFunction,
  canSetFunctionName,
  _setImmediate,
  Buffer
} from './util'
import { CallbackInfoStack } from './CallbackInfo'
import { NotSupportWeakRefError, NotSupportBigIntError } from './errors'

/** @internal */
export class Context {
  public envStore = new EnvStore()
  public scopeStore = new ScopeStore()
  public refStore = new RefStore()
  public deferredStore = new DeferredStore()
  public handleStore = new HandleStore()
  public cbinfoStack = new CallbackInfoStack()
  public feature = {
    supportReflect,
    supportFinalizer,
    supportBigInt,
    supportNewFunction,
    canSetFunctionName,
    setImmediate: _setImmediate,
    Buffer
  }

  createNotSupportWeakRefError (api: string, message: string): NotSupportWeakRefError {
    return new NotSupportWeakRefError(api, message)
  }

  createNotSupportBigIntError (api: string, message: string): NotSupportBigIntError {
    return new NotSupportBigIntError(api, message)
  }

  /** @internal */
  getCurrentScope (): HandleScope | null {
    return this.scopeStore.currentScope
  }

  /** @internal */
  addToCurrentScope<V> (value: V): Handle<V> {
    return this.scopeStore.currentScope.add(value)
  }

  /** @internal */
  openScope (envObject: Env): HandleScope {
    return this.scopeStore.openScope(envObject)
  }

  /** @internal */
  closeScope (envObject: Env, _scope?: HandleScope): void {
    return this.scopeStore.closeScope(envObject)
  }

  /** @internal */
  ensureHandle<S> (value: S): Handle<S> {
    switch (value as any) {
      case undefined: return HandleStore.UNDEFINED as any
      case null: return HandleStore.NULL as any
      case true: return HandleStore.TRUE as any
      case false: return HandleStore.FALSE as any
      case _global: return HandleStore.GLOBAL as any
      default: break
    }

    const currentScope = this.scopeStore.currentScope
    return currentScope.add(value)
  }
}

/** @public */
export function createContext (): Context {
  return new Context()
}
