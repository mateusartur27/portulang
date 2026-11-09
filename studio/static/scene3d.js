/* Cena 3D do PortuLang Studio (three.js r186, WebGL).
 * Quatro "ilhas": 0 = diorama da esteira, 1 = tabuleiro de peças (tokens),
 * 2 = árvore sintática, 3 = sala de execução (caixas + robô + tela). */
import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";

/** Paletas dos dois temas. `fam`: famílias de peças (fundo + cor do texto); `tipos`: cor de cada tipo da linguagem. */
const TEMAS = {
  claro: {
    escuro: false, tinta: "#14172b", mudo: "#6a7394", placa: "#ffffff", erroBg: "#fcd5d7", erroFg: "#a3262b", erroBadge: "#f6a5a9", dim: "#eceef5", sombra: 0.11,
    fam: {
      reservada: { nome: "palavra reservada", bg: "#e4d9fb", fg: "#4b2fa8" }, tipo: { nome: "tipo", bg: "#d3ecfb", fg: "#0b6e8e" },
      nome: { nome: "nome", bg: "#e6e8f1", fg: "#2b3050" }, operacao: { nome: "operação", bg: "#fdf0c4", fg: "#7a5a00" },
      numero: { nome: "número", bg: "#fde4d4", fg: "#a14a14" }, texto: { nome: "texto", bg: "#d9f5e5", fg: "#14754a" },
      pontuacao: { nome: "pontuação", bg: "#eceef4", fg: "#5b607a" },
    },
    tipos: { inteiro: { bg: "#d3ecfb", fg: "#0b6e8e" }, decimal: { bg: "#dfe3ff", fg: "#3a45b8" }, texto: { bg: "#d9f5e5", fg: "#14754a" }, logico: { bg: "#fbdcee", fg: "#a02a6c" } },
  },
  escuro: {
    escuro: true, tinta: "#eceeff", mudo: "#9a9fc4", placa: "#1d1f3c", erroBg: "#5a2433", erroFg: "#ff93a0", erroBadge: "#8a3346", dim: "#262948", sombra: 0.45,
    fam: {
      reservada: { nome: "palavra reservada", bg: "#3b2a66", fg: "#d9a3ff" }, tipo: { nome: "tipo", bg: "#12425c", fg: "#46d4fb" },
      nome: { nome: "nome", bg: "#2b2e4d", fg: "#eceeff" }, operacao: { nome: "operação", bg: "#4b3d17", fg: "#ffd24d" },
      numero: { nome: "número", bg: "#4e2e2c", fg: "#ffa88e" }, texto: { nome: "texto", bg: "#173f2e", fg: "#6cf0a4" },
      pontuacao: { nome: "pontuação", bg: "#2a2d48", fg: "#c9cce6" },
    },
    tipos: { inteiro: { bg: "#12425c", fg: "#46d4fb" }, decimal: { bg: "#2b3170", fg: "#9fb0ff" }, texto: { bg: "#173f2e", fg: "#6cf0a4" }, logico: { bg: "#5a2450", fg: "#ff9ee0" } },
  },
};
// objetos compartilhados com a interface: são atualizados no lugar quando o tema muda
export const FAM = JSON.parse(JSON.stringify(TEMAS.claro.fam));
export const CORES_TIPO = JSON.parse(JSON.stringify(TEMAS.claro.tipos));
let TINTA = "#14172b", MUDO = "#6a7394", PLACA = "#ffffff", VERMELHO = "#fcd5d7", VERM_FG = "#a3262b", ERRO_BADGE = "#f6a5a9", SOMBRA = 0.11, ESCURO = false;
const ACENTO = "#6c47e8", CINZA_DIM = new THREE.Color("#eceef5");
// cores "de cenário" escritas em claro no código; no tema escuro são trocadas por estas
const MAPA_ESCURO = {
  "#ffffff": "#1d1f3c", "#eceef6": "#232548", "#e0e3f1": "#2c2f58", "#dfe2ef": "#2a2d52", "#e4d9fb": "#3b2a66", "#d3ecfb": "#12425c",
  "#d9f5e5": "#173f2e", "#fde4d4": "#4e2e2c", "#6c47e8": "#a97bff", "#c9d0e6": "#4a4f7a", "#2a3358": "#3a3f72", "#aeb8da": "#5b6099",
};
const corTema = (hex) => (ESCURO && typeof hex === "string" && MAPA_ESCURO[hex.toLowerCase()]) || hex;
export function definirTema(nome) {
  const t = TEMAS[nome] || TEMAS.claro;
  ESCURO = t.escuro; TINTA = t.tinta; MUDO = t.mudo; PLACA = t.placa; VERMELHO = t.erroBg; VERM_FG = t.erroFg; ERRO_BADGE = t.erroBadge; SOMBRA = t.sombra;
  CINZA_DIM.set(t.dim);
  for (const k in t.fam) Object.assign(FAM[k], t.fam[k]);
  for (const k in t.tipos) Object.assign(CORES_TIPO[k], t.tipos[k]);
}const CELULA = 0.6;        // largura de um caractere no tabuleiro
const LINHA_Z = 1.3;       // distância entre linhas no tabuleiro

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const rad = (d) => (d * Math.PI) / 180;
const outBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------ texturas e formas */
const texCache = new Map();
function rotuloTex(texto, aspecto, { cor = TINTA, peso = 700, fundo = null } = {}) {
  const key = `${texto}|${aspecto.toFixed(2)}|${cor}|${peso}|${fundo}`;
  if (texCache.has(key)) return texCache.get(key);
  const H = 128, W = Math.max(64, Math.round(H * aspecto));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (fundo) { g.fillStyle = fundo; g.fillRect(0, 0, W, H); }
  let tam = H * 0.52;
  const fonte = (s) => `${peso} ${s}px Consolas, "Cascadia Code", "Courier New", monospace`;
  g.font = fonte(tam);
  while (g.measureText(texto).width > W * 0.9 && tam > 12) { tam -= 2; g.font = fonte(tam); }
  g.fillStyle = cor; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(texto, W / 2, H / 2 + tam * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}
/** rótulo de um nó da árvore: cartão (título pequeno + detalhe), pastilha, chip ou etiqueta */
function cartaoTex(cap, det, w, h, cor, forma) {
  const key = `${cap}|${det}|${w.toFixed(2)}|${h.toFixed(2)}|${cor}|${forma}`;
  if (texCache.has(key)) return texCache.get(key);
  const ppu = Math.min(110, 1100 / w), W = Math.round(w * ppu), H = Math.round(h * ppu);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.textBaseline = "middle";
  const mono = (s, peso = 700) => `${peso} ${s}px Consolas, "Cascadia Code", "Courier New", monospace`;
  const ajustar = (txt, tam, larg, peso) => { g.font = mono(tam, peso); while (g.measureText(txt).width > larg && tam > 10) { tam -= 2; g.font = mono(tam, peso); } return tam; };
  g.fillStyle = cor;
  if (forma === "cartao") {
    const x = H * 0.3;
    g.globalAlpha = 0.7; g.font = `700 ${H * 0.23}px "Segoe UI", system-ui, sans-serif`; if ("letterSpacing" in g) g.letterSpacing = `${H * 0.03}px`; g.textAlign = "left";
    g.fillText(cap.toUpperCase(), x, H * 0.3);
    g.globalAlpha = 1; if ("letterSpacing" in g) g.letterSpacing = "0px";
    ajustar(det, H * 0.34, W - x * 1.5, 700); g.fillText(det, x, H * 0.69);
  } else {
    g.textAlign = "center"; ajustar(det, H * (forma === "op" ? 0.52 : 0.5), W * 0.88, 700); g.fillText(det, W / 2, H / 2 + H * 0.03);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t); return t;
}function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
  return s;
}
const geoCache = new Map();
/** caixa de cantos arredondados. deitada=true: base em y=0, topo em y=esp (peça do tabuleiro).
 *  deitada=false: em pé, centrada em XY, frente em z=esp. */
function geoCaixa(w, h, esp, deitada, raio = 0.2) {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${esp.toFixed(2)}|${deitada}|${raio}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const bev = Math.min(0.07, esp / 3, w / 4, h / 4);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * bev, h - 2 * bev, Math.max(0.01, raio - bev)),
    { depth: Math.max(0.01, esp - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, bev);
  if (deitada) g.rotateX(-Math.PI / 2);
  geoCache.set(key, g);
  return g;
}
const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: corTema(cor), roughness: 0.55, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0, ...extra });
const matLabel = (tex) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });

/* ------------------------------------------------------------ cena */
export function criarCena(canvas, { onHover, onClick } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.7;
  controls.screenSpacePanning = true; controls.panSpeed = 0.9;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE; controls.mouseButtons.LEFT = THREE.MOUSE.PAN;      // arrastar = mover; com Ctrl (ou Shift) o OrbitControls troca para girar
  controls.zoomToCursor = true;                      // a roda dá zoom no ponto sob o cursor

  const hemi = new THREE.HemisphereLight(0xffffff, 0xdfe2f4, 1.9); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 1.5);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
  scene.add(sol, sol.target);

  const ESPACO = 110;
  const areas = [0, 1, 2, 3].map((i) => {
    const grupo = new THREE.Group(); grupo.position.x = i * ESPACO; scene.add(grupo);
    return { i, x: i * ESPACO, grupo, itens: [], pick: [], raio: 30, ticks: [] };
  });
  let etapa = 0, t = 0, cenaAtual = null;
  const cb = { onHover, onClick };

  /* ---- chão (disco suave + receptor de sombra) ---- */
  function chao(a, raio, cor = "255,249,238", sombra = true) {
    a.raio = raio; if (ESCURO) cor = "125,85,235";
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, `rgba(${cor},1)`); grad.addColorStop(0.8, `rgba(${cor},1)`); grad.addColorStop(1, `rgba(${cor},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const disco = new THREE.Mesh(new THREE.PlaneGeometry(raio * 2, raio * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    disco.rotation.x = -Math.PI / 2; disco.position.y = -0.03; disco.renderOrder = -2; disco.material.opacity = 0.2;
    const som = new THREE.Mesh(new THREE.PlaneGeometry(raio * 2, raio * 2), new THREE.ShadowMaterial({ opacity: SOMBRA }));
    som.rotation.x = -Math.PI / 2; som.receiveShadow = true;
    if (ESCURO) a.grupo.add(disco);   // brilho roxo suave sob a cena; no claro o chão é o próprio fundo
    if (sombra) a.grupo.add(som);
  }

  /* ---- peças (itens com animação de nascer / destaque) ---- */
  function novoItem(a, grupo, corpoMesh, cor, opts = {}) {
    const it = {
      grp: grupo, mat: corpoMesh ? corpoMesh.material : null, base: new THREE.Color(cor), h: 0, hAlvo: 0, dim: 0, dimAlvo: 0,
      nasc: t, atraso: opts.atraso ?? 0, eixo: opts.eixo || "y", pos0: grupo.position.clone(), tremer: false, info: opts.info || null, escala: 1,
    };
    grupo.userData.item = it;
    if (corpoMesh) { corpoMesh.userData.item = it; if (opts.pickable !== false) a.pick.push(corpoMesh); }
    grupo.scale.setScalar(0.0001);
    a.grupo.add(grupo); a.itens.push(it);
    return it;
  }
  function limpar(a) {   // texturas e formas ficam em cache; só os materiais são liberados
    for (const ch of [...a.grupo.children]) {
      ch.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
      a.grupo.remove(ch);
    }
    a.itens.length = 0; a.pick.length = 0; a.ticks.length = 0;
  }

  /* ---- peça plana (tabuleiro) e peça em pé (árvore) ---- */
  function pecaPlana(a, texto, x, z, w, d, cor, info, atraso, corTexto = TINTA) {
    const g = new THREE.Group(); g.position.set(x, 0.18, z);
    const corpo = new THREE.Mesh(geoCaixa(w, d, 0.3, true), mat(cor)); corpo.castShadow = corpo.receiveShadow = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, d * 0.8), matLabel(rotuloTex(texto, (w * 0.96) / (d * 0.8), { cor: corTexto })));
    lab.rotation.x = -Math.PI / 2; lab.position.y = 0.315; lab.renderOrder = 2;
    g.add(corpo, lab);
    return novoItem(a, g, corpo, cor, { atraso, info });
  }
  function pecaEmPe(a, texto, x, y, w, h, cor, info, atraso, { z = 0, tam = 0.9, peso = 700, corTexto = TINTA } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const corpo = new THREE.Mesh(geoCaixa(w, h, 0.55, false, 0.28), mat(cor)); corpo.castShadow = corpo.receiveShadow = true;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.74), matLabel(rotuloTex(texto, (w * 0.94) / (h * 0.74), { peso, cor: corTexto })));
    lab.position.z = 0.565; lab.renderOrder = 2;
    g.add(corpo, lab);
    return novoItem(a, g, corpo, cor, { atraso, info, eixo: "z" });
  }

  /* ============================================================ ILHA 0: diorama (o caminho do código) */
  const FASES_INTRO = [
    { cor: "#e4d9fb", n: "1", t: "Separar", s: "análise léxica" },
    { cor: "#d3ecfb", n: "2", t: "Estruturar", s: "análise sintática" },
    { cor: "#d9f5e5", n: "3", t: "Conferir", s: "análise semântica" },
    { cor: "#fdecb8", n: "4", t: "Traduzir", s: "geração de código" },
    { cor: "#fde4d4", n: "5", t: "Executar", s: "o Python roda" },
  ];
  // o caminho: fileira de trás (esquerda -> direita), uma curva, e fileira da frente (direita -> esquerda)
  const INTRO = { xA0: -15, xA1: 14, zB: 15 };
  const POS_MAQ = [{ x: -9, z: 0 }, { x: 0, z: 0 }, { x: 9, z: 0 }, { x: 4.5, z: INTRO.zB }, { x: -4.5, z: INTRO.zB }];
  function caminho(s) {      // distância percorrida -> ponto da esteira
    const lA = INTRO.xA1 - INTRO.xA0;
    if (s <= lA) return { x: INTRO.xA0 + s, z: 0 };
    if (s <= lA + INTRO.zB) return { x: INTRO.xA1, z: s - lA };
    return { x: INTRO.xA1 - (s - lA - INTRO.zB), z: INTRO.zB };
  }
  const S_MAQ = POS_MAQ.map((m, k) => (k < 3 ? m.x - INTRO.xA0 : (INTRO.xA1 - INTRO.xA0) + INTRO.zB + (INTRO.xA1 - m.x)));
  const S_TOTAL = (INTRO.xA1 - INTRO.xA0) * 2 + INTRO.zB;
  function construirIntro() {
    const a = areas[0]; limpar(a); chao(a, 36);
    const g = a.grupo, NM = FASES_INTRO.length, { xA0, xA1, zB } = INTRO;
    const lado = mat("#dfe2ef"), trilho = mat("#c4cae2");
    // esteira em três trechos, cada um com setas que mostram o sentido do fluxo (e andam na mesma velocidade dos pacotes)
    const VEL = 2.6;
    function trecho(cx, cz, w, d, dir) {
      const horiz = dir !== "z+";
      const cv = document.createElement("canvas"); cv.width = horiz ? 128 : 32; cv.height = horiz ? 32 : 128;
      const q = cv.getContext("2d"); q.fillStyle = "#eceef6"; q.fillRect(0, 0, cv.width, cv.height);
      q.strokeStyle = "#d2d7ec"; q.lineWidth = 4.5; q.lineCap = q.lineJoin = "round";
      for (let i = 0; i < 2; i++) {
        q.beginPath();
        if (dir === "x+") { q.moveTo(i * 64 + 22, 8); q.lineTo(i * 64 + 40, 16); q.lineTo(i * 64 + 22, 24); }
        else if (dir === "x-") { q.moveTo(i * 64 + 40, 8); q.lineTo(i * 64 + 22, 16); q.lineTo(i * 64 + 40, 24); }
        else { q.moveTo(8, i * 64 + 22); q.lineTo(16, i * 64 + 40); q.lineTo(24, i * 64 + 22); }
        q.stroke();
      }
      const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace;
      if (horiz) tx.repeat.set(w / 4, 1); else tx.repeat.set(1, d / 4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), [lado, lado, new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 }), lado, lado, lado]);
      m.position.set(cx, 0.3, cz); m.receiveShadow = m.castShadow = true; g.add(m);
      a.ticks.push((dt) => { const v = (dt * VEL) / 4; if (dir === "x+") tx.offset.x -= v; else if (dir === "x-") tx.offset.x += v; else tx.offset.y += v; });
    }
    const L = 1.7;     // meia largura da esteira
    trecho((xA0 + xA1) / 2 - 0.0, 0, xA1 - xA0 + 2 * L, 2 * L, "x+");
    trecho(xA1, zB / 2, 2 * L, zB - 2 * L, "z+");
    trecho((xA0 + xA1) / 2, zB, xA1 - xA0 + 2 * L, 2 * L, "x-");
    const trilhos = (x0, x1, z0, z1) => { const r = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.24, x1 - x0), 0.34, Math.max(0.24, z1 - z0)), trilho); r.position.set((x0 + x1) / 2, 0.72, (z0 + z1) / 2); r.castShadow = true; g.add(r); };
    const xi = xA0 - L, xf = xA1 + L;
    trilhos(xi, xf, -L - 0.24, -L);                        // fileira de trás, borda de fora
    trilhos(xi, xA1 - L, L, L + 0.24);                     // fileira de trás, borda de dentro
    trilhos(xf, xf + 0.24, -L, zB + L);                    // curva, borda de fora
    trilhos(xA1 - L - 0.24, xA1 - L, L, zB - L);           // curva, borda de dentro
    trilhos(xi, xf, zB + L, zB + L + 0.24);                // fileira da frente, borda de fora
    trilhos(xi, xA1 - L, zB - L - 0.24, zB - L);           // fileira da frente, borda de dentro
    [[xi - 0.3, 0], [xi - 0.3, zB]].forEach(([x, z]) => { const rol = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.6, 18), trilho); rol.rotation.x = Math.PI / 2; rol.position.set(x, 0.5, z); rol.castShadow = true; g.add(rol); });

    // folha de código (começo do caminho)
    const folha = new THREE.Group(); folha.position.set(xA0 - 4.2, 3.1, 0); folha.rotation.y = 0.35; g.add(folha);
    const papel = new THREE.Mesh(geoCaixa(4.6, 5.6, 0.3, false, 0.3), mat("#ffffff")); papel.castShadow = true; folha.add(papel);
    [["#cdbcf6", 2.4], ["#a9d8f3", 1.6], ["#f6b896", 3.2], ["#b49af2", 2.0], ["#d6d9e6", 2.8]].forEach(([c, w], i) => {
      const b = new THREE.Mesh(geoCaixa(w, 0.34, 0.1, false, 0.17), mat(c)); b.position.set(-2.0 + w / 2, 1.9 - i * 0.78, 0.32); folha.add(b);
    });

    // máquinas (cada uma é uma etapa; passe o mouse para ler o que ela faz)
    const girar = [];
    const chevron = (dx) => { const s = new THREE.Shape(); s.moveTo(0, -0.85); s.lineTo(0.5, -0.85); s.lineTo(1.15, 0); s.lineTo(0.5, 0.85); s.lineTo(0, 0.85); s.lineTo(0.65, 0); s.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2 }), mat(ACENTO)); m.position.x = dx; return m; };
    FASES_INTRO.forEach((d, k) => {
      const mq = new THREE.Group(); mq.position.set(POS_MAQ[k].x, 0, POS_MAQ[k].z);
      const corpo = new THREE.Mesh(geoCaixa(4.0, 3.6, 4.0, false, 0.7), mat(d.cor)); corpo.position.set(0, 2.4, -2.0); corpo.castShadow = corpo.receiveShadow = true; mq.add(corpo);
      const teto = new THREE.Mesh(geoCaixa(4.5, 0.4, 4.4, false, 0.2), mat("#ffffff")); teto.position.set(0, 4.4, -2.2); teto.castShadow = true; mq.add(teto);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: "#6fe3a0", emissive: "#6fe3a0", emissiveIntensity: 0.8, roughness: 0.4 }));
      lamp.position.set(1.55, 4.85, -0.6); mq.add(lamp);
      const base = new THREE.Mesh(geoCaixa(3.6, 0.45, 0.25, false, 0.2), mat("#ffffff")); base.position.set(0, 1.15, 2.0); mq.add(base);
      // placa com número e nome da etapa
      const cv = document.createElement("canvas"); cv.width = 704; cv.height = 256; const c = cv.getContext("2d");
      c.fillStyle = PLACA; c.beginPath(); c.roundRect(0, 0, 704, 256, 40); c.fill();
      c.fillStyle = d.cor; c.beginPath(); c.arc(104, 128, 70, 0, 7); c.fill();
      c.fillStyle = "#14172b"; c.font = "700 88px 'Segoe UI', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(d.n, 104, 134);
      c.fillStyle = TINTA; c.textAlign = "left"; c.font = "700 80px 'Segoe UI', sans-serif"; c.fillText(d.t, 200, 98);
      c.fillStyle = MUDO; c.font = "500 43px 'Segoe UI', sans-serif"; c.fillText(d.s, 202, 184);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
      const placa = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.0), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false, transparent: true }));
      placa.position.set(0, 7.0, 0.3); mq.add(placa);
      const apoio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), mat("#c9d0e6")); apoio.position.set(0, 5.4, 0); mq.add(apoio);
      // emblema na frente da máquina
      const em = new THREE.Group(); em.position.set(0, 2.6, 2.45); mq.add(em);
      const branco = () => mat(ACENTO);
      if (k === 0) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.17, 12, 28), branco()); em.add(s); [0, 1, 2, 3, 4, 5].forEach((q) => { const dente = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.3), branco()); dente.position.set(Math.cos(q * 1.047) * 1.15, Math.sin(q * 1.047) * 1.15, 0); dente.rotation.z = q * 1.047 - Math.PI / 2; em.add(dente); }); girar.push([em, "z", 1.2]); }
      if (k === 1) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), branco()); r.position.set(0, 0.75, 0); const f1 = r.clone(), f2 = r.clone(); f1.scale.setScalar(0.7); f2.scale.setScalar(0.7); f1.position.set(-0.95, -0.7, 0); f2.position.set(0.95, -0.7, 0);
        [[-0.5, 0.05, 0.9], [0.5, 0.05, -0.9]].forEach(([x, y, rz]) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), branco()); s.position.set(x, y, 0); s.rotation.z = rz; em.add(s); }); em.add(r, f1, f2); girar.push([em, "balanco", 0.8]); }
      if (k === 2) { const a1 = new THREE.Mesh(geoCaixa(0.4, 1.0, 0.3, false, 0.15), branco()); a1.rotation.z = 0.8; a1.position.set(-0.55, -0.25, 0); const a2 = new THREE.Mesh(geoCaixa(0.4, 1.9, 0.3, false, 0.15), branco()); a2.rotation.z = -0.7; a2.position.set(0.35, 0.15, 0); em.add(a1, a2); }
      if (k === 3) em.add(chevron(-1.05), chevron(-0.1));
      if (k === 4) { const tri = new THREE.Shape(); tri.moveTo(-0.55, -0.85); tri.lineTo(-0.55, 0.85); tri.lineTo(0.95, 0); tri.closePath(); const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }); em.add(new THREE.Mesh(tg, branco())); }
      // a máquina inteira responde ao mouse (sobe um pouco e as outras escurecem) e mostra a descrição da etapa
      const it = novoItem(a, mq, corpo, d.cor, { atraso: 0.1 + k * 0.14, info: { kind: "fase", i: k + 1 }, eixo: "y" });
      for (const m of [placa, teto]) { m.userData.item = it; a.pick.push(m); }
    });
    a.ticks.push((dt) => girar.forEach(([o, eixo, v]) => { if (eixo === "balanco") o.rotation.z = Math.sin(t * v) * 0.14; else o.rotation[eixo] += dt * v; }));

    // pacotes que viajam na esteira: código -> peças -> árvore -> árvore conferida -> arquivo .py -> tela
    const formas = () => {
      const p = new THREE.Group();
      const f = Array.from({ length: NM + 1 }, () => new THREE.Group());
      const cod = new THREE.Mesh(geoCaixa(3.2, 1.0, 1.4, false, 0.25), mat("#ffffff")); f[0].add(cod);
      ["#cdbcf6", "#a9d8f3", "#d6d9e6", "#f7dc82", "#f6b896"].forEach((c, i) => { const q = new THREE.Mesh(geoCaixa(0.7, 0.7, 0.7, false, 0.2), mat(c)); q.position.set(-1.5 + i * 0.75, 0, 0); q.castShadow = true; f[1].add(q); });
      const arvore = (corRaiz) => { const gg = new THREE.Group(); const r = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), mat(corRaiz)); r.position.y = 1.0; const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), mat("#f7dc82")), c2 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), mat("#f6b896")); c1.position.set(-0.8, 0.1, 0); c2.position.set(0.8, 0.1, 0);
        [[-0.4, 0.55, 0.9], [0.4, 0.55, -0.9]].forEach(([x, y, rz]) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), mat("#aab4d6")); s.position.set(x, y, 0); s.rotation.z = rz; gg.add(s); }); gg.add(r, c1, c2); gg.children.forEach((o) => (o.castShadow = true)); return gg; };
      f[2].add(arvore("#b49af2")); const t3 = arvore("#b49af2"); const ok = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat("#7fe0a8")); ok.position.set(0, 2.0, 0); t3.add(ok); f[3].add(t3);
      const arq = new THREE.Mesh(geoCaixa(2.0, 1.7, 0.4, false, 0.3), mat("#ffe9a8")); arq.castShadow = true; const la = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), matLabel(rotuloTex(".py", 1.9, { cor: TINTA }))); la.position.set(0, 0, 0.42); f[4].add(arq, la);
      const tela = new THREE.Mesh(geoCaixa(2.2, 1.2, 0.5, false, 0.25), mat("#2a3358")); tela.position.y = 0.2; const lt = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.9), matLabel(rotuloTex("Olá!", 2.1, { cor: "#7fe0a8" }))); lt.position.set(0, 0.2, 0.28); f[5].add(tela, lt);
      f.forEach((x) => { p.add(x); x.visible = false; });
      p.userData.f = f; return p;
    };
    const ALTURA = [1.1, 1.0, 1.0, 1.0, 1.5, 1.35];
    const pacotes = [], PASSO = 9;                      // um pacote a cada 9 unidades de esteira
    const novoPacote = (s) => { const p = formas(); p.userData.s = s; g.add(p); pacotes.push(p); return p; };
    for (let s = 3; s < S_TOTAL - 2; s += PASSO) novoPacote(s);
    
    let desde = 0;
    a.ticks.push((dt) => {
      desde += dt * VEL; if (desde >= PASSO) { desde -= PASSO; novoPacote(0); }
      for (let i = pacotes.length - 1; i >= 0; i--) {
        const p = pacotes[i]; p.userData.s += dt * VEL; const s = p.userData.s;
        if (s > S_TOTAL) { g.remove(p); pacotes.splice(i, 1); continue; }
        const q = caminho(s); let k = 0; while (k < NM && s >= S_MAQ[k]) k++;
        // sem mudar de tamanho: o pacote passa por trás do corpo da máquina (some dentro dela) e sai do outro lado já transformado
        p.userData.f.forEach((f, j) => (f.visible = j === k));
        const queda = clamp((s - (S_TOTAL - 1.5)) / 1.5);       // no fim da esteira ele cai
        p.position.set(q.x, ALTURA[k] - queda * 2.2, q.z);      }
    });
  }

  /* ============================================================ ILHA 1: tabuleiro de peças */
  let boardInfo = null;
  function construirBoard(prog) {
    const a = areas[1]; limpar(a);
    const toks = prog.tokens.map((tk, i) => ({ tk, i })).filter((o) => o.tk.tipo !== "EOF");
    const errs = prog.erros.filter((e) => e.fase === "léxico");
    let minX = 1e9, maxX = -1e9, maxLinha = 1;
    const cel = [];
    for (const { tk, i } of toks) {
      const w = Math.max(0.5, tk.lexema.length * CELULA - 0.1);
      const x = (tk.coluna - 1) * CELULA + w / 2 + 0.05, z = (tk.linha - 1) * LINHA_Z;
      cel.push({ tk, i, w, x, z }); minX = Math.min(minX, x - w / 2); maxX = Math.max(maxX, x + w / 2); maxLinha = Math.max(maxLinha, tk.linha);
    }
    for (const e of errs) { maxX = Math.max(maxX, (e.coluna - 1) * CELULA + 1); maxLinha = Math.max(maxLinha, e.linha); }
    if (!cel.length) { minX = 0; maxX = 8; }
    minX = Math.min(minX, 0);
    const W = maxX - minX, Hz = (maxLinha - 1) * LINHA_Z;
    const cx = (minX + maxX) / 2, cz = Hz / 2;
    chao(a, Math.max(24, Math.hypot(W, Hz) * 0.75));
    // folha de papel
    const folha = new THREE.Mesh(geoCaixa(W + 2.8, Hz + 2.6, 0.2, true, 0.6), mat("#ffffff")); folha.position.set(0, 0, 0);
    folha.receiveShadow = true; folha.castShadow = true; folha.userData.fixo = false; a.grupo.add(folha);
    const passo = Math.min(0.03, 1.8 / Math.max(1, cel.length));
    cel.forEach((c, n) => {
      const fam = FAM[c.tk.familia] || FAM.pontuacao, cor = fam.bg;
      const it = pecaPlana(a, c.tk.lexema, c.x - cx, c.z - cz, c.w, 0.95, cor, { kind: "token", idx: c.i }, n * passo, fam.fg);
      it.pos0.y = 0.18; it.pos0.set(c.x - cx, 0.2, c.z - cz);
    });
    for (let l = 1; l <= maxLinha; l++) {   // números das linhas
      const n = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), matLabel(rotuloTex(String(l), 1.4, { cor: "#9aa3c4", peso: 500 })));
      n.rotation.x = -Math.PI / 2; n.position.set(minX - cx - 1.0, 0.22, (l - 1) * LINHA_Z - cz); a.grupo.add(n);
    }
    errs.forEach((e, n) => {
      const x = (e.coluna - 1) * CELULA + 0.35 - cx, z = (e.linha - 1) * LINHA_Z - cz;
      const it = pecaPlana(a, "✗", x, z, 0.8, 0.95, VERMELHO, { kind: "erro", erro: e }, 0.2 + n * 0.1, VERM_FG);
      it.pos0.set(x, 0.2, z); it.tremer = true;
    });
    boardInfo = { w: W + 2.4, h: Hz + 2.2 };
    a.pos0 = true;
  }

  /* ============================================================ ILHA 2: árvore */
  let arvoreInfo = null, tipoItens = [];
  function construirArvore(prog) {
    const a = areas[2]; limpar(a); tipoItens = [];
    const ast = prog.ast;
    if (!ast) {   // sem árvore: placa de aviso
      chao(a, 24);
      const it = pecaEmPe(a, "Ainda não dá para montar", 0, 3, 14, 2, VERMELHO, null, 0.1, { peso: 700, corTexto: VERM_FG });
      it.tremer = true; arvoreInfo = { w: 18, h: 6, cx: 0, cy: 3 };
      return;
    }
    const nos = [];
    const visitar = (n, prof, pai) => { const nd = { id: nos.length, n, prof, pai, filhos: [] }; nos.push(nd); (n.filhos || []).forEach((f) => nd.filhos.push(visitar(f, prof + 1, nd))); return nd; };
    const raiz = visitar(ast, 0, null);
    const COMANDOS = ["Declaracao", "Atribuicao", "Leitura", "Escrita", "Se", "Enquanto"];
    // cada tipo de nó ganha uma forma: comando = cartão com título e detalhe; operação = pastilha redonda; valor/variável = chip; bloco = etiqueta
    const descrever = (n) => {
      const r = n.rotulo || "";
      switch (n.no) {
        case "Programa": return { forma: "raiz", cap: "", det: "programa" };
        case "Declaracao": return { forma: "cartao", cap: "criar", det: r.replace(/^criar /, "") };
        case "Atribuicao": return { forma: "cartao", cap: "guardar", det: r.replace(/^guardar /, "") };
        case "Leitura": return { forma: "cartao", cap: "ler", det: r.replace(/^ler /, "") };
        case "Escrita": return { forma: "cartao", cap: "mostrar", det: "na tela" };
        case "Se": return { forma: "cartao", cap: "decisão", det: "se …" };
        case "Enquanto": return { forma: "cartao", cap: "repetição", det: "enquanto …" };
        case "Binario": case "Unario": return { forma: "op", cap: "", det: r };
        case "Bloco": return { forma: "bloco", cap: "", det: r };
        case "Erro": return { forma: "cartao", cap: "erro", det: n.codigo || r };
        default: return { forma: "chip", cap: "", det: r.length > 22 ? r.slice(0, 21) + "…" : r };
      }
    };
    nos.forEach((nd) => {
      const d = descrever(nd.n); nd.forma = d.forma; nd.cap = d.cap; nd.txt = d.det;
      const L = Math.max(nd.txt.length * 0.36, nd.cap.length * 0.3);
      if (d.forma === "cartao") { nd.w = clamp(L + 1.7, 3.6, 11); nd.h = 1.55; }
      else if (d.forma === "raiz") { nd.w = 4.6; nd.h = 1.5; }
      else if (d.forma === "op") { nd.h = 1.45; nd.w = Math.max(1.45, nd.txt.length * 0.42 + 0.9); }
      else if (d.forma === "bloco") { nd.w = clamp(nd.txt.length * 0.34 + 1.2, 2.2, 5); nd.h = 0.85; }
      else { nd.w = clamp(nd.txt.length * 0.36 + 1.1, 1.9, 9); nd.h = 1.0; }
    });
        nos.forEach((nd) => { const n = nd.n; nd.temSelo = ["Literal", "Variavel", "Binario", "Unario"].includes(n.no) || (n.no !== "Bloco" && n.no !== "Programa" && prog.erros.some((e) => e.fase === "semântico" && e.linha === n.linha && e.coluna === n.coluna)); });
    const FOLGA = 0.9, GAP_X = 2.1;
    const maxW = [];
    nos.forEach((nd) => { maxW[nd.prof] = Math.max(maxW[nd.prof] || 0, nd.w); });
    const colX = []; let acc = 0; maxW.forEach((w, d) => { colX[d] = acc; acc += w + GAP_X; });
    // posição vertical: cada subárvore ocupa só o espaço de que precisa (nada de linhas desperdiçadas)
    const medir = (nd) => { const proprio = nd.h + FOLGA + (nd.temSelo ? 0.7 : 0); nd.ext = nd.filhos.length ? Math.max(proprio, nd.filhos.reduce((s, f) => s + medir(f), 0)) : proprio; return nd.ext; };
    const colocar = (nd, topo) => {
      if (!nd.filhos.length) { nd.y = topo - nd.ext / 2; return; }
      let cur = topo - (nd.ext - nd.filhos.reduce((s, f) => s + f.ext, 0)) / 2;
      nd.filhos.forEach((f) => { colocar(f, cur); cur -= f.ext; });
      nd.y = nd.prof === 0 ? nd.filhos[0].y : (nd.filhos[0].y + nd.filhos[nd.filhos.length - 1].y) / 2;     // a raiz fica no topo, junto ao primeiro comando
    };
    medir(raiz); colocar(raiz, 0);
    nos.forEach((nd) => { nd.x = colX[nd.prof] + nd.w / 2; });
    const maxX = Math.max(...nos.map((n) => n.x + n.w / 2)), minY = Math.min(...nos.map((n) => n.y - n.h / 2)) - 0.5, maxY = Math.max(...nos.map((n) => n.y + n.h / 2)) + 0.5;
    const W = maxX, H = maxY - minY, cx = W / 2, cy = (maxY + minY) / 2, baseY = H / 2 + 1.3;   // centro da árvore fica acima do chão
    chao(a, Math.max(26, Math.max(W, H) * 0.85), "255,249,238", false);
    const total = nos.length, passo = Math.min(0.14, 2.6 / total);
    const maxProf = Math.max(...nos.map((n) => n.prof));
    const famDe = (n) => n.no === "Erro" ? { bg: VERMELHO, fg: VERM_FG } : n.no === "Programa" ? { bg: ACENTO, fg: "#ffffff" } : COMANDOS.includes(n.no) ? FAM.reservada : n.no === "Bloco" ? FAM.pontuacao : n.no === "Literal" ? (n.tipo === "texto" ? FAM.texto : FAM.numero) : n.no === "Variavel" ? FAM.nome : FAM.operacao;
    const corLigacao = "#aeb8da";
    nos.forEach((nd, k) => {
      const n = nd.n, fam = famDe(n), X = nd.x - cx, Y = nd.y - cy + baseY;
      // corpo do nó
      const raio = nd.forma === "op" ? nd.h / 2 : nd.forma === "cartao" || nd.forma === "raiz" ? 0.42 : 0.3;
      const g = new THREE.Group(); g.position.set(X, Y, 0);
      const corpo = new THREE.Mesh(geoCaixa(nd.w, nd.h, 0.55, false, raio), mat(fam.bg)); corpo.castShadow = corpo.receiveShadow = true;
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(nd.w * 0.94, nd.h * 0.86), matLabel(cartaoTex(nd.cap, nd.txt, nd.w * 0.94, nd.h * 0.86, fam.fg, nd.forma)));
      lab.position.z = 0.565; lab.renderOrder = 2;
      g.add(corpo, lab);
      const it = novoItem(a, g, corpo, fam.bg, { atraso: k * passo, info: { kind: "no", id: nd.id, ti: n.ti, tf: n.tf, no: n }, eixo: "z" });
      it.pos0.set(X, Y, 0); nd.item = it; it.corOrig = it.base.clone(); if (n.no === "Erro") it.tremer = true;
      if (nd.pai) {   // ligação: um tronco sai do pai, se divide num único ponto e cada ramo segue até o seu filho
        const p = nd.pai, x1 = p.x + p.w / 2 - cx, y1 = p.y - cy + baseY, x2 = nd.x - nd.w / 2 - cx, deOp = p.forma === "op", mx = x2 - GAP_X / 2, dy = Y - y1;   // operador: os ramos saem do próprio círculo
        const V = (x, y) => new THREE.Vector3(x, y, -0.05);
        const tubo = (cam, seg) => { const geo = new THREE.TubeGeometry(cam, seg, 0.07, 6, false); const m = new THREE.Mesh(geo, mat(corLigacao, { emissive: 0x000000 })); return { geo, m }; };
        const nasce = (grupo, geo, seg, atraso, extra) => { const ei = novoItem(a, grupo, null, corLigacao, { atraso, pickable: false }); ei.escala = 1; ei.pos0.set(0, 0, 0); ei.semEscala = true; grupo.scale.setScalar(1); geo.setDrawRange(0, 0);
          ei.aoNascer = (f) => { geo.setDrawRange(0, Math.floor(clamp(f) * seg) * 36); if (extra) extra.visible = f > 0.95; }; };
        if (!deOp && !p.tronco) {      // o tronco comum: do pai até o ponto de divisão
          p.tronco = true;
          const st = tubo(new THREE.LineCurve3(V(x1, y1), V(mx, y1)), 16), gt = new THREE.Group(); gt.add(st.m);
          let junta = null; if (p.filhos.length > 1) { junta = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(corLigacao, { emissive: 0x000000 })); junta.position.set(mx, y1, -0.05); junta.visible = false; gt.add(junta); }
          nasce(gt, st.geo, 16, p.item.atraso + 0.06, junta);
        }
        const r0 = deOp ? Math.min(0.7, Math.abs(dy) / 2) : 0, rr = Math.min(0.8, Math.abs(dy) - r0), sg = Math.sign(dy), cam = new THREE.CurvePath();
        if (Math.abs(dy) < 0.02) cam.add(new THREE.LineCurve3(V(deOp ? x1 : mx, y1), V(x2, Y)));
        else if (deOp) {      // sai direto da borda do operador, já curvando para o filho
          const m0 = x1 + r0;
          cam.add(new THREE.QuadraticBezierCurve3(V(x1, y1), V(m0, y1), V(m0, y1 + sg * r0)));
          if (Math.abs(dy) - r0 - rr > 0.01) cam.add(new THREE.LineCurve3(V(m0, y1 + sg * r0), V(m0, Y - sg * rr)));
          cam.add(new THREE.QuadraticBezierCurve3(V(m0, Y - sg * rr), V(m0, Y), V(m0 + rr, Y)));
          cam.add(new THREE.LineCurve3(V(m0 + rr, Y), V(x2, Y)));
        } else {
          if (Math.abs(dy) - rr > 0.01) cam.add(new THREE.LineCurve3(V(mx, y1), V(mx, Y - sg * rr)));
          cam.add(new THREE.QuadraticBezierCurve3(V(mx, Y - sg * rr), V(mx, Y), V(mx + rr, Y)));
          cam.add(new THREE.LineCurve3(V(mx + rr, Y), V(x2, Y)));
        }
        const br = tubo(cam, 40), gr = new THREE.Group(); gr.add(br.m);
        nasce(gr, br.geo, 40, k * passo + 0.14);
      }      // crachá de tipo (aparece na etapa "Conferir")
      const erro = prog.erros.find((e) => e.fase === "semântico" && e.linha === n.linha && e.coluna === n.coluna && n.no !== "Bloco" && n.no !== "Programa");
      nd.erro = erro;
      if (n.tipo || erro) {
        const txt = erro ? erro.codigo : n.tipo, par = erro ? { bg: ERRO_BADGE, fg: VERM_FG } : CORES_TIPO[n.tipo] || FAM.pontuacao, cor = par.bg;
        const bw = Math.max(1.6, txt.length * 0.34 + 0.9);
        const gb = new THREE.Group(); gb.position.set(X + nd.w / 2 - bw / 2 + 0.25, Y + nd.h / 2 + 0.34, 0.3);
        const cb = new THREE.Mesh(geoCaixa(bw, 0.66, 0.3, false, 0.33), mat(cor)); cb.castShadow = true;
        const lb = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.92, 0.5), matLabel(rotuloTex(txt, (bw * 0.92) / 0.5, { peso: 700, cor: par.fg }))); lb.position.z = 0.32;
        gb.add(cb, lb);
        const bi = novoItem(a, gb, cb, cor, { atraso: 0, info: { kind: erro ? "erro-sem" : "tipo", erro, no: n, tipo: n.tipo }, eixo: "z" });
        bi.nasc = 1e9; bi.pos0.copy(gb.position); bi.prof = nd.prof; bi.tipoBadge = true;
        tipoItens.push({ bi, nd }); if (erro) { nd.item.erroSem = true; }
      }
    });
    arvoreInfo = { w: W + 6, h: H + 4, cx: 0, cy: baseY, maxProf, total, nos };
  }

  function revelarTipos(on) {
    const mostrar = on === true;
    const maxProf = arvoreInfo?.maxProf || 0;
    tipoItens.forEach(({ bi, nd }, k) => {
      if (mostrar) { bi.nasc = t; bi.atraso = (maxProf - nd.prof) * 0.28 + k * 0.012; if (nd.erro) { nd.item.base.set(VERMELHO); nd.item.tremer = true; } }
      else { bi.nasc = 1e9; if (nd.erro) { nd.item.base.copy(nd.item.corOrig); nd.item.tremer = false; nd.item.grp.position.x = nd.item.pos0.x; } }
    });
  }

  /* ============================================================ ILHA 3: execução */
  const exec = { caixas: new Map(), ordem: [], robo: null, tela: null, alvo: new THREE.Vector3(0, 0, 4.5), saida: "", largura: 14, fila: [], atual: null, vel: 1, rota: [] };
  function textoCaixa(c, valor, tipo) {
    const g = c.valorCtx;
    g.clearRect(0, 0, 512, 256); g.fillStyle = PLACA; g.beginPath(); g.roundRect(8, 8, 496, 240, 40); g.fill();
    let s = String(valor); if (tipo === "texto") s = `"${s.length > 11 ? s.slice(0, 10) + "…" : s}"`;
    let tam = 120; g.font = `700 ${tam}px Consolas, monospace`;
    while (g.measureText(s).width > 440 && tam > 24) { tam -= 6; g.font = `700 ${tam}px Consolas, monospace`; }
    g.fillStyle = TINTA; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, 256, 138);
    c.valorTex.needsUpdate = true;
  }
  function construirExec() {
    const a = areas[3]; limpar(a); exec.caixas.clear(); exec.ordem = [];
    chao(a, 34);
    // tela
    const tg = new THREE.Group(); tg.position.set(0, 0, -7.5);
    const moldura = new THREE.Mesh(geoCaixa(11.4, 6.6, 0.8, false, 0.6), mat("#2a3358")); moldura.position.y = 4.9; moldura.castShadow = true;
    const hastes = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.6, 12), mat("#2a3358")); hastes.position.y = 0.8; hastes.castShadow = true;
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 580;
    const ctx = cv.getContext("2d"), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ecra = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 5.95), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); ecra.position.set(0, 4.9, 0.83);
    tg.add(moldura, hastes, ecra); a.grupo.add(tg);
    exec.tela = { ctx, tex, cv };
    desenharTela("");
    // robô
    const r = new THREE.Group();
    const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.8, 8, 16), mat(ACENTO)); corpo.position.y = 1.15;
    const barriga = new THREE.Mesh(geoCaixa(0.9, 0.6, 0.2, false, 0.2), mat("#ffffff")); barriga.position.set(0, 1.1, 0.58);
    const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.66, 24, 18), mat("#f4f6ff")); cabeca.position.y = 2.35;
    const olhoG = new THREE.SphereGeometry(0.11, 12, 10), olhoM = new THREE.MeshBasicMaterial({ color: 0x1c2340 });
    const o1 = new THREE.Mesh(olhoG, olhoM), o2 = new THREE.Mesh(olhoG, olhoM); o1.position.set(-0.24, 2.4, 0.56); o2.position.set(0.24, 2.4, 0.56);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), mat("#aab4d6")); ant.position.y = 3.2;
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat("#ffd75e")); bola.position.y = 3.5;
    const pe1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat("#4a5a9a")), pe2 = pe1.clone(); pe1.position.set(-0.35, 0.28, 0.1); pe2.position.set(0.35, 0.28, 0.1);
    r.add(corpo, barriga, cabeca, o1, o2, ant, bola, pe1, pe2); r.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    r.position.set(0, 0, 5); exec.robo = { grp: r, hop: 0, bola }; a.grupo.add(r); exec.alvo.set(0, 0, 5);
    exec.largura = 14; exec.saida = ""; exec.rota = []; exec.digitando = null; exec.fila = []; exec.atual = null; exec.saidaVis = ""; exec.tipo = 0;
  }
  function desenharTela(texto) {
    const { ctx, tex, cv } = exec.tela;
    ctx.fillStyle = "#0f1630"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#58648f"; ctx.font = "600 30px 'Segoe UI', sans-serif"; ctx.textBaseline = "top"; ctx.fillText("TELA DO PROGRAMA", 36, 28);
    ctx.fillStyle = "#7fe0a8"; ctx.font = "700 44px Consolas, monospace";
    const dig = exec.digitando, digitando = dig !== null && dig !== undefined;   // texto que a pessoa está digitando
    const linhas = texto.split("\n");
    if (linhas[linhas.length - 1] === "" && linhas.length > 1 || (!digitando && linhas[linhas.length - 1] === "")) linhas.pop();   // quem digita continua na linha do pedido
    const ult = linhas.length - 1;
    if (digitando) linhas[ult] = (linhas[ult] || "") + dig + "▌";                 // continua na linha do pedido
    const ver = linhas.slice(-9), primeira = linhas.length - ver.length;
    ver.forEach((l, i) => {
      const ativa = digitando && primeira + i === ult;
      ctx.fillStyle = ativa ? "#ffe08a" : "#7fe0a8";
      ctx.fillText(l.length > 38 ? (ativa ? "…" + l.slice(-37) : l.slice(0, 37) + "…") : l, 36, 86 + i * 54);
    });
    if (!ver.length) { ctx.fillStyle = "#3d4a77"; ctx.fillText("(nada foi mostrado ainda)", 36, 86); }
    tex.needsUpdate = true;
  }
  const posCaixaN = (i, total) => { const col = i % 6, lin = Math.floor(i / 6), n = Math.min(6, total - lin * 6); return new THREE.Vector3((col - (n - 1) / 2) * 3.5, 0, lin * 3.8); };
  function posCaixa(i) { return posCaixaN(i, exec.ordem.length); }
  /** a ordem das caixas depois deste estado: as que já existem mantêm o lugar, as novas entram no fim */
  const ordemPrevista = (variaveis) => { const o = exec.ordem.filter((n) => n in variaveis); for (const n of Object.keys(variaveis)) if (!o.includes(n)) o.push(n); return o; };
  /** onde o robô deve ficar para fazer o que o passo pede (null = continua onde está) */
  function destinoRobo(foco, ordem) {
    const nLin = Math.ceil(ordem.length / 6) || 1, lane = (nLin - 1) * 3.8 + 3.6;     // corredor livre, na frente de todas as caixas
    const xs = ordem.map((_, i) => Math.abs(posCaixaN(i, ordem.length).x)), xMax = Math.max(0, ...xs) + 1.3;
    if (foco?.tipo === "var") { const i = ordem.indexOf(foco.nome); if (i >= 0) return { p: new THREE.Vector3(posCaixaN(i, ordem.length).x, 0, lane), xMax }; }
    if (foco?.tipo === "tela") return { p: new THREE.Vector3(xMax + 2.6, 0, -3.8), xMax };
    return null;
  }
  /** aplica o estado do passo: caixas, valores e tela */
  function aplicarEstado({ variaveis = {}, saida = "" }) {
    const a = areas[3];
    const nomes = Object.keys(variaveis);
    // criar caixas novas
    for (const nome of nomes) {
      const v = variaveis[nome]; let c = exec.caixas.get(nome);
      if (!c) {
        const cor = (CORES_TIPO[v.tipo] || FAM.pontuacao).bg, g = new THREE.Group();
        const corpo = new THREE.Mesh(geoCaixa(2.6, 1.9, 2.4, false, 0.35), mat(cor)); corpo.castShadow = corpo.receiveShadow = true; corpo.position.set(0, 0, -1.2);
        const vc = document.createElement("canvas"); vc.width = 512; vc.height = 256;
        const vt = new THREE.CanvasTexture(vc); vt.colorSpace = THREE.SRGBColorSpace; vt.anisotropy = 8;
        const placa = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.05), new THREE.MeshBasicMaterial({ map: vt, transparent: true, toneMapped: false })); placa.position.set(0, -0.15, 1.2 + 0.02);
        const tp = document.createElement("canvas"); tp.width = 512; tp.height = 460; const tg = tp.getContext("2d");
        tg.fillStyle = TINTA; tg.textAlign = "center"; tg.textBaseline = "middle"; let tam = 96; tg.font = `700 ${tam}px Consolas, monospace`; while (tg.measureText(nome).width > 470 && tam > 26) { tam -= 4; tg.font = `700 ${tam}px Consolas, monospace`; }
        tg.fillText(nome, 256, 170); tg.font = "600 62px 'Segoe UI', sans-serif"; tg.fillStyle = MUDO; tg.fillText(v.tipo, 256, 310);
        const tt = new THREE.CanvasTexture(tp); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
        const topo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.15), new THREE.MeshBasicMaterial({ map: tt, transparent: true, toneMapped: false })); topo.rotation.x = -Math.PI / 2; topo.position.set(0, 0.99 + 0.0, 0.0); topo.position.y = 0.97;
        g.add(corpo, placa, topo); g.position.y = 0.95;
        exec.ordem.push(nome);
        c = { nome, g, corpo, vt, valorCtx: vc.getContext("2d"), valorTex: vt, valor: null, tipo: v.tipo, i: exec.ordem.length - 1, y: 9, vy: 0, bump: 0, alvoPos: new THREE.Vector3() };
        c.valorTex = vt; exec.caixas.set(nome, c);
        const it = novoItem(a, g, corpo, cor, { info: { kind: "crate", nome }, atraso: 0 }); it.eixo = "none"; it.escalaIni = 0.5; c.item = it; c.item.nasc = t; c.item.pos0.set(0, 0.95, 0);
        textoCaixa(c, v.valor, v.tipo);
        c.valor = v.valor; c.novo = true;
      } else if (c.valor !== v.valor) { c.valor = v.valor; textoCaixa(c, v.valor, v.tipo); c.bump = 1; c.item.hAlvo = 0; c.flash = 1; }
      c.info = v;
    }
    // remover caixas que saíram de escopo
    for (const [nome, c] of [...exec.caixas]) if (!(nome in variaveis)) { c.saindo = true; exec.caixas.delete(nome); exec.ordem = exec.ordem.filter((n) => n !== nome); setTimeout(() => { a.grupo.remove(c.g); a.itens.splice(a.itens.indexOf(c.item), 1); const ix = a.pick.indexOf(c.corpo); if (ix >= 0) a.pick.splice(ix, 1); }, 400); c.item.nasc = null; c.item.sumir = t; }
    exec.ordem.forEach((n, i) => { const c = exec.caixas.get(n); if (c) { c.i = i; c.alvoPos.copy(posCaixa(i)); if (c.novo) { const rp = exec.robo ? exec.robo.grp.position : c.alvoPos; c.g.position.x = rp.x; c.g.position.z = rp.z; c.novo = false; } } });
    const nCol = Math.min(6, exec.ordem.length), nLin = Math.ceil(exec.ordem.length / 6) || 1;
    const larg = Math.max(14, nCol * 3.5 + 2), prof = 17 + (nLin - 1) * 3.8;
    if (larg !== exec.largura || prof !== exec.prof) { exec.largura = larg; exec.prof = prof; if (etapa === 4) irPara(4, false, 0.9); }
    if (saida !== exec.saida) { const cresce = saida.length > exec.saida.length && saida.startsWith(exec.saida); exec.saida = saida; if (!cresce) { exec.saidaVis = saida; desenharTela(saida); } }   // texto que só cresce é "digitado" aos poucos (execAvancar)
  }
  /** rota do robô: sai de onde ele está agora (não do destino anterior) e dá a volta por fora da fileira de caixas */
  function rotaPara(dest, xMax) {
    const de = exec.robo.grp.position, atras = (z) => z < -1.6;
    const lado = ((de.x + dest.x) >= 0 ? 1 : -1) * (xMax + 2.6);
    const pontos = atras(de.z) !== atras(dest.z) ? [new THREE.Vector3(lado, 0, de.z), new THREE.Vector3(lado, 0, dest.z), dest.clone()] : [dest.clone()];
    return pontos.filter((p, i) => p.distanceTo(i ? pontos[i - 1] : de) > 0.05);
  }
  /**
   * Estado da execução. Animado (padrão): entra numa fila; o robô vai até o lugar do passo e, só ao chegar, o efeito
   * acontece (caixa criada, valor trocado, texto na tela). Com instante=true (pulos, reinício) tudo vai direto ao estado.
   */
  function execEstado(estado, { instante = false } = {}) {
    if (instante || !exec.robo) {
      exec.fila.length = 0; exec.atual = null; aplicarEstado(estado); exec.saidaVis = exec.saida; desenharTela(exec.saida);
      const d = destinoRobo(estado.foco, exec.ordem);
      const r = exec.robo, lane = ((Math.ceil(exec.ordem.length / 6) || 1) - 1) * 3.8 + 3.6;
      if (r) { const p = d ? d.p : new THREE.Vector3(0, 0, lane + 1.6); r.grp.position.set(p.x, 0, p.z); exec.rota = []; exec.alvo.copy(p); r.v = 0; }
      return;
    }
    exec.fila.push(estado);
  }
  function execAvancar(dt) {          // fila de passos + movimento do robô (chamado a cada quadro)
    const r = exec.robo; if (!r) return;
    const vel = exec.vel || 1;
    if (!exec.atual && exec.fila.length) {
      const e = exec.fila.shift(), ordem = ordemPrevista(e.variaveis), d = destinoRobo(e.foco, ordem);
      exec.atual = { e, fase: "ir", espera: 0 };
      if (d) { exec.rota = rotaPara(d.p, d.xMax); exec.alvo.copy(d.p); } else exec.rota = [];     // sem foco (se/enquanto): o robô fica onde está
    }
    const A = exec.atual;
    if (A && A.fase === "ir" && !exec.rota.length) { aplicarEstado(A.e); A.fase = "agir"; A.espera = 0.55 / vel; r.hop = Math.max(r.hop, 0.5); }
    else if (A && A.fase === "agir") { A.espera -= dt; if (A.espera <= 0 && exec.saidaVis === exec.saida) exec.atual = null; }
    if (exec.saidaVis !== undefined && exec.saidaVis.length < exec.saida.length && exec.saida.startsWith(exec.saidaVis)) {     // máquina de escrever na tela
      exec.tipo = (exec.tipo || 0) + dt * 55 * vel; const n = Math.min(exec.saida.length, exec.saidaVis.length + Math.floor(exec.tipo));
      if (n > exec.saidaVis.length) { exec.tipo -= n - exec.saidaVis.length; exec.saidaVis = exec.saida.slice(0, n); desenharTela(exec.saidaVis); }
    }
    // movimento: acelera, anda e desacelera ao chegar (sem trancos)
    const g = r.grp, meta = exec.rota.length ? exec.rota[0] : null;
    if (meta) {
      DESL.copy(meta).sub(g.position); DESL.y = 0;
      const dist = DESL.length(), vmax = 9 * vel, quer = Math.min(vmax, 1.0 + dist * 5);
      r.v = (r.v || 0) + (quer - (r.v || 0)) * Math.min(1, dt * 9);
      const passo = Math.min(dist, r.v * dt);
      if (dist > 1e-4) g.position.addScaledVector(DESL, passo / dist);
      if (dist - passo < 0.03) { g.position.x = meta.x; g.position.z = meta.z; exec.rota.shift(); if (!exec.rota.length) r.v = 0; }
      r.alvoGiro = dist > 1e-4 ? (DESL.x / dist) * 0.7 : 0;
    } else r.v = 0;
    const mov = Math.min(1, (r.v || 0) / 3);
    r.hop = Math.max(0, r.hop - dt * 1.8);
    g.position.y = Math.abs(Math.sin(t * 9)) * 0.32 * mov + Math.abs(Math.sin(r.hop * Math.PI * 3)) * 0.5 * Math.min(1, r.hop * 2) * (1 - mov) + Math.sin(t * 2.2) * 0.04;
    // vira o corpo suavemente para onde anda; parado, volta a olhar para a frente
    const giro = mov > 0.05 ? (r.alvoGiro || 0) : 0;
    g.rotation.y += (giro - g.rotation.y) * Math.min(1, dt * 7);
    r.bola.position.y = 3.5 + Math.sin(t * 5) * 0.06; r.bola.scale.setScalar(1 + 0.2 * mov * Math.sin(t * 12));
  }

  /* ============================================================ vistas de câmera */
  function ajuste(w, h) { const tv = Math.tan(rad(camera.fov / 2)); return Math.max(h / 2 / tv, w / 2 / (tv * camera.aspect)) * 1.02; }
  function vista(e) {
    const a = areas[[0, 1, 2, 2, 3][e]], c = new THREE.Vector3(a.x, 0, 0);
    let w, h, pitch, cy = 0, box = null, lim = { pmin: 0.25, pmax: 1.45, az: 0.8 };
    if (e === 0) { w = 43; h = 19; pitch = 34; cy = 1.0; c.x += -1.5; c.z = INTRO.zB / 2 + 0.5; }
    else if (e === 1) {
      // começa com zoom legível, alinhado ao topo-esquerda; o que não cabe é alcançado rolando
      const b = boardInfo || { w: 20, h: 12 }; pitch = 79;
      w = Math.min(b.w, 34); h = Math.min(b.h, 17) * Math.sin(rad(pitch)) + 1.6;
      const d0 = ajuste(w, h), visH = 2 * d0 * Math.tan(rad(camera.fov / 2)), visX = visH * camera.aspect, visZ = visH / Math.sin(rad(pitch));
      const fx = Math.max(0, (b.w - visX) / 2), fz = Math.max(0, (b.h - visZ) / 2);
      c.x += fx ? -fx : 0; c.z = fz ? -fz + 0.3 : 0.3;
      box = { eixo: "z", x: [-b.w / 2, b.w / 2], v: [-b.h / 2, b.h / 2] };      // limites do conteúdo
    }
    else if (e === 2 || e === 3) {
      const b = arvoreInfo || { w: 20, h: 10, cy: 4 }; pitch = 8; lim = { pmin: 0.9, pmax: 1.7, az: 0.7 };
      w = Math.min(b.w, 36); h = Math.min(b.h, 16) * Math.cos(rad(pitch)) + 1.6;
      const d0 = ajuste(w, h), visH = 2 * d0 * Math.tan(rad(camera.fov / 2)), visW = visH * camera.aspect;
      const fx = Math.max(0, (b.w - visW) / 2), fy = Math.max(0, (b.h - visH) / 2);
      c.x += fx ? -fx : 0; cy = b.cy + fy;                       // começa na raiz (esquerda) e no topo
      box = { eixo: "y", x: [-b.w / 2, b.w / 2], v: [b.cy - b.h / 2, b.cy + b.h / 2] };
    }
    else { const L = exec.largura || 14; w = L + 2; h = (exec.prof || 17) * Math.sin(rad(34)) + 8; pitch = 30; cy = 1.8; c.z = -1; }
    c.y = cy;
    const d = ajuste(w, h);
    const pos = new THREE.Vector3(c.x, c.y + Math.sin(rad(pitch)) * d, c.z + Math.cos(rad(pitch)) * d);
    return { c, pos, d, lim, box };
  }
  let tween = null, homeBox = null, areaX = 0;
  function irPara(e, instante = false, dur = 1.5) {
    const mudouIlha = e !== etapa;
    etapa = e;
    const v = vista(e);
    const a = areas[[0, 1, 2, 2, 3][e]];
    sol.position.set(a.x - 18, 26, 20); sol.target.position.set(a.x, 0, 0);
    const R = Math.max(30, a.raio); Object.assign(sol.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 140 }); sol.shadow.camera.updateProjectionMatrix();
    controls.minDistance = v.d * 0.2; controls.maxDistance = v.d * 1.7;
    controls.minPolarAngle = v.lim.pmin; controls.maxPolarAngle = v.lim.pmax;
    controls.minAzimuthAngle = -v.lim.az; controls.maxAzimuthAngle = v.lim.az;
    homeBox = v.box; areaX = a.x; controls.enableZoom = true;    // roda = zoom; Ctrl + roda sobe/desce (só onde há rolagem)
    if (instante) { camera.position.copy(v.pos); controls.target.copy(v.c); controls.enabled = true; controls.update(); tween = null; areas.forEach((x) => (x.grupo.visible = x === a)); return; }
    areas.forEach((x) => (x.grupo.visible = true));   // durante o voo, mostra tudo
    controls.enabled = false;
    tween = { t: 0, dur, p0: camera.position.clone(), c0: controls.target.clone(), p1: v.pos, c1: v.c };
  }

  /* ============================================================ pointer */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hover = null, pinado = null, ptr = { x: 0, y: 0 }, externo = { tokens: new Set(), no: null, crate: null };
  function alvoItem(it) { return it ? it.info : null; }
  canvas.addEventListener("pointermove", (ev) => {
    const r = canvas.getBoundingClientRect(); ptr = { x: ev.clientX, y: ev.clientY };
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    pendente = true;
  });
  canvas.addEventListener("pointerleave", () => { hover = null; pendente = false; canvas.style.cursor = ""; cb.onHover?.(null, ptr); });
  canvas.addEventListener("dblclick", () => irPara(etapa, false, 0.8));   // duplo clique: volta a câmera ao enquadramento inicial
  canvas.addEventListener("wheel", (ev) => {
    // roda sozinha = zoom (OrbitControls). Ctrl + roda = subir/descer; Shift + roda = esquerda/direita
    if (!homeBox || tween || !(ev.ctrlKey || ev.metaKey || ev.shiftKey)) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const k = (2 * camera.position.distanceTo(controls.target) * Math.tan(rad(camera.fov / 2))) / canvas.clientHeight;
    const lado = ev.shiftKey && !(ev.ctrlKey || ev.metaKey);
    const vert = lado ? 0 : ev.deltaY * k * (homeBox.eixo === "z" ? 1 / Math.sin(rad(79)) : 1);
    const horiz = (lado ? (ev.deltaX || ev.deltaY) : ev.deltaX) * k;
    controls.target.x += horiz; camera.position.x += horiz;
    if (homeBox.eixo === "z") { controls.target.z += vert; camera.position.z += vert; }
    else { controls.target.y -= vert; camera.position.y -= vert; }
    limitarAlvo(); controls.update();
  }, { passive: false, capture: true });
  /** mantém o ponto de foco dentro do conteúdo, arrastando a câmera junto */
  function limitarAlvo() {
    const t = controls.target, alvo = t.clone();
    alvo.x = clamp(alvo.x, areaX + homeBox.x[0], areaX + homeBox.x[1]);
    if (homeBox.eixo === "z") { alvo.z = clamp(alvo.z, homeBox.v[0], homeBox.v[1]); alvo.y = 0; }
    else { alvo.y = clamp(alvo.y, homeBox.v[0], homeBox.v[1]); alvo.z = clamp(alvo.z, -3, 3); }
    const d = alvo.sub(t);
    if (d.lengthSq() > 1e-8) { camera.position.add(d); t.add(d); }
  }
  let down = null;
  canvas.addEventListener("pointerdown", (ev) => { down = { x: ev.clientX, y: ev.clientY }; });
  canvas.addEventListener("pointerup", (ev) => { if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 5) cb.onClick?.(hover ? alvoItem(hover) : null, ptr); down = null; });
  let pendente = false;
  function pegar() {
    pendente = false;
    const a = areas[[0, 1, 2, 2, 3][etapa]];
    if (!a.pick.length || tween) return;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(a.pick, false)[0];
    const it = hit ? hit.object.userData.item : null;
    if (it !== hover) { hover = it; canvas.style.cursor = it ? "pointer" : ""; cb.onHover?.(it ? it.info : null, ptr); }
  }

  /* ============================================================ loop */
  const DESL = new THREE.Vector3();
  function atualizar(dt) {
    const a = areas[[0, 1, 2, 2, 3][etapa]];
    if (tween) {
      tween.t += dt / tween.dur; const k = inOut(clamp(tween.t));
      camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.c0, tween.c1, k); camera.lookAt(controls.target);
      if (tween.t >= 1) { tween = null; controls.enabled = true; controls.update(); areas.forEach((x) => (x.grupo.visible = x === a)); }
    } else { controls.update(); if (homeBox) limitarAlvo(); }
    if (pendente) pegar();
    areas.forEach((ar) => ar.ticks.forEach((f) => f(dt)));
    // destaque combinado (ponteiro + externo)
    const ativos = new Set();
    if (hover?.info?.kind === "token") ativos.add(hover.info.idx);
    externo.tokens.forEach((i) => ativos.add(i));
    for (const ar of areas) {
      let alguem = false;
      for (const it of ar.itens) {
        const inf = it.info; let on = false;
        if (inf) {
          if (inf.kind === "token") on = ativos.has(inf.idx);
          else if (inf.kind === "no") on = (hover?.info?.kind === "no" && hover.info.id === inf.id) || externo.no === inf.id;
          else if (inf.kind === "crate") on = (hover?.info?.kind === "crate" && hover.info.nome === inf.nome) || externo.crate === inf.nome;
          else if (inf.kind === "erro" || inf.kind === "tipo" || inf.kind === "erro-sem" || inf.kind === "fase") on = hover === it;
        }
        it.hAlvo = on ? 1 : 0; if (on) alguem = true;
      }
      for (const it of ar.itens) {
        it.dimAlvo = alguem && it.hAlvo === 0 && it.info && it.info.kind !== "tipo" && it.info.kind !== "erro-sem" ? 1 : 0;
        // nascimento
        let k = 1;
        if (it.nasc !== null) { k = it.nasc > 1e8 ? 0 : outBack(clamp((t - it.nasc - it.atraso) / 0.5)); if (t - it.nasc - it.atraso < 0) k = 0; }
        if (it.sumir !== undefined) k = Math.max(0, 1 - (t - it.sumir) / 0.35);
        if (it.escalaIni !== undefined && it.sumir === undefined) k = it.escalaIni + (1 - it.escalaIni) * k;
        if (it.aoNascer) it.aoNascer(k); if (!it.semEscala) it.grp.scale.setScalar(Math.max(0.0001, k * it.escala));
        it.h += (it.hAlvo - it.h) * Math.min(1, dt * 14); it.dim += (it.dimAlvo - it.dim) * Math.min(1, dt * 9);
        if (it.eixo === "y") it.grp.position.y = it.pos0.y + it.h * 0.45;
        else if (it.eixo === "z") it.grp.position.z = it.pos0.z + it.h * 0.55;
        if (it.mat) {
          it.mat.emissiveIntensity = it.h * 0.32;
          it.mat.color.copy(it.base).lerp(CINZA_DIM, it.dim * 0.7);
          if (it.tremer) it.grp.position.x = it.pos0.x + Math.sin(t * 28) * 0.05 * (it.eixo === "z" || it.eixo === "y" ? 1 : 0);
        }
      }
    }
    // caixas e robô
    if (areas[3]) {
      for (const c of exec.caixas.values()) {
        c.g.position.x += (c.alvoPos.x - c.g.position.x) * Math.min(1, dt * 8); c.g.position.z += (c.alvoPos.z - c.g.position.z) * Math.min(1, dt * 8);
        if (c.novo === undefined) c.novo = false;
        const queda = Math.max(0, 1 - (t - c.item.nasc) / 0.7); const off = queda * queda * 1.6;
        c.bump = Math.max(0, c.bump - dt * 2.6);
        c.g.position.y = 0.95 + off + Math.sin(c.bump * Math.PI) * 0.6;
        const fl = Math.max(0, (c.flash || 0) - dt * 2.2); c.flash = fl; c.corpo.material.emissiveIntensity = Math.max(c.corpo.material.emissiveIntensity, fl * 0.5);
      }
      execAvancar(dt);
    }
  }
  let ultimo = performance.now();
  let frames = 0, fpsT = 0, fps = 0;
  function loop(agora) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora; t += dt;
    atualizar(dt); renderer.render(scene, camera);
    frames++; fpsT += dt; if (fpsT >= 1) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  }
  function redimensionar() {
    const r = canvas.parentElement.getBoundingClientRect(); if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    irPara(etapa, true);
  }
  new ResizeObserver(redimensionar).observe(canvas.parentElement);

  construirIntro(); construirExec(); chao(areas[1], 24);
  redimensionar(); requestAnimationFrame(loop);

  /* ============================================================ API pública */
  const api = {
    irPara: (e, instante) => { irPara(e, instante); },
    mostrarPrograma(prog) { construirBoard(prog); construirArvore(prog); if (etapa >= 1) irPara(etapa, true); },
    replay() { const a = areas[[0, 1, 2, 2, 3][etapa]]; a.itens.forEach((it, k) => { if (!it.tipoBadge) it.nasc = t; }); if (etapa === 3) revelarTipos(true); },
    revelarTipos,
    destacar({ tokens = [], no = null, crate = null } = {}) { externo = { tokens: new Set(tokens), no, crate }; },
    execReiniciar() { construirExec(); },
    execOcioso() { return !exec.atual && !exec.fila.length && !exec.rota.length; },
    execVelocidade(v) { exec.vel = v; },
    execDigitando(t) { if (!exec.tela || exec.digitando === t) return; exec.digitando = t; desenharTela(exec.saidaVis ?? exec.saida); },
    execEstado,
    centralizar() { irPara(etapa, false, 0.8); },
    /** só para testes: avança a animação sem depender do requestAnimationFrame */
    avancar(seg) { for (let s = 0; s < seg; s += 0.05) { t += 0.05; atualizar(0.05); } renderer.render(scene, camera); },
    /** troca a paleta (claro/escuro): luz, cores e reconstrução das ilhas fixas; o programa é refeito por mostrarPrograma */
    setTema(nome) {
      definirTema(nome);
      hemi.color.set(ESCURO ? 0xf0eaff : 0xffffff); hemi.groundColor.set(ESCURO ? 0x4a4380 : 0xdfe2f4); hemi.intensity = ESCURO ? 3.0 : 1.9;
      sol.color.set(ESCURO ? 0xf3eeff : 0xffffff); sol.intensity = ESCURO ? 2.1 : 1.5;
      construirIntro(); construirExec(); chao(areas[1], 24, undefined, true);
      irPara(etapa, true);
    },    get fps() { return fps; },
    get etapa() { return etapa; },
    onHover(f) { cb.onHover = f; }, onClick(f) { cb.onClick = f; },
    debug: { areas, scene, camera, renderer, controls },
  };
  return api;
}


