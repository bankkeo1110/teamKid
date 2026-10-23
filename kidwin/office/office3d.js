// KID Office 3D — the same live team, drawn as a real IT office with Three.js.
// Loaded on demand by index.html (2D/3D switch). Reads state through window.KID; draws only.
import * as THREE from './vendor/three.module.min.js'
import { OrbitControls } from './vendor/OrbitControls.js'
import { RoomEnvironment } from './vendor/RoomEnvironment.js'

const TAU = Math.PI * 2
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const lerp = (a, b, k) => a + (b - a) * k

// ---------------------------------------------------------------- materials
const M = {}
function mat(key, opts) { return M[key] || (M[key] = new THREE.MeshStandardMaterial(opts)) }
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d'); draw(g, w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat) }
  t.userData = { canvas: c, ctx: g }
  return t
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
const cyl = (rt, rb, h, m, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m)
function shadowy(o) { o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true } }); return o }

// ---------------------------------------------------------------- textures
function floorTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#C79A6B'; g.fillRect(0, 0, w, h)
    const ph = 64
    for (let y = 0; y < h; y += ph) {
      let x = -((y / ph) % 3) * 140
      while (x < w) {
        const len = 260 + ((x * 7 + y * 3) % 160)
        const tone = 190 + ((x + y * 3) % 30)
        g.fillStyle = `rgb(${tone + 10},${tone - 40},${tone - 95})`
        g.fillRect(x + 2, y + 2, len - 4, ph - 4)
        g.strokeStyle = 'rgba(90,55,30,.08)'
        for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x + 6, y + 8 + k * 9); g.bezierCurveTo(x + len / 3, y + 4 + k * 9, x + len / 2, y + 14 + k * 9, x + len - 6, y + 8 + k * 9); g.stroke() }
        x += len
      }
    }
  }, { repeat: [3, 2] })
}
function rugTexture(c1, c2) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h)
    g.strokeStyle = c2; g.lineWidth = 10; g.strokeRect(16, 16, w - 32, h - 32)
    g.lineWidth = 2; g.strokeRect(34, 34, w - 68, h - 68)
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .04})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) }
  })
}
function skyTexture() {
  return canvasTex(2048, 512, (g, w, h) => paintSky(g, w, h))
}
function paintSky(g, w, h) {
  const hr = new Date().getHours() + new Date().getMinutes() / 60
  const night = hr < 5.5 || hr >= 19, dusk = hr >= 17 && hr < 19, dawn = hr >= 5.5 && hr < 7
  const grad = g.createLinearGradient(0, 0, 0, h)
  if (night) { grad.addColorStop(0, '#0B1430'); grad.addColorStop(1, '#22305C') }
  else if (dusk || dawn) { grad.addColorStop(0, '#3D4F8A'); grad.addColorStop(.55, '#F08A5D'); grad.addColorStop(1, '#F9C784') }
  else { grad.addColorStop(0, '#5DA9E9'); grad.addColorStop(1, '#CBE7FA') }
  g.fillStyle = grad; g.fillRect(0, 0, w, h)
  if (night) { g.fillStyle = '#fff'; for (let i = 0; i < 160; i++) g.fillRect((i * 733) % w, (i * 197) % (h * .55), 2, 2); g.fillStyle = '#F7EBC0'; g.beginPath(); g.arc(w * .82, h * .18, 26, 0, TAU); g.fill() }
  else if (!dusk) { g.fillStyle = 'rgba(255,255,255,.9)'; for (const [x, y, s] of [[260, 90, 1], [900, 60, 1.4], [1500, 110, 1.1]]) { g.beginPath(); g.ellipse(x, y, 90 * s, 24 * s, 0, 0, TAU); g.ellipse(x + 50 * s, y - 16 * s, 60 * s, 24 * s, 0, 0, TAU); g.fill() } }
  // sea + far mountains
  g.fillStyle = night ? '#18244A' : '#6C8FB0'; g.beginPath(); g.moveTo(0, h * .62)
  for (let x = 0; x <= w; x += 40) g.lineTo(x, h * .62 - Math.abs(Math.sin(x / 260)) * 60 - (x > w * .6 ? 40 : 0)); g.lineTo(w, h); g.lineTo(0, h); g.fill()
  g.fillStyle = night ? '#132042' : '#4E86B5'; g.fillRect(0, h * .74, w, h * .26)
  // river bridge with arch
  g.strokeStyle = night ? '#F7C25C' : '#E7B53C'; g.lineWidth = 6
  g.beginPath(); g.moveTo(w * .25, h * .73); g.lineTo(w * .62, h * .73); g.stroke()
  g.lineWidth = 4; for (let k = 0; k < 4; k++) { const x0 = w * .27 + k * w * .085; g.beginPath(); g.moveTo(x0, h * .73); g.quadraticCurveTo(x0 + w * .042, h * .64 - (k % 2) * 14, x0 + w * .085, h * .73); g.stroke() }
  // skyline
  let x = 0, i = 0
  while (x < w) {
    const bw = 50 + ((i * 37) % 70), bh = 70 + ((i * 53) % 180)
    g.fillStyle = night ? '#0E1630' : ['#7D8FA6', '#8C9DB3', '#6F8199'][i % 3]
    g.fillRect(x, h * .74 - bh, bw, bh)
    g.fillStyle = night ? 'rgba(255,214,120,.85)' : 'rgba(255,255,255,.35)'
    for (let yy = h * .74 - bh + 10; yy < h * .74 - 10; yy += 18) for (let xx = x + 8; xx < x + bw - 8; xx += 14) if (((xx + yy + i) * 13) % 7 < (night ? 3 : 5)) g.fillRect(xx, yy, 6, 8)
    x += bw + 6 + ((i * 11) % 30); i++
  }
}
function logoTexture() {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#1F2638'; g.fillRect(0, 0, w, h)
    g.fillStyle = '#2A9D8F'; g.fillRect(70, 70, 116, 116)
    g.fillStyle = '#FFD45C'; g.fillRect(100, 100, 56, 56)
    g.fillStyle = '#F2F5F9'; g.font = '700 120px "Be Vietnam Pro", system-ui, sans-serif'; g.textBaseline = 'middle'
    g.fillText('Team KID', 230, h / 2 + 6)
  })
}

// screens: one animated "code" texture shared by every working screen
function makeCodeScreen() {
  const tex = canvasTex(320, 200, () => {})
  const g = tex.userData.ctx
  const lines = Array.from({ length: 40 }, (_, i) => ({ indent: (i * 7) % 5, segs: Array.from({ length: 1 + (i * 3) % 4 }, (_, k) => ({ w: 18 + ((i * 13 + k * 29) % 70), c: ['#7FE3D2', '#FFD45C', '#B39CEB', '#F2F5F9', '#F28B82'][(i + k) % 5] })) }))
  let off = 0
  tex.userData.tick = () => {
    off = (off + 1) % (lines.length * 12)
    g.fillStyle = '#121826'; g.fillRect(0, 0, 320, 200)
    g.fillStyle = '#1B2336'; g.fillRect(0, 0, 320, 16)
    for (let k = 0; k < 3; k++) { g.fillStyle = ['#E5675A', '#FFD45C', '#58C4B4'][k]; g.fillRect(8 + k * 12, 5, 7, 7) }
    for (let r = 0; r < 16; r++) {
      const L = lines[(Math.floor(off / 12) + r) % lines.length]
      let x = 14 + L.indent * 14
      for (const s of L.segs) { g.fillStyle = s.c; g.fillRect(x, 24 + r * 11, s.w, 5); x += s.w + 8 }
    }
    tex.needsUpdate = true
  }
  tex.userData.tick()
  return tex
}
function solidScreen(bg, fg, text) {
  return canvasTex(320, 200, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h)
    if (text) { g.fillStyle = fg; g.font = '700 110px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4) }
  })
}

// ---------------------------------------------------------------- people
const LOOKS = {
  kid: { skin: '#F1C29A', hair: '#2B2420', shirt: '#2A9D8F', pants: '#2C3140', hat: '#E5675A', acc: 'cap' },
  shaper: { skin: '#E8B48C', hair: '#6B3F26', shirt: '#7B5EA7', pants: '#3A3346', acc: 'glasses', long: true },
  qa: { skin: '#F3CBA5', hair: '#B5523B', shirt: '#8A9099', pants: '#2F3A4A', acc: 'vest' },
}
const DEV_LOOKS = [
  { skin: '#F0C7A0', hair: '#1F1B18', shirt: '#3D7DD8', pants: '#2C3140' },
  { skin: '#C99272', hair: '#3A2A1E', shirt: '#E39B3B', pants: '#3B3A3F', long: true },
  { skin: '#F4D1B0', hair: '#C9A04A', shirt: '#5DAA62', pants: '#2C3140' },
  { skin: '#A8735A', hair: '#141210', shirt: '#D66BA0', pants: '#2E2B3B', long: true },
  { skin: '#EBC3A2', hair: '#7A4B2C', shirt: '#7E8794', pants: '#24272F' },
  { skin: '#D9A684', hair: '#2E2E38', shirt: '#4FB3C9', pants: '#2C3140' },
]
function makePerson(L) {
  const S = c => new THREE.MeshStandardMaterial({ color: c, roughness: .75 })
  const skin = S(L.skin), hair = S(L.hair), shirt = S(L.shirt), pants = S(L.pants || '#2C3140'), shoe = S('#1A1C22')
  const root = new THREE.Group()
  const body = new THREE.Group(); root.add(body)
  const limb = (r, len, m) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m); c.position.y = -(len / 2 + r); g.add(c); return g }
  // legs
  const legL = limb(.085, .42, pants), legR = limb(.085, .42, pants)
  legL.position.set(-.1, .92, 0); legR.position.set(.1, .92, 0)
  for (const l of [legL, legR]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.13, .08, .22), shoe); s.position.set(0, -.62, .04); l.add(s) }
  body.add(legL, legR)
  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .34, 6, 14), shirt); torso.position.y = 1.2; torso.scale.set(1, 1, .72); body.add(torso)
  if (L.acc === 'vest') { const v = new THREE.Mesh(new THREE.CapsuleGeometry(.205, .24, 6, 14), S('#F2C14E')); v.position.y = 1.22; v.scale.set(1.02, 1, .76); body.add(v); const st = box(.42, .03, .32, S('#E8E2C8')); st.position.y = 1.18; body.add(st) }
  if (L.acc === 'cap') { const s1 = box(.02, .14, .02, S('#EAF6F3')); s1.position.set(-.05, 1.3, .15); const s2 = s1.clone(); s2.position.x = .05; body.add(s1, s2) }
  // arms
  const armL = limb(.065, .36, shirt), armR = limb(.065, .36, shirt)
  armL.position.set(-.27, 1.42, 0); armR.position.set(.27, 1.42, 0)
  for (const a of [armL, armR]) { const hnd = new THREE.Mesh(new THREE.SphereGeometry(.065, 10, 8), skin); hnd.position.y = -.58; a.add(hnd) }
  body.add(armL, armR)
  // head
  const head = new THREE.Group(); head.position.y = 1.64; body.add(head)
  const face = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 16), skin); head.add(face)
  const neck = cyl(.06, .07, .12, skin); neck.position.y = -.17; head.add(neck)
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.178, 20, 12, 0, TAU, 0, Math.PI * .5), hair); hairCap.position.y = .02; hairCap.rotation.x = .32; head.add(hairCap)
  if (L.long) { const back = new THREE.Mesh(new THREE.CapsuleGeometry(.15, .16, 4, 12), hair); back.position.set(0, -.1, -.08); back.scale.set(1.05, 1, .6); head.add(back) }
  const eyeM = S('#15161C')
  for (const x of [-.06, .06]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.026, 10, 8), eyeM); e.position.set(x, .0, .155); head.add(e) }
  const blush = S('#F2A08A'); for (const x of [-.1, .1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), blush); b.position.set(x, -.05, .135); b.scale.z = .3; head.add(b) }
  const mouth = box(.06, .014, .01, S('#9E4F45')); mouth.position.set(0, -.075, .16); head.add(mouth)
  if (L.acc === 'cap') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.185, 20, 10, 0, TAU, 0, Math.PI * .5), S(L.hat)); cap.position.y = .05; cap.rotation.x = .35; head.add(cap)
    const brim = box(.24, .02, .1, S('#B94C40')); brim.position.set(0, .13, .17); brim.rotation.x = -.15; head.add(brim)
  }
  if (L.acc === 'glasses') {
    const gm = S('#202128')
    for (const x of [-.065, .065]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.04, .009, 6, 16), gm); r.position.set(x, .02, .165); head.add(r) }
    const br = box(.05, .01, .01, gm); br.position.set(0, .025, .17); head.add(br)
  }
  if (L.acc === 'phones') {
    const pm = S('#22252F')
    const band = new THREE.Mesh(new THREE.TorusGeometry(.19, .018, 6, 20, Math.PI), pm); band.position.y = .02; head.add(band)
    for (const x of [-.18, .18]) { const cup = cyl(.06, .06, .05, pm); cup.rotation.z = Math.PI / 2; cup.position.set(x, -.01, 0); head.add(cup) }
  }
  shadowy(root)
  return { root, body, legL, legR, armL, armR, head }
}
function pose(P, kind, t, k = 0) {
  if (kind === 'sit') {
    P.body.position.y = -.43
    P.legL.rotation.x = P.legR.rotation.x = -Math.PI / 2
    for (const l of [P.legL, P.legR]) { l.children[0].position.y = -(.42 / 2 + .085) }
    const typ = k ? Math.sin(t * 18) * .08 : 0
    P.armL.rotation.x = -1.15 + typ; P.armR.rotation.x = -1.15 - typ
    P.armL.rotation.z = .12; P.armR.rotation.z = -.12
    P.head.rotation.x = k ? .08 + Math.sin(t * 2) * .03 : -.05 + Math.sin(t * .8) * .04
    P.head.rotation.z = k ? 0 : Math.sin(t * .6) * .06
  } else if (kind === 'walk') {
    P.body.position.y = Math.abs(Math.sin(t * 9)) * .03
    const s = Math.sin(t * 9) * .55
    P.legL.rotation.x = s; P.legR.rotation.x = -s
    P.armL.rotation.x = -s * .8; P.armR.rotation.x = s * .8
    P.armL.rotation.z = P.armR.rotation.z = 0
    P.head.rotation.set(0, 0, 0)
  } else {
    P.body.position.y = 0
    P.legL.rotation.x = P.legR.rotation.x = 0
    P.armL.rotation.x = P.armR.rotation.x = 0; P.armL.rotation.z = .06; P.armR.rotation.z = -.06
  }
}

// ---------------------------------------------------------------- furniture
function chair(color = '#2D3242') {
  const g = new THREE.Group(), m = mat('chair' + color, { color, roughness: .6 }), metal = mat('metal', { color: '#9AA3AD', metalness: .8, roughness: .3 })
  const seat = box(.5, .08, .48, m); seat.position.y = .5; g.add(seat)
  const back = box(.48, .55, .07, m); back.position.set(0, .82, -.24); back.rotation.x = -.08; g.add(back)
  const post = cyl(.03, .03, .4, metal); post.position.y = .28; g.add(post)
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const leg = box(.04, .03, .32, metal); leg.position.set(Math.sin(a) * .15, .06, Math.cos(a) * .15); leg.rotation.y = a; g.add(leg) }
  return shadowy(g)
}
function laptop(screenMat) {
  const g = new THREE.Group(), al = mat('alu', { color: '#C8CDD4', metalness: .7, roughness: .35 })
  const base = box(.36, .02, .25, al); base.position.y = .01; g.add(base)
  const lid = new THREE.Group(); lid.position.set(0, .02, .12); lid.rotation.x = -.28
  const shell = box(.36, .24, .015, al); shell.position.y = .12; lid.add(shell)
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.33, .21), screenMat); scr.position.set(0, .12, -.009); scr.rotation.y = Math.PI; lid.add(scr)
  g.add(lid); g.userData.screen = scr
  return shadowy(g)
}
function monitor(screenMat, w = .62) {
  const g = new THREE.Group(), dark = mat('dark', { color: '#1C1F28', roughness: .4, metalness: .3 })
  const stand = cyl(.03, .03, .32, dark); stand.position.y = .16; g.add(stand)
  const foot = box(.22, .015, .16, dark); foot.position.y = .008; g.add(foot)
  const frame = box(w, w * .58, .03, dark); frame.position.y = .32 + w * .29; g.add(frame)
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w - .03, w * .58 - .03), screenMat); scr.position.set(0, .32 + w * .29, .016); g.add(scr)
  g.userData.screen = scr
  return shadowy(g)
}
function desk(w = 1.4, d = .72, top = '#E9E4DA') {
  const g = new THREE.Group(), m = mat('desk' + top, { color: top, roughness: .55 }), legM = mat('deskleg', { color: '#2E323C', metalness: .5, roughness: .4 })
  const t = box(w, .04, d, m); t.position.y = .74; g.add(t)
  for (const x of [-w / 2 + .05, w / 2 - .05]) { const l = box(.05, .72, d - .08, legM); l.position.set(x, .36, 0); g.add(l) }
  return shadowy(g)
}
function plant(scale = 1) {
  const g = new THREE.Group()
  const pot = cyl(.2, .15, .38, mat('pot', { color: '#D9D3C7', roughness: .8 })); pot.position.y = .19; g.add(pot)
  const leafM = mat('leaf', { color: '#3E8A4F', roughness: .7 }), leafM2 = mat('leaf2', { color: '#5BAA62', roughness: .7 })
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.16 + (i % 3) * .03, 10, 8), i % 2 ? leafM : leafM2); const a = i / 9 * TAU; l.position.set(Math.cos(a) * .14, .5 + (i % 4) * .14, Math.sin(a) * .14); l.scale.y = 1.4; g.add(l) }
  g.scale.setScalar(scale)
  return shadowy(g)
}
function sofa() {
  const g = new THREE.Group(), m = mat('sofa', { color: '#3F5A7A', roughness: .9 }), cush = mat('cush', { color: '#FFD45C', roughness: .9 })
  const base = box(2.2, .42, .9, m); base.position.y = .21; g.add(base)
  const back = box(2.2, .5, .22, m); back.position.set(0, .6, -.34); g.add(back)
  for (const x of [-1.05, 1.05]) { const arm = box(.2, .32, .9, m); arm.position.set(x, .5, 0); g.add(arm) }
  const c1 = box(.4, .32, .12, cush); c1.position.set(-.6, .62, -.18); c1.rotation.x = -.2; g.add(c1)
  return shadowy(g)
}

// ---------------------------------------------------------------- scene
const SEATS = {
  kid: { x: 0, z: .6, rot: 0, kind: 'kid' },
  shaper: { x: -6.6, z: -3.2, rot: Math.PI / 2, kind: 'shaper' },
  qa: { x: -6.6, z: 1.8, rot: Math.PI / 2, kind: 'qa' },
  dev: [
    { x: 4.4, z: -3.0, rot: Math.PI / 2 }, { x: 7.6, z: -3.0, rot: -Math.PI / 2 },
    { x: 4.4, z: -1.2, rot: Math.PI / 2 }, { x: 7.6, z: -1.2, rot: -Math.PI / 2 },
    { x: 4.4, z: .6, rot: Math.PI / 2 }, { x: 7.6, z: .6, rot: -Math.PI / 2 },
  ],
}
const DOOR = new THREE.Vector3(-11.4, 0, 4.6)
const AISLE_Z = 4.4

export function mount(wrap, KID) {
  const test = document.createElement('canvas')
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('webgl')

  const host = document.createElement('div'); host.className = 'office3d'
  host.style.cssText = 'position:relative;width:100%;aspect-ratio:' + (innerWidth < 560 ? '1/1' : '16/10') + ';'
  wrap.prepend(host)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;'
  renderer.domElement.setAttribute('aria-label', 'Văn phòng 3D của team')
  host.appendChild(renderer.domElement)
  const tags = document.createElement('div'); tags.className = 'overlay'; host.appendChild(tags)
  const hud = document.createElement('div'); hud.className = 'hud3d'
  hud.innerHTML = '<button type="button" data-cam="overview">Toàn cảnh</button><button type="button" data-cam="kid">Bàn KID</button><button type="button" data-cam="dev">Khu Developer</button>'
  host.appendChild(hud)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#D9E2DD')
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture
  scene.environmentIntensity = .55

  const camera = new THREE.PerspectiveCamera(38, 16 / 10, .1, 200)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true; controls.dampingFactor = .08
  controls.minDistance = 5; controls.maxDistance = 34
  controls.minPolarAngle = .25; controls.maxPolarAngle = 1.32
  controls.target.set(0, .6, -.4)
  camera.position.set(1.5, 15, 19.5)
  const CAMS = {
    overview: { pos: [1.5, 15, 19.5], tgt: [0, .6, -.6] },
    kid: { pos: [.6, 2.3, 4.4], tgt: [0, 1.15, .6] },
    dev: { pos: [10.8, 5.2, 3.8], tgt: [6, .9, -1.2] },
  }
  let camAnim = null
  function flyTo(pos, tgt) {
    if (reduceMotion) { camera.position.set(...pos); controls.target.set(...tgt); return }
    camAnim = { p0: camera.position.clone(), t0v: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...tgt), s: performance.now(), d: 1100 }
  }
  hud.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { const c = CAMS[b.dataset.cam]; flyTo(c.pos, c.tgt) } })

  // lights
  const hemi = new THREE.HemisphereLight('#F4F7FF', '#8A6B4E', .65); scene.add(hemi)
  const sun = new THREE.DirectionalLight('#FFF4E0', 1.6)
  sun.position.set(-8, 16, 10); sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02
  scene.add(sun)
  function applyTimeOfDay() {
    const hr = new Date().getHours() + new Date().getMinutes() / 60
    const night = hr < 5.5 || hr >= 19, dusk = (hr >= 17 && hr < 19) || (hr >= 5.5 && hr < 7)
    sun.color.set(night ? '#AFC3FF' : dusk ? '#FFB27A' : '#FFF4E0')
    sun.intensity = night ? .45 : dusk ? 1.1 : 1.6
    hemi.intensity = night ? .35 : .65
    scene.background.set(night ? '#1D2333' : '#D9E2DD')
    lamps.forEach(l => { l.intensity = night ? 2.2 : .6 })
  }

  // floor + walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 15), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: .55 }))
  floor.rotation.x = -Math.PI / 2; floor.position.z = -.5; floor.receiveShadow = true; scene.add(floor)
  const base = box(24.4, .3, 15.4, mat('plinth', { color: '#3A3F4B', roughness: .8 })); base.position.set(0, -.16, -.5); scene.add(base)
  const wallM = mat('wall', { color: '#EEF0EC', roughness: .9 }), accentM = mat('accentWall', { color: '#34405E', roughness: .85 })
  const backWall = box(24, 4.2, .25, wallM); backWall.position.set(0, 2.1, -8); backWall.receiveShadow = true; scene.add(backWall)
  const leftWall = box(.25, 4.2, 15, wallM); leftWall.position.set(-12, 2.1, -.5); leftWall.receiveShadow = true; scene.add(leftWall)
  const accent = box(6, 4.2, .05, accentM); accent.position.set(-8.5, 2.1, -7.86); scene.add(accent)
  // windows on the back wall (right half) with the city outside
  const skyTex = skyTexture()
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.6), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }))
  sky.position.set(5.2, 2.2, -7.86); scene.add(sky)
  const mull = mat('mullion', { color: '#2B303B', metalness: .6, roughness: .4 })
  for (let i = 0; i <= 6; i++) { const m = box(.08, 2.7, .1, mull); m.position.set(-1.3 + i * 13 / 6, 2.2, -7.82); scene.add(m) }
  for (const y of [.85, 3.55]) { const m = box(13.1, .08, .1, mull); m.position.set(5.2, y, -7.82); scene.add(m) }
  // brand wall
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: logoTexture(), toneMapped: false }))
  logo.position.set(-8.5, 2.9, -7.8); scene.add(logo)
  // door
  const doorFrame = box(.12, 2.4, 1.5, mat('doorframe', { color: '#2B303B', metalness: .5 })); doorFrame.position.set(-11.85, 1.2, DOOR.z); scene.add(doorFrame)
  const glass = new THREE.MeshPhysicalMaterial({ color: '#BFE3F2', transmission: .7, transparent: true, opacity: .45, roughness: .05, thickness: .02 })
  const doorGlass = box(.04, 2.2, 1.3, glass); doorGlass.position.set(-11.8, 1.15, DOOR.z); scene.add(doorGlass)
  const mat1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), mat('doormat', { color: '#3A3F4B', roughness: 1 })); mat1.rotation.x = -Math.PI / 2; mat1.position.set(-11.1, .005, DOOR.z); scene.add(mat1)

  // big Scrum screen on the back wall
  const boardTex = canvasTex(1600, 720, () => {})
  const boardScreen = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.88), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }))
  boardScreen.position.set(-2.4, 2.25, -7.82)
  const bezel = box(6.6, 3.06, .08, mat('dark', { color: '#1C1F28', roughness: .4, metalness: .3 })); bezel.position.set(-2.4, 2.25, -7.88)
  scene.add(bezel, boardScreen)
  let boardSig = ''
  function paintBoard() {
    const S = KID.state(); const sig = JSON.stringify((S.board || []).map(t => [t.ticket, t.col, t.owner]))
    if (sig === boardSig) return; boardSig = sig
    const g = boardTex.userData.ctx, W = 1600, H = 720
    g.fillStyle = '#16202E'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#F2F5F9'; g.font = '700 46px "Be Vietnam Pro", system-ui, sans-serif'; g.textBaseline = 'top'
    const ms = (S.board || []).map(t => t.milestone).filter(Boolean)
    g.fillText(ms.length ? `Bảng Scrum: ${ms[0]}` : 'Bảng Scrum', 40, 28)
    const cols = [['backlog', 'Backlog', '#E3E1DA'], ['ready', 'Sẵn sàng', '#FFD45C'], ['doing', 'Đang làm', '#8FD6CB'], ['review', 'Review & QA', '#C9B8F2'], ['done', 'Xong', '#A9E2BC']]
    const cw = (W - 80) / 5
    cols.forEach(([k, name, c], i) => {
      const x = 40 + i * cw, items = (S.board || []).filter(t => t.col === k)
      g.fillStyle = '#22304A'; g.fillRect(x + 6, 100, cw - 12, H - 130)
      g.fillStyle = '#C8D2E0'; g.font = '600 30px "Be Vietnam Pro", system-ui, sans-serif'; g.fillText(`${name} (${items.length})`, x + 20, 116)
      items.slice(0, 6).forEach((t, j) => {
        const y = 166 + j * 88
        g.fillStyle = c; g.fillRect(x + 18, y, cw - 36, 76)
        g.fillStyle = '#1E2230'; g.font = '700 24px "Be Vietnam Pro", system-ui, sans-serif'; g.fillText(t.ticket, x + 30, y + 8)
        g.font = '400 22px "Be Vietnam Pro", system-ui, sans-serif'
        let title = t.title; while (g.measureText(title).width > cw - 64 && title.length > 4) title = title.slice(0, -2)
        g.fillText(title === t.title ? title : title + '…', x + 30, y + 40)
        if (t.owner) { g.fillStyle = '#E5675A'; g.beginPath(); g.arc(x + cw - 34, y + 20, 9, 0, TAU); g.fill() }
      })
      if (items.length > 6) { g.fillStyle = '#C8D2E0'; g.font = '400 22px system-ui'; g.fillText(`+${items.length - 6} nữa`, x + 24, 166 + 6 * 88) }
    })
    boardTex.needsUpdate = true
  }

  // zones: rugs
  const rug = (w, d, x, z, c1, c2) => { const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: rugTexture(c1, c2), roughness: 1 })); r.rotation.x = -Math.PI / 2; r.position.set(x, .006, z); r.receiveShadow = true; scene.add(r) }
  rug(4.6, 3.6, 0, .9, '#4E6F68', '#86A89E')
  rug(3.4, 7, 6, -1.2, '#3C4660', '#5D6A8C')
  rug(3.2, 6.8, -6.3, -.7, '#6A5A7E', '#9A88B2')

  // meeting room (glass, back right)
  const mr = new THREE.Group()
  const mrGlass = new THREE.MeshPhysicalMaterial({ color: '#D7EEF5', transmission: .85, transparent: true, opacity: .28, roughness: .02, thickness: .02, side: THREE.DoubleSide })
  const g1 = box(.04, 2.6, 3.4, mrGlass); g1.position.set(8.4, 1.3, -6.1)
  const g2 = box(3.6, 2.6, .04, mrGlass); g2.position.set(10.2, 1.3, -4.4)
  const fr = (w, h, d, x, y, z) => { const b = box(w, h, d, mull); b.position.set(x, y, z); mr.add(b) }
  fr(.06, .06, 3.4, 8.4, 2.6, -6.1); fr(3.6, .06, .06, 10.2, 2.6, -4.4); fr(.06, 2.6, .06, 8.4, 1.3, -4.4)
  mr.add(g1, g2)
  const mt = desk(2, 1, '#F4F1EA'); mt.position.set(10.2, 0, -6.2); mr.add(mt)
  for (const [x, z, r] of [[9.4, -5.4, Math.PI], [11, -5.4, Math.PI], [9.4, -7, 0], [11, -7, 0]]) { const c = chair('#5D6A8C'); c.position.set(x, 0, z); c.rotation.y = r; mr.add(c) }
  const tv = monitor(new THREE.MeshBasicMaterial({ map: solidScreen('#1F2638', '#2A9D8F', 'KID'), toneMapped: false }), 1.1); tv.position.set(12.2, .3, -6.2); tv.rotation.y = -Math.PI / 2; mr.add(tv)
  scene.add(mr)
  const mrSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .32), new THREE.MeshBasicMaterial({ map: canvasTex(512, 100, (g, w, h) => { g.fillStyle = '#1F2638'; g.fillRect(0, 0, w, h); g.fillStyle = '#F2F5F9'; g.font = '600 52px "Be Vietnam Pro", system-ui'; g.textBaseline = 'middle'; g.fillText('Phòng họp Sprint', 22, h / 2 + 2) }), toneMapped: false }))
  mrSign.position.set(10.2, 2.35, -4.37); scene.add(mrSign)

  // lounge (front right) + coffee bar (back left)
  const sf = sofa(); sf.position.set(9.3, 0, 5.5); sf.rotation.y = Math.PI; scene.add(sf)
  const ct = cyl(.5, .5, .06, mat('ctable', { color: '#E9E4DA' })); ct.position.set(9.3, .42, 4.3); const ctl = cyl(.05, .05, .4, mat('deskleg', { color: '#2E323C', metalness: .5, roughness: .4 })); ctl.position.set(9.3, .2, 4.3); scene.add(shadowy(ct), ctl)
  const bar = box(3, .95, .7, mat('bar', { color: '#3A3F4B', roughness: .6 })); bar.position.set(-9.8, .48, -6.9); scene.add(shadowy(bar))
  const barTop = box(3.1, .05, .78, mat('bartop', { color: '#E9E4DA' })); barTop.position.set(-9.8, .98, -6.9); scene.add(barTop)
  const coffee = box(.45, .55, .4, mat('coffee', { color: '#B8BEC8', metalness: .7, roughness: .3 })); coffee.position.set(-10.6, 1.28, -7); scene.add(shadowy(coffee))
  for (const [x, z, s] of [[-11.2, -2.5, 1.2], [11.4, 1.8, 1.1], [-1.9, -7.3, .9], [3.1, 6.2, 1], [-11.3, 6.6, 1]]) { const p = plant(s); p.position.set(x, 0, z); scene.add(p) }
  // PO whiteboard on the left wall
  const wb = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshStandardMaterial({ map: canvasTex(600, 300, (g, w, h) => {
    g.fillStyle = '#F8FAF9'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3D7DD8'; g.lineWidth = 4
    g.strokeRect(30, 40, 150, 70); g.strokeRect(240, 40, 150, 70); g.strokeRect(440, 150, 130, 70)
    g.beginPath(); g.moveTo(180, 75); g.lineTo(240, 75); g.moveTo(390, 75); g.lineTo(500, 150); g.stroke()
    for (const [x, y, c] of [[40, 160, '#FFD45C'], [120, 175, '#9ED9B3'], [200, 160, '#F28B82'], [280, 180, '#B39CEB']]) { g.fillStyle = c; g.fillRect(x, y, 64, 64) }
    g.fillStyle = '#1E2230'; g.font = '600 26px system-ui'; g.fillText('User story', 40, 30)
  }), roughness: .4 }))
  wb.position.set(-11.85, 1.9, -2.6); wb.rotation.y = Math.PI / 2; scene.add(wb)
  // dev pod divider
  const div = box(.05, .5, 5.6, mat('divider', { color: '#5D6A8C', roughness: .9 })); div.position.set(6, 1.0, -1.2); scene.add(div)

  // desk lamps / night lights
  const lamps = []
  for (const [x, z] of [[0, 1.2], [6, -2.2], [6, .2], [-6, -3.2], [-6, 1.8]]) { const l = new THREE.PointLight('#FFE2B0', .6, 6, 1.6); l.position.set(x, 2.6, z); scene.add(l); lamps.push(l) }

  // screens
  const codeTex = makeCodeScreen()
  const scrWork = new THREE.MeshBasicMaterial({ map: codeTex, toneMapped: false })
  const scrBlock = new THREE.MeshBasicMaterial({ map: solidScreen('#5A1E1E', '#FF8C7F', '!'), toneMapped: false })
  const scrIdle = new THREE.MeshBasicMaterial({ map: solidScreen('#1F2638', '#2A9D8F', 'KID'), toneMapped: false })
  const scrOff = new THREE.MeshStandardMaterial({ color: '#0E1016', roughness: .2, metalness: .4 })

  // workstations
  const stations = []
  function station(seat, kind) {
    const g = new THREE.Group(); g.position.set(seat.x, 0, seat.z); g.rotation.y = seat.rot
    const wide = kind === 'kid'
    const d = desk(wide ? 2.2 : 1.4, wide ? .9 : .72, wide ? '#2F3A4F' : '#E9E4DA'); d.position.z = .72; g.add(d)
    const c = chair(kind === 'kid' ? '#E5675A' : '#2D3242'); g.add(c)
    const lap = laptop(scrOff); lap.position.set(0, .76, .58); g.add(lap)
    const mon = monitor(scrOff, wide ? .7 : .58); mon.position.set(wide ? .72 : .42, .76, .82); mon.rotation.y = Math.PI + (wide ? .45 : .35); g.add(mon)
    let mon2 = null
    if (wide) { mon2 = monitor(scrOff, .7); mon2.position.set(-.72, .76, .82); mon2.rotation.y = Math.PI - .45; g.add(mon2) }
    const mug = cyl(.045, .04, .1, mat('mug' + kind, { color: kind === 'kid' ? '#FFD45C' : '#F4F2EC' })); mug.position.set(-.48, .81, .45); g.add(shadowy(mug))
    if (kind === 'qa') { const ph = box(.09, .17, .01, scrOff); ph.position.set(-.35, .88, .75); ph.rotation.x = -.3; g.add(ph); g.userData.phone = ph }
    if (kind === 'shaper') { for (let i = 0; i < 3; i++) { const n = box(.09, .005, .09, mat('note' + i, { color: ['#FFD45C', '#9ED9B3', '#F28B82'][i] })); n.position.set(.5 - i * .12, .765, .4); n.rotation.y = i * .3; g.add(n) } }
    const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .7, 40), new THREE.MeshBasicMaterial({ color: '#FFD45C', transparent: true, opacity: 0 }))
    ring.rotation.x = -Math.PI / 2; ring.position.y = .012; g.add(ring)
    scene.add(g)
    const st = { seat, kind, group: g, screens: [lap.userData.screen, mon.userData.screen, mon2?.userData.screen, g.userData.phone].filter(Boolean), ring, occupant: null }
    stations.push(st); return st
  }
  const KIDST = station(SEATS.kid, 'kid'), POST = station(SEATS.shaper, 'shaper'), QAST = station(SEATS.qa, 'qa')
  const DEVST = SEATS.dev.map(s => station(s, 'dev'))
  const deskLabel = (st, text) => { st.label = text }
  deskLabel(KIDST, 'KID'); deskLabel(POST, 'PO'); deskLabel(QAST, 'QA')

  // ---------------------------------------------------------------- actors
  const actors = new Map()
  const devSlot = new Map()
  const markM = new THREE.MeshBasicMaterial({ color: '#E5675A' })
  function stationFor(a) {
    if (a.role === 'kid') return KIDST
    const free = st => !st.occupant || st.occupant === a.id
    if (a.role === 'shaper' && free(POST)) return POST
    if (a.role === 'qa' && free(QAST)) return QAST
    let i = devSlot.get(a.id)
    if (i === undefined) { i = DEVST.findIndex(free); if (i < 0) i = devSlot.size % DEVST.length; devSlot.set(a.id, i) }
    return DEVST[i]
  }
  function lookFor(a, st) {
    if (a.role === 'builder') return { ...DEV_LOOKS[DEVST.indexOf(st) % DEV_LOOKS.length], acc: 'phones' }
    return LOOKS[a.role] || DEV_LOOKS[0]
  }
  const seatWorld = st => new THREE.Vector3(st.seat.x, 0, st.seat.z)
  const approachPoint = st => { const v = new THREE.Vector3(0, 0, -.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.seat.rot); return seatWorld(st).add(v) }
  let first = true
  function sync() {
    const S = KID.state(), ids = new Set()
    for (const a of S.agents || []) {
      ids.add(a.id)
      let ac = actors.get(a.id)
      if (!ac) {
        const st = stationFor(a); st.occupant = a.id
        const P = makePerson(lookFor(a, st))
        const mark = new THREE.Group()
        const bar = box(.07, .26, .07, markM); bar.position.y = .2; const dot = box(.07, .07, .07, markM); mark.add(bar, dot); mark.visible = false
        P.root.add(mark); mark.position.y = 2.25
        scene.add(P.root)
        ac = { id: a.id, agent: a, st, P, mark, path: [], seated: false, leaving: false, thoughtAt: 0, lastThought: null, phase: Math.random() * 10 }
        if (first || reduceMotion) seatActor(ac)
        else { P.root.position.copy(DOOR); ac.path = [new THREE.Vector3(-10, 0, AISLE_Z), new THREE.Vector3(st.seat.x, 0, AISLE_Z), approachPoint(st), seatWorld(st)] }
        actors.set(a.id, ac)
      }
      ac.agent = a
      if (a.thought && a.thought !== ac.lastThought) { ac.lastThought = a.thought; ac.thoughtAt = performance.now() }
    }
    for (const [id, ac] of actors) if (!ids.has(id) && !ac.leaving) {
      ac.leaving = true; ac.seated = false; ac.st.occupant = null; devSlot.delete(id)
      if (reduceMotion) { scene.remove(ac.P.root); actors.delete(id) }
      else ac.path = [approachPoint(ac.st), new THREE.Vector3(ac.st.seat.x, 0, AISLE_Z), new THREE.Vector3(-10, 0, AISLE_Z), DOOR.clone()]
    }
    first = false
    paintBoard()
  }
  function seatActor(ac) {
    ac.seated = true; ac.path = []
    ac.P.root.position.copy(seatWorld(ac.st)).add(new THREE.Vector3(0, 0, .06).applyAxisAngle(new THREE.Vector3(0, 1, 0), ac.st.seat.rot))
    ac.P.root.rotation.y = ac.st.seat.rot
  }
  const stateOf = a => KID.stateOf(a)

  // paper planes
  const planeGeo = new THREE.BufferGeometry()
  planeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .18, -.12, 0, -.1, 0, .02, -.06, 0, 0, .18, 0, .02, -.06, .12, 0, -.1, 0, 0, .18, 0, -.05, -.08, 0, .02, -.06], 3))
  planeGeo.computeVertexNormals()
  const planeMats = { white: new THREE.MeshStandardMaterial({ color: '#FFFFFF', side: THREE.DoubleSide }), gold: new THREE.MeshStandardMaterial({ color: '#FFD45C', side: THREE.DoubleSide }) }
  const planes = []
  function pointOf(id) {
    if (id === 'owner') return new THREE.Vector3(0, 1.4, 8)
    if (id === 'kid') return new THREE.Vector3(KIDST.seat.x, 1.3, KIDST.seat.z)
    const ac = actors.get(id) || [...actors.values()].find(x => x.agent.name === id)
    return ac ? new THREE.Vector3(ac.st.seat.x, 1.3, ac.st.seat.z) : null
  }
  function plane(from, to, gold) {
    if (reduceMotion) return
    const a = pointOf(from), b = pointOf(to); if (!a || !b) return
    const m = new THREE.Mesh(planeGeo, gold ? planeMats.gold : planeMats.white); m.castShadow = true; scene.add(m)
    planes.push({ m, a, b, s: performance.now(), d: 1800 })
  }

  // ---------------------------------------------------------------- tags + bubbles (DOM)
  const els = new Map()
  const v3 = new THREE.Vector3()
  function overlay() {
    const w = host.clientWidth, h = host.clientHeight, sel = KID.selected(), now = performance.now(), keep = new Set()
    const recent = new Set([...actors.values()].filter(x => !x.leaving && now - x.thoughtAt < 9000).sort((x, y) => y.thoughtAt - x.thoughtAt).slice(0, w >= 900 ? 3 : 1).map(x => x.id))
    for (const ac of actors.values()) {
      if (ac.leaving) continue
      keep.add(ac.id)
      let el = els.get(ac.id)
      if (!el) { el = { tag: document.createElement('button'), bubble: document.createElement('div') }; el.tag.className = 'tag'; el.bubble.className = 'bubble'; el.tag.addEventListener('click', () => KID.select(ac.id)); tags.append(el.bubble, el.tag); els.set(ac.id, el) }
      const a = ac.agent, st = stateOf(a)
      const label = a.role === 'kid' ? 'KID' : `${KID.ROLE[a.role].short} ${a.ticket || ''}`.trim()
      el.tag.innerHTML = `<span class="dot"></span>${label.replace(/[<&]/g, '')}`
      el.tag.className = `tag ${st}${sel === ac.id ? ' sel' : ''}`
      el.tag.setAttribute('aria-label', `${KID.ROLE[a.role].name} ${a.ticket || ''}`)
      ac.P.head.getWorldPosition(v3); v3.y += .5; v3.project(camera)
      const bx = (v3.x + 1) / 2 * w, by = (1 - v3.y) / 2 * h
      ac.P.root.getWorldPosition(v3); v3.y += .05; v3.project(camera)
      const tx = (v3.x + 1) / 2 * w, ty = (1 - v3.y) / 2 * h
      const vis = v3.z < 1 && tx > -40 && tx < w + 40
      el.tag.style.display = vis ? '' : 'none'
      el.tag.style.left = tx + 'px'; el.tag.style.top = (ty + 6) + 'px'
      const show = vis && ac.seated && a.thought && (sel === ac.id || st === 'blocked' || (w >= 560 && recent.has(ac.id)))
      el.bubble.textContent = a.thought || ''
      el.bubble.className = `bubble${show ? ' show' : ''}${st === 'blocked' ? ' blocked' : ''}`
      el.bubble.style.left = bx + 'px'; el.bubble.style.top = by + 'px'
    }
    for (const [id, el] of els) if (!keep.has(id)) { el.tag.remove(); el.bubble.remove(); els.delete(id) }
  }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2()
  let downAt = null
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY] })
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return
    const r = renderer.domElement.getBoundingClientRect()
    ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1)
    ray.setFromCamera(ptr, camera)
    const targets = []
    for (const ac of actors.values()) if (!ac.leaving) { ac.P.root.traverse(o => { if (o.isMesh) { o.userData.actor = ac.id; targets.push(o) } }); ac.st.group.traverse(o => { if (o.isMesh) { o.userData.actor = ac.id; targets.push(o) } }) }
    const hit = ray.intersectObjects(targets, false)[0]
    if (hit) KID.select(hit.object.userData.actor)
  })
  renderer.domElement.addEventListener('dblclick', () => {
    const id = KID.selected(); const ac = id && actors.get(id); if (!ac) return
    const p = seatWorld(ac.st), f = new THREE.Vector3(0, 0, 3.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), ac.st.seat.rot)
    flyTo([p.x + f.x + 1.2, 2.8, p.z + f.z + 1.2], [p.x, 1.1, p.z])
  })

  // ---------------------------------------------------------------- loop
  function resize() {
    const w = host.clientWidth, h = host.clientHeight || w * .625
    renderer.setSize(w, h, false); camera.aspect = w / h
    camera.fov = w < 560 ? 52 : 38
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize()
  applyTimeOfDay()
  const todTimer = setInterval(() => { applyTimeOfDay(); paintSky(skyTex.userData.ctx, 2048, 512); skyTex.needsUpdate = true }, 5 * 60e3)

  let raf = 0, last = performance.now(), lastCode = 0, lastOverlay = 0
  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(.05, (now - last) / 1000); last = now
    const t = now / 1000
    if (camAnim) {
      const k = Math.min(1, (now - camAnim.s) / camAnim.d), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0v, camAnim.t1, e)
      if (k >= 1) camAnim = null
    }
    controls.update()
    if (now - lastCode > 140) { codeTex.userData.tick(); lastCode = now }

    const sel = KID.selected()
    for (const st of stations) st.ring.material.opacity = 0
    for (const [id, ac] of actors) {
      const P = ac.P
      if (ac.path.length) {
        const tgt = ac.path[0], pos = P.root.position, d = Math.hypot(tgt.x - pos.x, tgt.z - pos.z), step = 2.2 * dt
        if (d <= step) { pos.x = tgt.x; pos.z = tgt.z; ac.path.shift(); if (!ac.path.length && !ac.leaving) seatActor(ac) }
        else { pos.x += (tgt.x - pos.x) / d * step; pos.z += (tgt.z - pos.z) / d * step; const want = Math.atan2(tgt.x - pos.x, tgt.z - pos.z); P.root.rotation.y = lerp(P.root.rotation.y, want, .25) }
        pose(P, 'walk', t)
        if (!ac.path.length && ac.leaving) { scene.remove(P.root); actors.delete(id); continue }
      } else if (ac.seated) {
        const s = stateOf(ac.agent)
        pose(P, 'sit', t + ac.phase, s === 'working' ? 1 : 0)
        ac.mark.visible = s === 'blocked'
        if (s === 'blocked') { ac.mark.position.y = 2.25 + Math.sin(t * 5) * .05; ac.mark.rotation.y = t * 2 }
        const m = s === 'working' ? scrWork : s === 'blocked' ? scrBlock : scrIdle
        for (const sc of ac.st.screens) if (sc.material !== m) sc.material = m
      }
      if (sel === id) { ac.st.ring.material.opacity = .9 }
    }
    for (const st of stations) if (!st.occupant) for (const sc of st.screens) if (sc.material !== scrOff) sc.material = scrOff
    for (let i = planes.length - 1; i >= 0; i--) {
      const p = planes[i], k = (now - p.s) / p.d
      if (k >= 1) { scene.remove(p.m); planes.splice(i, 1); continue }
      const pos = new THREE.Vector3().lerpVectors(p.a, p.b, k); pos.y += Math.sin(k * Math.PI) * 2.2
      const nxt = new THREE.Vector3().lerpVectors(p.a, p.b, Math.min(1, k + .02)); nxt.y += Math.sin(Math.min(1, k + .02) * Math.PI) * 2.2
      p.m.position.copy(pos); p.m.lookAt(nxt); p.m.rotateZ(Math.sin(k * 12) * .25)
    }
    renderer.render(scene, camera)
    if (now - lastOverlay > 60) { overlay(); lastOverlay = now }
  }
  raf = requestAnimationFrame(frame)

  const off = KID.on((state, events) => {
    sync()
    for (const e of events) if (e.kind === 'message') plane(e.from, e.to, e.from !== 'kid')
    if (events.some(e => e.kind === 'owner')) plane('owner', 'kid', true)
  })
  sync()

  return {
    plane,
    unmount() {
      cancelAnimationFrame(raf); off(); ro.disconnect(); clearInterval(todTimer)
      controls.dispose(); renderer.dispose(); pmrem.dispose()
      scene.traverse(o => { if (o.isMesh) { o.geometry.dispose() } })
      host.remove()
    },
  }
}
