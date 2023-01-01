/* eslint-disable @typescript-eslint/no-redeclare */
/* eslint-disable @typescript-eslint/indent */

// #if DYNAMIC_EXECUTION

// @ts-expect-error
function napi_run_script (env: napi_env, script: napi_value, result: Pointer<napi_value>): napi_status {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let value: number

  $PREAMBLE!(env, (envObject) => {
    $CHECK_ARG!(envObject, script)
    $CHECK_ARG!(envObject, result)
    const v8Script = emnapiCtx.handleStore.get(script)!
    if (!v8Script.isString()) {
      return envObject.setLastError(napi_status.napi_string_expected)
    }
    const g: typeof globalThis = emnapiCtx.handleStore.get(emnapiRt.HandleStore.ID_GLOBAL)!.value
    const ret = g.eval(v8Script.value)
    $from64('result')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value = envObject.ensureHandleId(ret)
    $makeSetValue('result', 0, 'value', '*')
    return envObject.getReturnStatus()
  })
}

// #else

// @ts-expect-error
function napi_run_script (env: napi_env, script: napi_value, result: Pointer<napi_value>): napi_status {
  return _napi_set_last_error(env, napi_status.napi_generic_failure, 0, 0)
}

// #endif

emnapiImplement('napi_run_script', 'ippp', napi_run_script, ['napi_set_last_error'])
