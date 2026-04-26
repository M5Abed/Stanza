import { Innertube, Platform } from 'youtubei.js'

/* ---------- JavaScript interpreter for URL deciphering ---------- */
// YouTube obfuscates streaming URLs — youtubei.js needs an eval shim
// to run the player's decipher code in Node.js.
;(Platform.shim as any).eval = (data: any, env: Record<string, any>) => {
  const script = typeof data === 'string' ? data : data?.output ?? data?.script ?? ''
  const keys = Object.keys(env)
  const values = keys.map((k) => env[k])
  if (!script.trim()) return undefined

  // youtubei.js passes BuildScriptResult.output as a function body.
  // Run it with env args in the same way as the previous shim.
  try {
    const bodyFn = new Function(...keys, `"use strict";\n${script}`)
    return bodyFn(...values)
  } catch {
    // Fallback for plain expression payloads.
    const exprFn = new Function(...keys, `return (${script});`)
    return exprFn(...values)
  }
}

/* ---------- Lazy Innertube singleton ---------- */
let _innertube: Innertube | null = null

export async function getInnertube(): Promise<Innertube> {
  if (!_innertube) {
    _innertube = await Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: true,
    })
  }
  return _innertube
}

export function resetInnertube(): void {
  _innertube = null
}
