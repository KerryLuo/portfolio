import { useEffect, useRef } from 'react'

// Full-screen ASCII background. The light underneath is a flowing green glow:
// warped noise drifting over time, which the mouse pushes around like stirring
// water. The screen is split into character cells, and each cell shows the
// glyph whose amount of ink matches the light there, from small, sparse marks
// (. : ~) up to '#'.
//
// Two things keep it mostly dark and out of the way of the page:
//   - Light that sits in one place slowly fades. A remembered copy of the
//     light trails the real one by a few seconds, and wherever both are bright
//     the glyphs dissolve. Solid blocks of '#' melt away, leaving only their
//     edges and whatever has just moved, so the background keeps shifting
//     back and forth while staying mostly dark.
//   - Behind anything people read (text, icons, buttons, cards, inputs) the
//     glyphs are capped at half brightness, so every word stays legible.
//
// Each frame runs these WebGL passes:
//   field   the light pattern at a coarse resolution, warped by the mouse
//   blur ×2 a separable gaussian blur that softens it into a gradient
//   memory  eases the remembered light toward the current light
//   ascii   for every screen pixel: find its cell, read the light, memory and
//           text mask there, pick the glyph and stamp it from an atlas drawn
//           in the site's mono font
//
// Glyphs are chosen by measured ink coverage rather than by their position in
// the ramp, so the steps between them look even in whatever font is used.

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const NOISE = `
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}`

const FIELD_FRAG = `#version 300 es
precision highp float;
uniform float uAspect;
uniform float uTime;
uniform sampler2D uDisp;
in vec2 vUv;
out vec4 outColor;
${NOISE}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// The flowing pattern itself: noise warped by noise, drifting with time.
float pattern(vec2 p, float t) {
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.7, 0.0)));
  vec2 r = vec2(
    fbm(p + 1.4 * q + vec2(1.7, 9.2) + t),
    fbm(p + 1.4 * q + vec2(8.3, 2.8) - t * 0.8)
  );
  return smoothstep(0.4, 0.8, fbm(p + 1.4 * r));
}

void main() {
  vec2 uv = vUv - texture(uDisp, vUv).rg;
  vec2 p = uv * vec2(uAspect, 1.0) * 1.4;
  float t = uTime * 0.09;
  float light = pattern(p, t);

  // Keep the screen balanced: look at the area around this point. Deep inside
  // a large dark region a soft light blob grows; deep inside a large lit
  // region a dark pocket opens up, so dark spots keep appearing.
  float around = light;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    around += pattern(p + vec2(cos(a), sin(a)) * 0.45, t);
  }
  around /= 9.0;
  float tooDark = 1.0 - smoothstep(0.0, 0.05, around);
  float tooLight = smoothstep(0.3, 0.55, around);
  light = max(light, tooDark * 0.7);
  light *= 1.0 - tooLight * 0.85;

  outColor = vec4(light, 0.0, 0.0, 1.0);
}`

const BLUR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uStep;   // one texel along the blur direction
uniform float uSigma; // in texels
in vec2 vUv;
out vec4 outColor;
void main() {
  int r = int(ceil(uSigma * 2.5));
  float sum = 0.0;
  float total = 0.0;
  for (int i = -32; i <= 32; i++) {
    if (i < -r || i > r) continue;
    float w = exp(-float(i * i) / (2.0 * uSigma * uSigma));
    sum += texture(uSrc, vUv + uStep * float(i)).r * w;
    total += w;
  }
  outColor = vec4(sum / total, 0.0, 0.0, 1.0);
}`

// The remembered light: eases toward the current light, slowly while light is
// arriving and faster once it has gone.
const MEMORY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uLight;
uniform sampler2D uPrev;
uniform float uRise;
uniform float uFall;
in vec2 vUv;
out vec4 outColor;
void main() {
  float light = texture(uLight, vUv).r;
  float prev = texture(uPrev, vUv).r;
  outColor = vec4(mix(prev, light, light > prev ? uRise : uFall), 0.0, 0.0, 1.0);
}`

const MAX_GLYPHS = 16

const ASCII_FRAG = `#version 300 es
precision highp float;
#define MAX_GLYPHS ${MAX_GLYPHS}
uniform sampler2D uField;
uniform sampler2D uAtlas;
uniform sampler2D uMemory;
uniform sampler2D uMask;   // one texel per cell: 1 behind readable content
uniform vec2 uCanvas;      // device px
uniform vec2 uCell;        // device px, whole numbers
uniform vec2 uGridOffset;  // centres the grid so edge cells are cut evenly
uniform vec2 uFieldScale;  // device px -> field uv
uniform vec2 uFieldOffset;
uniform float uCov[MAX_GLYPHS]; // each glyph's ink, 0 (space) to 1 ('#'), ascending
uniform int uCount;
uniform float uReveal;     // 0 -> 1 over the page-load fade
out vec4 outColor;
${NOISE}

// Long-lit light fades: by FADE where the remembered light is above MEM_HI,
// not at all below MEM_LO. Dim edges stay, solid bright blocks melt away.
const float FADE = 0.88;
const float MEM_LO = 0.22;
const float MEM_HI = 0.6;

// How light maps onto the glyph ramp.
const float LO = 0.08;     // below this, cells are blank
const float HI = 0.75;     // at or above this, cells get '#'
const float GAMMA = 1.1;   // >1 keeps the heavy glyphs for the brightest spots
const float DITHER = 0.06; // per-cell jitter so steps between glyphs blend

// Behind readable content, glyphs reach at most this much of '#'.
const float TEXT_CAP = 0.5;

const vec3 BASE = vec3(0.043, 0.059, 0.052);       // near-black green
const vec3 GLOW = vec3(0.10, 0.20, 0.155);         // the old gradient's green
const float GLOW_AMOUNT = 0.3;                     // faint glow under the glyphs
// Kept well below the page's text so glyphs never compete with it.
const vec3 INK_DIM = vec3(0.14, 0.185, 0.165);     // gray-green, barely there
const vec3 INK_BRIGHT = vec3(0.37, 0.46, 0.41);    // muted sage, used for '#'

void main() {
  vec2 pix = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) + uGridOffset;
  vec2 cell = floor(pix / uCell);
  vec2 inCell = pix - cell * uCell;

  // Light and remembered light at the cell's centre.
  vec2 centre = (cell + 0.5) * uCell - uGridOffset;
  vec2 f = centre * uFieldScale + uFieldOffset;
  vec2 fuv = vec2(f.x, 1.0 - f.y);
  float light = texture(uField, fuv).r;
  float memory = texture(uMemory, fuv).r;
  float shown = light * (1.0 - FADE * smoothstep(MEM_LO, MEM_HI, memory));

  float level = clamp((shown - LO) / (HI - LO), 0.0, 1.0);
  level = pow(level, GAMMA) + (hash(cell) - 0.5) * DITHER;

  float cap = mix(1.0, TEXT_CAP, texelFetch(uMask, ivec2(cell), 0).r);
  level = min(level, cap);

  // The glyph whose ink is closest to the light here, never past the cap.
  int best = 0;
  float bestDiff = 2.0;
  for (int i = 0; i < MAX_GLYPHS; i++) {
    if (i >= uCount || uCov[i] > cap + 0.001) break;
    float diff = abs(uCov[i] - level);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  ivec2 texel = ivec2(best * int(uCell.x) + int(inCell.x), int(inCell.y));
  float ink = texelFetch(uAtlas, texel, 0).r;

  // On load the glow fades up from black and cells switch on one by one.
  float fade = smoothstep(0.0, 1.0, uReveal);
  float on = hash(cell + 17.31) * 0.65;
  float cellOn = smoothstep(on, on + 0.35, uReveal);

  vec3 bg = mix(BASE, GLOW, clamp(shown, 0.0, 1.0) * GLOW_AMOUNT) * fade;
  vec3 inkCol = mix(INK_DIM, INK_BRIGHT, smoothstep(0.05, 1.0, max(level, 0.0)));
  outColor = vec4(mix(bg, inkCol, ink * cellOn), 1.0);
}`

// Candidate glyphs, sparse to dense; '#' is the brightest. Their real order
// comes from measuring how much ink each one leaves in the font. ('-' is left
// out: it has the same ink as '.', so it would never be picked.)
const GLYPHS = ' .:~=+*o#'
const FONT = '"IBM Plex Mono", ui-monospace, monospace'
const FONT_PX = 13
const CELL_W = 9 // px per character cell
const CELL_H = 15
const MAX_DPR = 2

const FIELD_PX = 12 // the light is computed on a coarse grid of this many px
const BLUR = 44 // px, how soft the light is before it's turned into glyphs
// The light extends past each screen edge so the blur doesn't darken the borders.
const BLEED = Math.round(BLUR * 2.5)

const MEMORY_RISE_S = 6 // roughly how long light sits still before it has faded
const MEMORY_FALL_S = 2.5 // how fast a spot that went dark is ready to light up again

// Things people read; their boxes cap the glyphs behind them. Text itself is
// found line by line, so this only lists what isn't plain text.
const READABLE = 'svg, img, input, textarea, button, .btn, .card, .skill, .tag, .heatmap, .portrait'
const MASK_PAD_X = 6 // px of clearance around each readable box
const MASK_PAD_Y = 3
const MASK_FEATHER = 1.5 // cells over which the cap eases off

const GRID_W = 64
const GRID_H = 40
const RADIUS = 0.14 // size of the mouse's push, as a fraction of screen height
const GLIDE = 0.975 // how long pushed light keeps travelling after the mouse stops
const PUSH = 2.8 * (1 - GLIDE) // total travel is about 2.8x the mouse's movement
const SPREAD = 0.01 // how much a push slowly spreads into its surroundings
const LIMIT = 6 // cap on how far any spot can be pushed in total
const FADE_IN_MS = 12000 // black at first, then the glyphs fade in over this long

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

function createProgram(gl: WebGL2RenderingContext, frag: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}

// Textures are created and filled on this unit so that doing so never
// disturbs the textures the passes read from units 0–4.
const SCRATCH_UNIT = 7

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number }

function createTarget(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  format: number,
  type: number,
): Target | null {
  const tex = gl.createTexture()
  const fbo = gl.createFramebuffer()
  if (!tex || !fbo) return null
  gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, gl.RGBA, type, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { tex, fbo, w, h }
}

function deleteTarget(gl: WebGL2RenderingContext, t: Target | null) {
  if (!t) return
  gl.deleteTexture(t.tex)
  gl.deleteFramebuffer(t.fbo)
}

function createTexture(gl: WebGL2RenderingContext, filter: number) {
  const tex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

// Draws every glyph side by side, white on black, one cell each. Returns the
// glyphs sorted from least to most ink, with each one's ink relative to the
// densest glyph.
function buildAtlas(cellW: number, cellH: number, fontPx: number) {
  const canvas = document.createElement('canvas')
  canvas.width = cellW * GLYPHS.length
  canvas.height = cellH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const draw = (chars: string[]) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.font = `${fontPx}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chars.forEach((c, i) => ctx.fillText(c, i * cellW + cellW / 2, cellH / 2))
  }

  const chars = [...GLYPHS]
  draw(chars)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const measured = chars.map((char, i) => {
    let ink = 0
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) ink += data[(y * canvas.width + i * cellW + x) * 4]
    }
    return { char, ink }
  })
  measured.sort((a, b) => a.ink - b.ink)
  const densest = measured[measured.length - 1].ink || 1
  draw(measured.map((m) => m.char))
  return { canvas, coverage: measured.map((m) => m.ink / densest) }
}

function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    })
    const fieldProg = gl && createProgram(gl, FIELD_FRAG)
    const blurProg = gl && createProgram(gl, BLUR_FRAG)
    const memoryProg = gl && createProgram(gl, MEMORY_FRAG)
    const asciiProg = gl && createProgram(gl, ASCII_FRAG)
    if (!gl || !fieldProg || !blurProg || !memoryProg || !asciiProg) {
      canvas.classList.add('bg-fallback')
      return
    }

    // The remembered light changes by tiny amounts each frame, which 8-bit
    // textures can't hold; without float targets it updates in coarser steps.
    const floatTargets = !!gl.getExtension('EXT_color_buffer_float')
    const memoryFormat = floatTargets ? gl.RGBA16F : gl.RGBA8
    const memoryType = floatTargets ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
    const memoryStep = floatTargets ? 0 : 0.1 // seconds between updates

    // One triangle that covers the whole screen, shared by every pass.
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    const triangle = () => gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

    // Texture units: 0 mouse push, 1 light, 2 glyph atlas, 3 memory, 4 text mask.
    const loc = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name)
    gl.useProgram(fieldProg)
    gl.uniform1i(loc(fieldProg, 'uDisp'), 0)
    const uAspect = loc(fieldProg, 'uAspect')
    const uTime = loc(fieldProg, 'uTime')
    gl.useProgram(blurProg)
    gl.uniform1i(loc(blurProg, 'uSrc'), 1)
    gl.uniform1f(loc(blurProg, 'uSigma'), BLUR / FIELD_PX)
    const uStep = loc(blurProg, 'uStep')
    gl.useProgram(memoryProg)
    gl.uniform1i(loc(memoryProg, 'uLight'), 1)
    gl.uniform1i(loc(memoryProg, 'uPrev'), 3)
    const uRise = loc(memoryProg, 'uRise')
    const uFall = loc(memoryProg, 'uFall')
    gl.useProgram(asciiProg)
    gl.uniform1i(loc(asciiProg, 'uField'), 1)
    gl.uniform1i(loc(asciiProg, 'uAtlas'), 2)
    gl.uniform1i(loc(asciiProg, 'uMemory'), 3)
    gl.uniform1i(loc(asciiProg, 'uMask'), 4)
    const uCanvas = loc(asciiProg, 'uCanvas')
    const uCell = loc(asciiProg, 'uCell')
    const uGridOffset = loc(asciiProg, 'uGridOffset')
    const uFieldScale = loc(asciiProg, 'uFieldScale')
    const uFieldOffset = loc(asciiProg, 'uFieldOffset')
    const uCov = loc(asciiProg, 'uCov')
    const uCount = loc(asciiProg, 'uCount')
    const uReveal = loc(asciiProg, 'uReveal')

    const bindTex = (unit: number, tex: WebGLTexture | null) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
    }

    // Mouse push: velocity and offset per grid cell (x, y pairs, GL coords).
    const size = GRID_W * GRID_H * 2
    const vel = new Float32Array(size)
    const disp = new Float32Array(size)
    const tmp = new Float32Array(size)

    const dispTex = createTexture(gl, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, GRID_W, GRID_H, 0, gl.RG, gl.FLOAT, disp)
    const upload = () => {
      bindTex(SCRATCH_UNIT, dispTex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID_W, GRID_H, gl.RG, gl.FLOAT, disp)
    }

    const atlasTex = createTexture(gl, gl.NEAREST)
    const maskTex = createTexture(gl, gl.NEAREST)

    // Sizes in device pixels; the cells are whole pixels so glyphs stay crisp.
    let cellW = 0
    let cellH = 0
    let fontPx = 0
    let ready = false
    const loadAtlas = () => {
      const atlas = buildAtlas(cellW, cellH, fontPx)
      if (!atlas) return
      bindTex(SCRATCH_UNIT, atlasTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas)
      const cov = new Float32Array(MAX_GLYPHS)
      cov.set(atlas.coverage.slice(0, MAX_GLYPHS))
      gl.useProgram(asciiProg)
      gl.uniform1fv(uCov, cov)
      gl.uniform1i(uCount, Math.min(MAX_GLYPHS, atlas.coverage.length))
      ready = true
    }

    // --- Text mask: which cells sit behind something people read ---------

    // The cell grid in CSS px, matching the shader's.
    let cellCssW = 1
    let cellCssH = 1
    let gridCssX = 0
    let gridCssY = 0
    let maskCols = 1
    let maskRows = 1
    let mask = new Uint8Array(1)

    // Readable boxes in page coordinates, so scrolling only shifts them.
    // Gathered again whenever the page's layout may have changed.
    let pageRects: number[] = []
    let rectsStale = true
    let maskStale = true
    const gatherRects = () => {
      rectsStale = false
      maskStale = true
      pageRects = []
      const root = document.querySelector('main')
      if (!root) return
      const sx = window.scrollX
      const sy = window.scrollY
      const addAll = (list: DOMRectList) => {
        for (let i = 0; i < list.length; i++) {
          const r = list[i]
          if (r.width > 0 && r.height > 0) pageRects.push(r.left + sx, r.top + sy, r.right + sx, r.bottom + sy)
        }
      }
      // Each line of each piece of text.
      const range = document.createRange()
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.nodeValue?.trim()) continue
        range.selectNodeContents(node)
        addAll(range.getClientRects())
      }
      root.querySelectorAll(READABLE).forEach((el) => addAll(el.getClientRects()))
    }

    const stamp = (l: number, t: number, r: number, b: number) => {
      if (r < -MASK_PAD_X || b < -MASK_PAD_Y) return
      if (l > window.innerWidth + MASK_PAD_X || t > window.innerHeight + MASK_PAD_Y) return
      // The padded box, in cell units.
      const cl = (l - MASK_PAD_X + gridCssX) / cellCssW
      const cr = (r + MASK_PAD_X + gridCssX) / cellCssW
      const ct = (t - MASK_PAD_Y + gridCssY) / cellCssH
      const cb = (b + MASK_PAD_Y + gridCssY) / cellCssH
      const x0 = Math.max(0, Math.floor(cl - MASK_FEATHER))
      const x1 = Math.min(maskCols - 1, Math.ceil(cr + MASK_FEATHER))
      const y0 = Math.max(0, Math.floor(ct - MASK_FEATHER))
      const y1 = Math.min(maskRows - 1, Math.ceil(cb + MASK_FEATHER))
      for (let y = y0; y <= y1; y++) {
        const dy = Math.max(ct - (y + 1), 0, y - cb)
        for (let x = x0; x <= x1; x++) {
          // Any cell touching the box is fully capped; the cap eases off
          // over MASK_FEATHER cells beyond it.
          const d = Math.hypot(Math.max(cl - (x + 1), 0, x - cr), dy)
          if (d >= MASK_FEATHER) continue
          const v = Math.round(255 * (1 - d / MASK_FEATHER))
          const k = y * maskCols + x
          if (v > mask[k]) mask[k] = v
        }
      }
    }

    // Repaints the mask when the page has scrolled, the nav has moved, or the
    // layout has changed.
    let lastScroll = [NaN, NaN, NaN, NaN]
    const updateMask = () => {
      if (rectsStale) gatherRects()
      const nav = document.querySelector('.nav')?.getBoundingClientRect()
      const now = [window.scrollX, window.scrollY, nav?.top ?? 0, nav?.bottom ?? 0]
      if (!maskStale && now.every((v, i) => v === lastScroll[i])) return
      maskStale = false
      lastScroll = now
      mask.fill(0)
      const [sx, sy] = now
      for (let i = 0; i < pageRects.length; i += 4) {
        stamp(pageRects[i] - sx, pageRects[i + 1] - sy, pageRects[i + 2] - sx, pageRects[i + 3] - sy)
      }
      if (nav) stamp(nav.left, nav.top, nav.right, nav.bottom)
      bindTex(SCRATCH_UNIT, maskTex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, maskCols, maskRows, gl.RED, gl.UNSIGNED_BYTE, mask)
    }

    const markLayoutChanged = () => {
      rectsStale = true
    }
    const main = document.querySelector('main')
    const mutations = new MutationObserver(markLayoutChanged)
    const resizes = new ResizeObserver(markLayoutChanged)
    if (main) {
      mutations.observe(main, { childList: true, subtree: true, characterData: true })
      resizes.observe(main)
    }

    // --- Render targets and sizing ----------------------------------------

    let fieldA: Target | null = null
    let fieldB: Target | null = null
    let memory: Target | null = null // the current remembered light
    let memoryNext: Target | null = null
    let memoryDue = 0 // seconds since the memory was last updated
    let sized = false

    const resize = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))

      const fieldW = w + BLEED * 2
      const fieldH = h + BLEED * 2
      const tw = Math.max(1, Math.round(fieldW / FIELD_PX))
      const th = Math.max(1, Math.round(fieldH / FIELD_PX))
      for (const t of [fieldA, fieldB, memory, memoryNext]) deleteTarget(gl, t)
      fieldA = createTarget(gl, tw, th, gl.RGBA8, gl.UNSIGNED_BYTE)
      fieldB = createTarget(gl, tw, th, gl.RGBA8, gl.UNSIGNED_BYTE)
      memory = createTarget(gl, tw, th, memoryFormat, memoryType)
      memoryNext = createTarget(gl, tw, th, memoryFormat, memoryType)
      // After the first load, a resize starts with the memory already caught
      // up, rather than flashing every block back on.
      if (sized) memoryDue = Infinity
      sized = true

      gl.useProgram(fieldProg)
      gl.uniform1f(uAspect, fieldW / fieldH)

      const cw = Math.max(1, Math.round(CELL_W * dpr))
      const ch = Math.max(1, Math.round(CELL_H * dpr))
      const fp = Math.round(FONT_PX * dpr)
      const gx = Math.floor((cw - (canvas.width % cw)) / 2)
      const gy = Math.floor((ch - (canvas.height % ch)) / 2)
      gl.useProgram(asciiProg)
      gl.uniform2f(uCanvas, canvas.width, canvas.height)
      gl.uniform2f(uCell, cw, ch)
      gl.uniform2f(uGridOffset, gx, gy)
      gl.uniform2f(uFieldScale, 1 / (dpr * fieldW), 1 / (dpr * fieldH))
      gl.uniform2f(uFieldOffset, BLEED / fieldW, BLEED / fieldH)

      cellCssW = cw / dpr
      cellCssH = ch / dpr
      gridCssX = gx / dpr
      gridCssY = gy / dpr
      maskCols = Math.ceil((canvas.width + gx) / cw)
      maskRows = Math.ceil((canvas.height + gy) / ch)
      mask = new Uint8Array(maskCols * maskRows)
      bindTex(SCRATCH_UNIT, maskTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, maskCols, maskRows, 0, gl.RED, gl.UNSIGNED_BYTE, mask)
      rectsStale = true

      if (cw !== cellW || ch !== cellH || fp !== fontPx) {
        cellW = cw
        cellH = ch
        fontPx = fp
        loadAtlas()
      }
    }

    // dt: seconds since the last frame (Infinity snaps the memory to the light).
    const render = (seconds: number, reveal: number, dt: number) => {
      if (!ready || !fieldA || !fieldB || !memory || !memoryNext) return
      bindTex(0, dispTex)
      bindTex(1, null)
      bindTex(2, atlasTex)
      bindTex(3, null)
      bindTex(4, maskTex)

      gl.bindFramebuffer(gl.FRAMEBUFFER, fieldA.fbo)
      gl.viewport(0, 0, fieldA.w, fieldA.h)
      gl.useProgram(fieldProg)
      gl.uniform1f(uTime, seconds)
      triangle()

      gl.useProgram(blurProg)
      bindTex(1, fieldA.tex)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fieldB.fbo)
      gl.uniform2f(uStep, 1 / fieldA.w, 0)
      triangle()
      bindTex(1, fieldB.tex)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fieldA.fbo)
      gl.uniform2f(uStep, 0, 1 / fieldA.h)
      triangle()
      bindTex(1, fieldA.tex)

      memoryDue += dt
      if (memoryDue >= memoryStep) {
        // On load the whole field shows first; it only starts fading in the
        // second half of the reveal, so the page opens full and then drains.
        const hold = Math.min(1, Math.max(0, (reveal - 0.4) / 0.6))
        gl.useProgram(memoryProg)
        gl.uniform1f(uRise, (1 - Math.exp(-memoryDue / MEMORY_RISE_S)) * hold * hold * (3 - 2 * hold))
        gl.uniform1f(uFall, 1 - Math.exp(-memoryDue / MEMORY_FALL_S))
        bindTex(3, memory.tex)
        gl.bindFramebuffer(gl.FRAMEBUFFER, memoryNext.fbo)
        triangle()
        ;[memory, memoryNext] = [memoryNext, memory]
        memoryDue = 0
      }
      bindTex(3, memory.tex)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(asciiProg)
      gl.uniform1f(uReveal, reveal)
      triangle()
    }

    resize()
    let disposed = false

    // The atlas is first drawn with whatever font is ready; redraw it once the
    // site's mono font has loaded. Text moves when fonts load, too.
    const whenFontLoads = (then: () => void) => {
      document.fonts
        ?.load(`${fontPx}px ${FONT}`)
        .then(() => {
          if (disposed) return
          loadAtlas()
          then()
        })
        .catch(() => {})
      document.fonts?.ready.then(() => {
        rectsStale = true
        if (!disposed) then()
      })
    }

    const cleanupObservers = () => {
      mutations.disconnect()
      resizes.disconnect()
    }

    // Visitors who ask for reduced motion get one still frame, already faded,
    // redrawn only when the page scrolls or resizes.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const still = () => {
        updateMask()
        render(20, 1, Infinity)
      }
      still()
      whenFontLoads(still)
      const onResizeStill = () => {
        resize()
        still()
      }
      window.addEventListener('resize', onResizeStill)
      window.addEventListener('scroll', still, { passive: true })
      return () => {
        disposed = true
        cleanupObservers()
        window.removeEventListener('resize', onResizeStill)
        window.removeEventListener('scroll', still)
      }
    }

    whenFontLoads(() => {})

    let awake = false

    const fieldAspect = () => (window.innerWidth + BLEED * 2) / (window.innerHeight + BLEED * 2)

    const splat = (x: number, y: number, dx: number, dy: number) => {
      const aspect = fieldAspect()
      const r2 = RADIUS * RADIUS
      for (let j = 0; j < GRID_H; j++) {
        const cy = (j + 0.5) / GRID_H - y
        for (let i = 0; i < GRID_W; i++) {
          const cx = ((i + 0.5) / GRID_W - x) * aspect
          const d2 = cx * cx + cy * cy
          if (d2 > r2 * 9) continue
          const w = Math.exp(-d2 / r2) * PUSH
          const k = (j * GRID_W + i) * 2
          vel[k] += dx * w
          vel[k + 1] += dy * w
        }
      }
      awake = true
    }

    // Each frame: the push spreads to neighbouring cells and fades, moves the
    // pattern, and the pattern eases back to rest.
    const blurInto = (src: Float32Array, k: number, i: number, j: number, c: number) => {
      const l = i > 0 ? k - 2 : k
      const r = i < GRID_W - 1 ? k + 2 : k
      const d = j > 0 ? k - GRID_W * 2 : k
      const u = j < GRID_H - 1 ? k + GRID_W * 2 : k
      return (src[l + c] + src[r + c] + src[d + c] + src[u + c]) * 0.25
    }

    const step = () => {
      let peak = 0
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          const k = (j * GRID_W + i) * 2
          for (let c = 0; c < 2; c++) {
            tmp[k + c] = (vel[k + c] * 0.6 + blurInto(vel, k, i, j, c) * 0.4) * GLIDE
          }
        }
      }
      vel.set(tmp)
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          const k = (j * GRID_W + i) * 2
          for (let c = 0; c < 2; c++) {
            // Pushed light stays where it lands (no pull back to the start).
            const next = disp[k + c] * (1 - SPREAD) + blurInto(disp, k, i, j, c) * SPREAD + vel[k + c]
            tmp[k + c] = Math.max(-LIMIT, Math.min(LIMIT, next))
            peak = Math.max(peak, Math.abs(vel[k + c]))
          }
        }
      }
      disp.set(tmp)
      // Once the push has stopped travelling, rest until the mouse moves again.
      if (peak < 1e-5) {
        vel.fill(0)
        awake = false
      }
    }

    let last: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX + BLEED) / (window.innerWidth + BLEED * 2)
      const y = 1 - (e.clientY + BLEED) / (window.innerHeight + BLEED * 2)
      if (last) {
        const dx = x - last.x
        const dy = y - last.y
        const aspect = fieldAspect()
        const steps = Math.max(1, Math.ceil(Math.hypot(dx * aspect, dy) / (RADIUS * 0.5)))
        for (let s = 1; s <= steps; s++) {
          splat(last.x + (dx * s) / steps, last.y + (dy * s) / steps, dx / steps, dy / steps)
        }
      }
      last = { x, y }
    }
    const onLeave = (e: PointerEvent) => {
      if (!e.relatedTarget) last = null
    }

    let raf = 0
    let prev = 0
    const frame = (now: number) => {
      if (awake) {
        step()
        upload()
      }
      updateMask()
      // A long gap (e.g. a background tab) counts as a short one, so the
      // memory doesn't jump.
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000))
      prev = now
      render(now / 1000, Math.min(1, (now - start) / FADE_IN_MS), dt)
      raf = requestAnimationFrame(frame)
    }

    const start = performance.now()
    prev = start
    updateMask()
    render(start / 1000, 0, 0)
    raf = requestAnimationFrame(frame)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerout', onLeave)
    window.addEventListener('resize', resize)
    return () => {
      disposed = true
      cleanupObservers()
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="bg" aria-hidden="true" />
}

export default Background
