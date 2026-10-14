export function preferCanvas(renderer: string, hasWebGL: boolean) {
  return !hasWebGL || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)
}

/** Pure sprite/Graphics scene: Canvas is a functional fallback, not a reduced
 * gameplay mode. Avoid paying software WebGL shader overhead on remote browsers. */
export function detectCanvasFallback() {
  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2') ?? probe.getContext('webgl')
  if (!gl) return true
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    return preferCanvas(renderer, true)
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
