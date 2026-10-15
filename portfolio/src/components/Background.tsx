import { useEffect, useRef } from 'react'

// Full-screen WebGL background: flowing green light over a dark base. The
// pattern drifts on its own (warped noise over time), and moving the mouse
// pushes it around like stirring water. The push lives in a small grid of
// offsets: pushed light keeps travelling for a moment, then stays where it lands.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uFade;
uniform sampler2D uDisp;
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

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
  return smoothstep(0.32, 0.76, fbm(p + 1.4 * r));
}

void main() {
  vec2 uv = vUv - texture(uDisp, vUv).rg;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.4;
  float t = uTime * 0.09;
  float light = pattern(p, t);

  // Keep the screen balanced: look at the area around this point. Deep inside
  // a large dark region a soft light blob grows; a region that's lit almost
  // everywhere fades down.
  float around = light;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    around += pattern(p + vec2(cos(a), sin(a)) * 0.45, t);
  }
  around /= 9.0;
  float tooDark = 1.0 - smoothstep(0.02, 0.13, around);
  float tooLight = smoothstep(0.45, 0.7, around);
  light = max(light, tooDark * 0.75);
  light *= 1.0 - tooLight * 0.5;

  vec3 base = vec3(0.051, 0.071, 0.063);
  vec3 green = vec3(0.12, 0.25, 0.19);
  vec3 col = mix(base, green, light);
  col += vec3(0.02, 0.05, 0.04) * smoothstep(0.6, 1.0, light);
  // Starts fully black and fades in after the page loads.
  outColor = vec4(col * uFade, 1.0);
}`

const GRID_W = 64
const GRID_H = 40
const RADIUS = 0.14 // size of the mouse's push, as a fraction of screen height
const GLIDE = 0.975 // how long pushed light keeps travelling after the mouse stops
const PUSH = 1.5 * (1 - GLIDE) // total travel is about 1.5x the mouse's movement
const SPREAD = 0.01 // how much a push slowly spreads into its surroundings
const LIMIT = 6 // cap on how far any spot can be pushed in total
const RENDER_SCALE = 0.25 // the canvas is heavily blurred, so render it small
const BLUR = 64 // px
// The canvas extends past each screen edge so the blur doesn't darken the borders.
const BLEED = Math.round(BLUR * 2.5)
const FADE_IN_MS = 4000 // black at first, then the green fades in over this long

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

function createProgram(gl: WebGL2RenderingContext) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
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
    const program = gl && createProgram(gl)
    if (!gl || !program) {
      canvas.classList.add('bg-fallback')
      return
    }

    gl.useProgram(program)

    // One triangle that covers the whole screen.
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(program, 'uRes')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uFade = gl.getUniformLocation(program, 'uFade')
    gl.uniform1i(gl.getUniformLocation(program, 'uDisp'), 0)

    // Mouse push: velocity and offset per grid cell (x, y pairs, GL coords).
    const size = GRID_W * GRID_H * 2
    const vel = new Float32Array(size)
    const disp = new Float32Array(size)
    const tmp = new Float32Array(size)

    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, GRID_W, GRID_H, 0, gl.RG, gl.FLOAT, disp)
    const upload = () =>
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID_W, GRID_H, gl.RG, gl.FLOAT, disp)

    const draw = (seconds: number, fade: number) => {
      gl.uniform1f(uTime, seconds)
      gl.uniform1f(uFade, fade)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const resize = () => {
      canvas.width = Math.max(1, Math.round((window.innerWidth + BLEED * 2) * RENDER_SCALE))
      canvas.height = Math.max(1, Math.round((window.innerHeight + BLEED * 2) * RENDER_SCALE))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()

    // Visitors who ask for reduced motion get one still frame.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(20, 1)
      const onResizeStill = () => {
        resize()
        draw(20, 1)
      }
      window.addEventListener('resize', onResizeStill)
      return () => window.removeEventListener('resize', onResizeStill)
    }

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
    const frame = (now: number) => {
      if (awake) {
        step()
        upload()
      }
      const progress = Math.min(1, (now - start) / FADE_IN_MS)
      draw(now / 1000, progress * progress * (3 - 2 * progress))
      raf = requestAnimationFrame(frame)
    }

    const start = performance.now()
    draw(start / 1000, 0)
    raf = requestAnimationFrame(frame)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerout', onLeave)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="bg"
      aria-hidden="true"
      style={{
        top: -BLEED,
        left: -BLEED,
        width: `calc(100% + ${BLEED * 2}px)`,
        height: `calc(100% + ${BLEED * 2}px)`,
        filter: `blur(${BLUR}px)`,
      }}
    />
  )
}

export default Background
