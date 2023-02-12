/* eslint-disable @typescript-eslint/indent */

declare let emnapiUtf8Decoder: { decode: (input: BufferSource) => string }
declare let emnapiUtf16leDecoder: { decode: (input: BufferSource) => string }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare function emnapiUtf8ToString (ptr: void_p, length: int): string
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare function emnapiUtf16ToString (ptr: void_p, length: int): string

mergeInto(LibraryManager.library, {
  $emnapiUtf8Decoder__postset: 'emnapiUtf8Decoder();',
  $emnapiUtf8Decoder: function () {
// #if !TEXTDECODER || TEXTDECODER == 1
    const fallbackDecoder = {
      decode (input: BufferSource) {
        const isArrayBuffer = input instanceof ArrayBuffer
        const isView = ArrayBuffer.isView(input)
        if (!isArrayBuffer && !isView) {
          throw new TypeError('The "input" argument must be an instance of ArrayBuffer or ArrayBufferView')
        }
        let bytes = isArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)

        let inputIndex = 0
        const pendingSize = Math.min(256 * 256, bytes.length + 1)
        const pending = new Uint16Array(pendingSize)
        const chunks = []
        let pendingIndex = 0

        for (;;) {
          const more = inputIndex < bytes.length

          if (!more || (pendingIndex >= pendingSize - 1)) {
            const subarray = pending.subarray(0, pendingIndex)
            const arraylike = subarray as unknown as number[]
            chunks.push(String.fromCharCode.apply(null, arraylike))

            if (!more) {
              return chunks.join('')
            }

            bytes = bytes.subarray(inputIndex)
            inputIndex = 0
            pendingIndex = 0
          }

          const byte1 = bytes[inputIndex++]
          if ((byte1 & 0x80) === 0) {
            pending[pendingIndex++] = byte1
          } else if ((byte1 & 0xe0) === 0xc0) {
            const byte2 = bytes[inputIndex++] & 0x3f
            pending[pendingIndex++] = ((byte1 & 0x1f) << 6) | byte2
          } else if ((byte1 & 0xf0) === 0xe0) {
            const byte2 = bytes[inputIndex++] & 0x3f
            const byte3 = bytes[inputIndex++] & 0x3f
            pending[pendingIndex++] = ((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3
          } else if ((byte1 & 0xf8) === 0xf0) {
            const byte2 = bytes[inputIndex++] & 0x3f
            const byte3 = bytes[inputIndex++] & 0x3f
            const byte4 = bytes[inputIndex++] & 0x3f

            let codepoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4
            if (codepoint > 0xffff) {
              codepoint -= 0x10000
              pending[pendingIndex++] = (codepoint >>> 10) & 0x3ff | 0xd800
              codepoint = 0xdc00 | codepoint & 0x3ff
            }
            pending[pendingIndex++] = codepoint
          } else {
          // invalid
          }
        }
      }
    }
// #endif
    let tmp: any // typescript bug
// #if !TEXTDECODER
    tmp = fallbackDecoder
// #elif TEXTDECODER == 1
    tmp = typeof TextDecoder === 'function' ? new TextDecoder() : fallbackDecoder
// #elif TEXTDECODER == 2
    tmp = new TextDecoder()
// #endif
    emnapiUtf8Decoder = tmp
  },

  $emnapiUtf8ToString__deps: ['$emnapiUtf8Decoder'],
  $emnapiUtf8ToString: function (ptr: void_p, length: int) {
    // eslint-disable-next-line eqeqeq
    if (length == -1) {
      return UTF8ToString(ptr)
    }
    length = length >>> 0
    return emnapiUtf8Decoder.decode($getUnsharedTextDecoderView('HEAPU8', 'ptr', 'ptr + length'))
  },

  $emnapiUtf16leDecoder__postset: 'emnapiUtf16leDecoder();',
  $emnapiUtf16leDecoder: function () {
// #if !TEXTDECODER || TEXTDECODER == 1
    const fallbackDecoder = {
      decode (input: BufferSource) {
        const isArrayBuffer = input instanceof ArrayBuffer
        const isView = ArrayBuffer.isView(input)
        if (!isArrayBuffer && !isView) {
          throw new TypeError('The "input" argument must be an instance of ArrayBuffer or ArrayBufferView')
        }
        const bytes = isArrayBuffer ? new Uint16Array(input) : new Uint16Array(input.buffer, input.byteOffset, input.byteLength / 2)
        const wcharArray = Array(bytes.length)
        for (let i = 0; i < bytes.length; ++i) {
          wcharArray[i] = String.fromCharCode(bytes[i])
        }
        return wcharArray.join('')
      }
    }
// #endif
    let tmp: any // typescript bug
// #if !TEXTDECODER
    tmp = fallbackDecoder
// #elif TEXTDECODER == 1
    tmp = typeof TextDecoder === 'function' ? new TextDecoder('utf-16le') : fallbackDecoder
// #elif TEXTDECODER == 2
    tmp = new TextDecoder('utf-16le')
// #endif
    emnapiUtf16leDecoder = tmp
  },

  $emnapiUtf16ToString__deps: [
// #if typeof LEGACY_RUNTIME !== 'undefined' && !LEGACY_RUNTIME
    '$UTF16ToString',
// #endif
    '$emnapiUtf16leDecoder'
  ],
  $emnapiUtf16ToString: function (ptr: void_p, length: int) {
    // eslint-disable-next-line eqeqeq
    if (length == -1) {
      return UTF16ToString(ptr)
    }
    length = length >>> 0
    return emnapiUtf16leDecoder.decode($getUnsharedTextDecoderView('HEAPU8', 'ptr', 'ptr + length * 2'))
  }
})