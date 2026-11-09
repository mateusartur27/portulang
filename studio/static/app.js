/* PortuLang – fluxo guiado (visual minimalista). */
import { criarCena, FAM, CORES_TIPO } from "./scene3d.js";

const $ = (s) => document.querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") { for (const [p, val] of Object.entries(v)) (p.startsWith("--") ? e.style.setProperty(p, val) : (e.style[p] = val)); }
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, "");
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const ICONES = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M16.5 5.5v13a.6.6 0 0 1-.9.5L6 12.5a.6.6 0 0 1 0-1L15.6 5a.6.6 0 0 1 .9.5z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M7.5 5.5v13a.6.6 0 0 0 .9.5l9.6-6.5a.6.6 0 0 0 0-1L8.4 5a.6.6 0 0 0-.9.5z"/></svg>',
  first: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="2.6" height="14" rx="1"/><path d="M19 5.5v13a.6.6 0 0 1-.9.5L9 12.5a.6.6 0 0 1 0-1L18.1 5a.6.6 0 0 1 .9.5z"/></svg>',
  last: '<svg viewBox="0 0 24 24"><rect x="16.4" y="5" width="2.6" height="14" rx="1"/><path d="M5 5.5v13a.6.6 0 0 0 .9.5l9.1-6.5a.6.6 0 0 0 0-1L5.9 5a.6.6 0 0 0-.9.5z"/></svg>',
  centrar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/></svg>',
  tabela: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M9.5 4.5v15"/></svg>',
  editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2M3.5 4v4.6h4.6"/></svg>',
};
const ico = (n, traco = false) => { const s = h("span", { class: "ico" + (traco ? " traco" : "") }); s.innerHTML = ICONES[n]; return s; };

/* ------------------------------------------------------------ 3D */
let cena;
try { cena = criarCena($("#tela3d")); }
catch (e) {
  console.error(e);
  $("#cena").append(h("div", { class: "flutuante", style: { top: "40%", left: "10%", right: "10%" } }, "Seu navegador não conseguiu iniciar o 3D. O resto continua funcionando."));
  cena = new Proxy({}, { get: () => () => {} });
}

/* ------------------------------------------------------------ famílias de peças */
function familiaDe(t) {
  switch (t.categoria) {
    case "estrutura": case "controle": case "entrada/saída": case "lógico": return "reservada";
    case "tipo": return "tipo";
    case "identificador": return "nome";
    case "operador": return "operacao";
    case "literal": return t.tipo === "LIT_TEXTO" ? "texto" : t.tipo === "VERDADEIRO" || t.tipo === "FALSO" ? "reservada" : "numero";
    default: return "pontuacao";
  }
}

/* ------------------------------------------------------------ textos */
const OPERACOES = { "+": "soma (ou junta textos)", "-": "subtração", "*": "multiplicação", "/": "divisão", "=": "guarda o valor da direita na variável da esquerda", "==": "pergunta: é igual?", "!=": "pergunta: é diferente?", ">": "maior que", "<": "menor que", ">=": "maior ou igual a", "<=": "menor ou igual a", e: "E", ou: "OU", nao: "NÃO" };
const SIMBOLOS = { ";": "Termina um comando.", "(": "Abre uma condição ou uma conta.", ")": "Fecha uma condição ou uma conta.", "{": "Abre um bloco de comandos.", "}": "Fecha o bloco de comandos.", ",": "Separa itens." };
function descToken(t) {
  const L = t.lexema;
  switch (t.categoria) {
    case "estrutura": return L === "programa" ? "Marca o começo do programa." : "Marca o fim do programa.";
    case "tipo": return { inteiro: "Tipo de variável: números inteiros (1, 20, -3).", decimal: "Tipo de variável: números com vírgula (3.14).", texto: "Tipo de variável: frases entre aspas.", logico: "Tipo de variável: verdadeiro ou falso." }[L];
    case "identificador": return "Nome de uma variável: uma “caixinha” que guarda um valor.";
    case "literal": return t.tipo === "LIT_TEXTO" ? "Um texto escrito direto no código." : t.tipo.startsWith("LIT_") ? "Um número escrito direto no código." : "Um valor lógico: verdadeiro ou falso.";
    case "controle": return { se: "Faz uma pergunta. Se a resposta for verdadeira, executa o bloco seguinte.", senao: "O que fazer quando a pergunta do “se” deu falso.", enquanto: "Repete o bloco enquanto a condição for verdadeira." }[L];
    case "entrada/saída": return L === "ler" ? "Pede um valor ao usuário e guarda numa variável." : "Mostra algo na tela.";
    case "lógico": return { e: "E: só dá verdadeiro se os dois lados forem verdadeiros.", ou: "OU: basta um dos lados ser verdadeiro.", nao: "NÃO: inverte verdadeiro e falso." }[L];
    case "operador": return "Operação: " + (OPERACOES[L] || L) + ".";
    case "delimitador": return SIMBOLOS[L];
  }
  return "";
}
function descNo(n) {
  switch (n.no) {
    case "Programa": return "O programa inteiro: uma lista de comandos, executados de cima para baixo.";
    case "Declaracao": return "Cria uma variável e, se houver, já guarda um valor nela.";
    case "Atribuicao": return "Calcula o valor da direita e guarda na variável.";
    case "Leitura": return "Pede um valor ao usuário e guarda na variável.";
    case "Escrita": return "Mostra o resultado na tela.";
    case "Se": return "Decisão: executa o bloco “então” se a condição for verdadeira; senão, o bloco “senão”.";
    case "Enquanto": return "Repetição: repete o bloco enquanto a condição for verdadeira.";
    case "Binario": return `Operação: ${OPERACOES[n.rotulo] || n.rotulo}` + (n.tipo ? ` → resultado do tipo ${n.tipo}.` : ".");
    case "Unario": return "Operação sobre um único valor.";
    case "Variavel": return `Usa o valor guardado em “${n.rotulo}”` + (n.tipo ? ` (${n.tipo}).` : ".");
    case "Literal": return "Um valor escrito direto no código" + (n.tipo ? ` (${n.tipo}).` : ".");
    case "Bloco": return "Um grupo de comandos.";
    case "Erro": return n.mensagem;
  }
  return "";
}

const L = (...x) => x.join("");
const ETAPAS = [
  { curto: "Escrever", oque: "É o ponto de partida: você escreve (ou escolhe) um programa. Ele ainda é só um texto, como uma receita que o computador não sabe ler. As próximas etapas transformam esse texto em algo que ele consegue executar.", titulo: "Escreva seu programa",
    frase: () => "Uma linguagem em português, com tipos declarados, feita em Python, compilada para Python e depois interpretada (híbrida). Os arquivos têm extensão .pl. Escolha um exemplo ou escreva o seu.",
    dica: "As máquinas são as etapas pelas quais o código vai passar",
    saiba: L(`<h3>Sobre a PortuLang</h3><p>É uma linguagem de programação <b>em português</b>, criada para estudar como um compilador funciona. Os comandos são palavras como <code>se</code>, <code>enquanto</code>, <code>escrever</code> e <code>ler</code>, e <b>toda variável precisa ter o tipo declarado</b>.</p>`,
      `<h4>Compilada e interpretada (híbrida)</h4><p>A PortuLang segue o caminho completo de um compilador (léxico, sintático, semântico e geração de código) e o resultado é um arquivo <code>.py</code>: isso é a <b>compilação</b>. Depois, o Python <b>interpreta</b> esse arquivo (ele mesmo o converte em bytecode e o executa). Por isso a linguagem é <b>híbrida</b>: compilada para Python e depois interpretada. É parecido com o Java, que compila para bytecode e roda numa máquina virtual.</p>`,
      `<h4>Arquivos .pl</h4><p>Um programa PortuLang é salvo num arquivo de texto com a extensão <code>.pl</code> (por exemplo, <code>media.pl</code>). Use “Abrir” e “Salvar” aqui no editor, ou arraste um arquivo <code>.pl</code> para ele.</p>`,
      `<h4>Feita em Python</h4><p>O “cérebro” da linguagem é um programa em <b>Python 3</b>, só com a biblioteca padrão, sem nenhuma dependência: o <i>lexer</i> separa o texto em peças, o <i>parser</i> monta a árvore, o <i>analisador semântico</i> confere os tipos, o <i>gerador de código</i> traduz o programa para um novo programa em Python e o <i>interpretador</i> executa a árvore. A PortuLang não gera código de máquina: ela é “compilada” para Python, e é o Python que executa.</p><p>Este Studio é uma página web (HTML, CSS e JavaScript, com <b>three.js</b> na cena 3D) servida por um pequeno servidor local, também em Python.</p>`,
      `<h4>Como é um programa</h4><p>Começa com <code>programa</code>, termina com <code>fim</code>, e cada comando termina com <code>;</code>.</p>`,
      `<h4>Os tipos</h4><ul><li><code>inteiro</code>: números sem vírgula (1, 20, -3)</li><li><code>decimal</code>: números com vírgula (3.14)</li><li><code>texto</code>: frases entre aspas ("oi")</li><li><code>logico</code>: <code>verdadeiro</code> ou <code>falso</code></li></ul>`,
      `<h4>O que ela tem</h4><ul><li>variáveis, atribuição e contas (<code>+ - * /</code>)</li><li>comparações e lógica (<code>e</code>, <code>ou</code>, <code>nao</code>)</li><li>decisões (<code>se</code> / <code>senao</code>) e repetição (<code>enquanto</code>)</li><li>entrada (<code>ler</code>) e saída (<code>escrever</code>)</li></ul>`,
      `<h4>O caminho do código</h4><p>Ele passa por 5 etapas: análise léxica (separar em peças), sintática (montar a estrutura), semântica (conferir os tipos), geração de código (traduzir para instruções) e execução. <b>Cada etapa só roda quando você chega nela</b>, e o Studio mostra quanto tempo o Python levou.</p>`) },  { curto: "Léxico", oque: "O computador lê o texto letra por letra e o separa em peças (palavras, números, símbolos), como separar as palavras de uma frase. Cada peça ganha um nome, tipo “palavra reservada” ou “número”. Se aparecer algo que a linguagem não conhece, o erro é pego aqui.", titulo: "Análise léxica",
    frase: (S) => `O código foi separado em ${plural(S.analise.tokens.length - 1, "peça", "peças")} (tokens).`,
    dica: "Roda: zoom · Ctrl + roda: subir/descer · Arrastar: mover · Ctrl + arrastar: girar",
    saiba: L(`<h3>Análise léxica</h3><p>O <b>lexer</b> lê o texto caractere por caractere e agrupa tudo em <b>tokens</b>. Cada token guarda o seu tipo, o texto original e a posição (linha e coluna). Espaços e comentários (<code>//</code>) são ignorados.</p>`,
      `<h4>Erros que podem aparecer aqui</h4><ul><li>Um caractere que a linguagem não conhece, como <code>@</code></li><li>Um texto sem aspas de fechamento</li><li>Um número incompleto, como <code>3.</code></li></ul>`,
      `<h4>As cores</h4><p>Cada cor é uma família de peças. Passe o mouse na legenda para ver todas as peças daquela família.</p>`) },
  { curto: "Sintático", oque: "Agora ele confere se as peças estão na ordem certa, como a gramática de uma frase, e monta um esquema em árvore mostrando como as partes se encaixam. Faltou um ponto e vírgula ou um parêntese? O erro aparece aqui.", titulo: "Análise sintática",
    frase: (S) => `As peças foram organizadas numa árvore de ${plural(S.nosContados, "bloco", "blocos")}.`,
    dica: "Roda: zoom · Ctrl + roda: subir/descer · Arrastar: mover · Ctrl + arrastar: girar",
    saiba: L(`<h3>Análise sintática</h3><p>O <b>parser</b> confere se os tokens seguem a gramática da linguagem e monta a <b>árvore sintática</b> (AST). Um comando <code>se</code>, por exemplo, tem uma condição e um bloco de comandos como filhos.</p>`,
      `<h4>Precedência</h4><p>Na conta <code>1 + 2 * 3</code>, a multiplicação fica mais “fundo” na árvore, porque é resolvida primeiro.</p>`,
      `<h4>Erros que podem aparecer aqui</h4><ul><li>Faltou um <code>;</code> no fim do comando</li><li>Faltou uma expressão (<code>inteiro x = ;</code>)</li><li>Um comando que não existe, ou uma chave <code>}</code> sobrando</li></ul>`) },
  { curto: "Semântico", oque: "Confere se o programa faz sentido: toda variável existe, os tipos combinam (não dá para somar um texto com um número) e as condições são perguntas de sim ou não. Pega erros de lógica antes de rodar.", titulo: "Análise semântica",
    frase: (S) => `Cada valor ganhou um tipo e tudo combina${S.analise.simbolos.length ? ` · ${plural(S.analise.simbolos.length, "variável declarada", "variáveis declaradas")}` : ""}.`,
    dica: "Crachás = tipo de cada valor · Roda: zoom · Ctrl + roda: subir/descer · Ctrl + arrastar: girar",
    saiba: L(`<h3>Análise semântica</h3><p>Aqui o computador confere o <b>sentido</b> do programa, antes de executar. Ele guarda cada variável numa <b>tabela de símbolos</b> (nome, tipo, onde foi declarada) e confere os tipos de cada operação.</p>`,
      `<h4>O que ele verifica</h4><ul><li>Toda variável foi declarada antes de ser usada</li><li>Nenhum nome foi declarado duas vezes</li><li>O valor combina com o tipo (não dá para guardar um texto num <code>inteiro</code>)</li><li>Um <code>decimal</code> não cabe num <code>inteiro</code> sem perder dados</li><li>As condições de <code>se</code> e <code>enquanto</code> são <code>logico</code></li></ul>`) },
  { curto: "Código", oque: "O programa já foi entendido e conferido. Agora ele é traduzido para outra linguagem, o Python, que o computador sabe executar. É o “código compilado”: um programa novo, equivalente ao seu, que você pode até baixar e rodar fora do Studio.", titulo: "Código gerado",
    frase: (S) => `O programa foi traduzido para Python: ${plural(S.analise.python ? S.analise.python.length : 0, "linha", "linhas")} que rodam sozinhas.`,
    dica: "Passe o mouse numa linha para ver, no seu código, de onde ela veio",
    saiba: L(`<h3>Geração de código</h3><p>Depois de conferir o programa, o compilador o <b>traduz para outra linguagem</b>: aqui, o Python. Cada comando PortuLang vira o comando equivalente em Python (<code>se</code> vira <code>if</code>, <code>enquanto</code> vira <code>while</code>, <code>escrever</code> vira uma chamada de função). Passe o mouse numa linha para ver de qual trecho do seu código ela veio.</p>`,
      `<h4>Funções auxiliares</h4><p>Algumas coisas da PortuLang não existem iguais no Python, como ler um valor conferindo o tipo ou a divisão de inteiros. Elas viram pequenas funções no começo do arquivo (clique em “Funções auxiliares”).</p>`,
      `<h4>Dá para rodar fora do Studio</h4><p>O botão “Baixar .py” salva o programa gerado. Ele roda sozinho com <code>python programa.py</code>.</p>`,
      `<h4>A outra aba</h4><p>“Instruções da máquina” mostra o mesmo programa de um jeito ainda mais básico: uma lista de passos para uma <b>máquina de pilha</b> (como <code>EMPILHAR 3</code> e <code>SOMAR</code>), que é como muitos compiladores guardam o código antes de gerar o resultado final.</p>`,
      `<h4>Isto é executado de verdade?</h4><p>A animação da próxima etapa segue a árvore do programa (o interpretador). Em paralelo, as instruções da máquina rodam numa <b>máquina virtual</b> e o Studio confere se dá o mesmo resultado. O Python gerado também é conferido nos testes do projeto contra o interpretador.</p>`) },
  { curto: "Executar", oque: "Finalmente o computador segue as instruções, uma de cada vez, guardando valores em caixas (as variáveis) e mostrando resultados na tela. Você pode acompanhar passo a passo e repetir só esta parte quantas vezes quiser.", titulo: "Execução",
    frase: () => "", dica: "",
    saiba: L(`<h3>Interpretador</h3><p>Ele percorre a árvore e executa cada comando, de cima para baixo. Cada variável vira uma <b>caixa</b> na memória, com um nome, um tipo e um valor. O robô mostra o que está sendo feito agora.</p>`,
      `<h4>Decisões e repetições</h4><p>Num <code>se</code>, o computador avalia a condição: se for verdadeira, entra no bloco. Num <code>enquanto</code>, ele confere a condição <b>toda vez</b> antes de repetir.</p>`,
      `<h4>Erros que só aparecem aqui</h4><ul><li>Divisão por zero</li><li>Um valor digitado que não combina com o tipo da variável</li><li>Um laço que nunca termina (o Studio para depois de muitos passos)</li></ul>`) },
];

/* ------------------------------------------------------------ estado */
const S = {
  etapa: 0, maxEtapa: 0, analise: null, fonteAnalisada: null, exec: null, p: 0, entrada: "", exemplos: [],
  hover: null, pin: null, hl: new Set(), spans: [], nos: [], nosContados: 0, timer: null, vel: 1, exemploAtual: "", entradaPronta: false,
};
const ta = $("#codigo");

/* ------------------------------------------------------------ editor (etapa 1) */
const KW = new Set(["programa", "fim", "se", "senao", "enquanto", "e", "ou", "nao"]);
const TIPOS = new Set(["inteiro", "decimal", "texto", "logico"]);
const FN = new Set(["ler", "escrever"]);
const BOOL = new Set(["verdadeiro", "falso"]);
const RE = /\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"?|\d+\.\d+|\d+|[A-Za-z_]\w*|==|!=|<=|>=|[+\-*\/<>=(){};,]/g;
let linhas = [""], linhaIni = [0];
function medir(src) { linhas = src.split("\n"); linhaIni = []; let o = 0; for (const l of linhas) { linhaIni.push(o); o += l.length + 1; } }
const offsetDe = (l, c) => (linhaIni[l - 1] ?? ta.value.length) + c - 1;
const fresco = () => S.analise && S.fonteAnalisada === ta.value;

function renderEditor() {
  const src = ta.value, n = src.length; medir(src);
  const cls = new Array(n).fill("");
  for (const m of src.matchAll(RE)) {
    const w = m[0]; let c = "c-id";
    if (w.startsWith("//")) c = "c-com"; else if (w[0] === '"') c = "c-str"; else if (/^\d/.test(w)) c = "c-num";
    else if (KW.has(w)) c = "c-kw"; else if (TIPOS.has(w)) c = "c-tipo"; else if (BOOL.has(w)) c = "c-bool";
    else if (FN.has(w)) c = "c-fn"; else if (!/^[A-Za-z_]/.test(w)) c = "c-op";
    for (let i = m.index; i < m.index + w.length; i++) cls[i] = c;
  }
  const errLinhas = new Set();
  if (fresco()) for (const e of S.analise.erros) {
    if (!e.linha) continue; errLinhas.add(e.linha);
    const r = intervaloErro(e);
    for (let i = Math.max(0, offsetDe(r.linha, r.col)); i < Math.min(n, offsetDe(r.linha, r.col) + r.len); i++) cls[i] += " m-erro";
  }
  let html = "", at = null, buf = "";
  for (let i = 0; i < n; i++) { if (cls[i] !== at) { if (buf) html += at ? `<span class="${at}">${esc(buf)}</span>` : esc(buf); at = cls[i]; buf = ""; } buf += src[i]; }
  if (buf) html += at ? `<span class="${at}">${esc(buf)}</span>` : esc(buf);
  $("#destaque").innerHTML = html + "\n​";
  $("#gutter").replaceChildren(...linhas.map((_, i) => h("div", { class: errLinhas.has(i + 1) ? "erro" : "" }, i + 1)), h("div", { style: { height: "40px" } }));
  syncScroll();
}
function intervaloErro(e) {
  const t = S.analise.tokens.find((t) => t.linha === e.linha && t.coluna === e.coluna && t.tipo !== "EOF");
  let len = t ? t.lexema.length : 1, col = e.coluna;
  const compr = (linhas[e.linha - 1] || "").length;
  if (!t && e.codigo === "L02") len = Math.max(1, compr - col + 1);
  if (col > compr) { col = Math.max(1, compr); len = 1; }
  return { linha: e.linha, col, len };
}
function syncScroll() { $("#interno").style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`; $("#gutter").scrollTop = ta.scrollTop; }
function irParaErro(e) {
  if (!e.linha) return;
  const r = intervaloErro(e), a = offsetDe(r.linha, r.col);
  ta.focus(); ta.setSelectionRange(a, a + r.len);
  const topo = (r.linha - 1) * 28; if (topo < ta.scrollTop || topo > ta.scrollTop + ta.clientHeight - 70) ta.scrollTop = Math.max(0, topo - 70);
  syncScroll();
}

/* ------------------------------------------------------------ análise */
/* Nada é compilado enquanto você digita. Cada fase roda no servidor (Python) só quando você chega nela,
   e volta com o tempo que levou. Os resultados vão se acumulando em S.analise. */
const FASES = ["lexico", "sintatico", "semantico", "codigo"];
const NOME_FASE = { lexico: "léxico", sintatico: "sintático", semantico: "semântico", codigo: "de código" };
const FASE_ERRO = { lexico: "léxico", sintatico: "sintático", semantico: "semântico" };
function aplicarFase(a, f, r) {
  a.feitas.push(f); a.tempos[f] = r.tempo_ms; a.erros = r.erros || [];
  if (a.erros.length) a.fase = FASE_ERRO[f];
  if (f === "lexico") {
    a.tokens = r.tokens; a.tokens.forEach((t) => (t.familia = familiaDe(t)));
    S.pares = new Map();
    for (const [abre, fecha] of [["ABRE_PAR", "FECHA_PAR"], ["ABRE_CHAVE", "FECHA_CHAVE"]]) {
      const pilha = [];
      a.tokens.forEach((t, i) => { if (t.tipo === abre) pilha.push(i); else if (t.tipo === fecha && pilha.length) { const o = pilha.pop(); S.pares.set(o, i); S.pares.set(i, o); } });
    }
  } else if (f === "sintatico") a.ast = r.ast;
  else if (f === "semantico") { a.ast = r.ast; a.simbolos = r.simbolos || []; }
  else if (f === "codigo") { a.codigo = r.codigo; a.python = r.python; a.prelude = r.prelude; }
  if (f === "sintatico" || f === "semantico") indexarArvore();
  if (f !== "codigo") cena.mostrarPrograma(a);
}
/** Roda, na ordem, as fases que a etapa `n` precisa e ainda não rodaram. Devolve false se algo deu errado (servidor, código editado no meio). */
async function compilarAte(n) {
  const fonte = ta.value;
  if (S.analise && S.fonteAnalisada !== fonte) S.analise = null;
  if (!S.analise) { S.analise = { tokens: [], ast: null, simbolos: [], erros: [], fase: "", tempos: {}, codigo: null, feitas: [] }; S.fonteAnalisada = fonte; S.exec = null; S.nos = []; S.nosContados = 0; }
  const a = S.analise;
  for (const f of FASES.slice(0, Math.min(n, 4))) {
    if (a.fase) break;                              // uma fase anterior achou erro: não vai adiante
    if (a.feitas.includes(f)) continue;
    S.ocupado = f; renderRodape();
    const r = await post("/api/fase", { fonte, fase: f });
    S.ocupado = null;
    if (!r || r.erro || S.analise !== a || ta.value !== fonte) { renderRodape(); return false; }
    aplicarFase(a, f, r);
  }
  return true;
}
async function post(url, corpo) {
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); S.semServidor = false; return await r.json(); }
  catch (e) { S.semServidor = true; renderProblemas(); return null; }
}
function indexarArvore() {
  S.nos = []; S.nosContados = 0;
  if (!S.analise?.ast) return;
  (function v(n) { n._id = S.nos.length; S.nos.push(n); if (n.no !== "Bloco") S.nosContados++; (n.filhos || []).forEach(v); })(S.analise.ast);
}
function aoEditar() {
  pausar(); S.exec = null; S.maxEtapa = 0; S.hover = S.pin = null; S.analise = null; S.fonteAnalisada = null;
  try { localStorage.setItem("portulang.fonte", ta.value); } catch (e) { /* sem armazenamento */ }
  renderEditor(); renderProblemas(); renderRodape(); renderPassos();
}

/* ------------------------------------------------------------ leitor (etapas 2 a 5) */
function construirLeitor() {
  const a = S.analise, cont = $("#leitor"); S.spans = [];
  const src = S.fonteAnalisada.split("\n"), porLinha = new Map();
  a.tokens.forEach((t, i) => { if (t.tipo === "EOF") return; if (!porLinha.has(t.linha)) porLinha.set(t.linha, []); porLinha.get(t.linha).push([t, i]); });
  const lexErr = a.erros.filter((e) => e.fase === "léxico");
  const linhasEl = src.map((texto, k) => {
    const l = k + 1, c = h("span", { class: "c" }); let cur = 0;
    const txt = (s) => (s.trim().startsWith("//") ? h("span", { class: "com" }, s) : document.createTextNode(s));
    const gap = (ate) => {
      if (ate <= cur) return; let i = cur;
      const marks = lexErr.filter((e) => e.linha === l && e.coluna - 1 >= cur && e.coluna - 1 < ate).map((e) => e.coluna - 1).sort((x, y) => x - y);
      for (const m of marks) { if (m > i) c.append(txt(texto.slice(i, m))); c.append(h("span", { class: "lex-erro" }, texto[m])); i = m + 1; }
      if (i < ate) c.append(txt(texto.slice(i, ate)));
      cur = ate;
    };
    for (const [t, i] of porLinha.get(l) || []) {
      gap(t.coluna - 1);
      const f = FAM[t.familia] || FAM.pontuacao;
      const s = h("span", { class: "tk", "data-i": i, style: { "--c": f.bg, "--f": f.fg } }, t.lexema);
      S.spans[i] = s; c.append(s); cur = t.coluna - 1 + t.lexema.length;
    }
    gap(texto.length);
    return h("div", { class: "ln" }, h("span", { class: "n" }, l), c);
  });
  cont.replaceChildren(...linhasEl);
}
function pintarLeitor() {
  const foco = S.hl.size > 0, cur = S.cur, prox = S.prox, errs = S.errTokens || new Set();
  S.spans.forEach((s, i) => {
    if (!s) return;
    s.classList.toggle("hl", S.hl.has(i));
    s.classList.toggle("cur", !!cur && i >= cur[0] && i <= cur[1]);
    s.classList.toggle("prox", !!prox && i >= prox[0] && i <= prox[1]);
    s.classList.toggle("err", errs.has(i));
  });
  $("#leitor").classList.toggle("foco", foco);
  $("#leitor").classList.toggle("cores", S.etapa === 1);
}
const faixa = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
function noQueContem(idx) { let m = null; (function v(n) { if (n.ti >= 0 && idx >= n.ti && idx <= n.tf) m = n; (n.filhos || []).forEach(v); })(S.analise.ast); return m; }
function declDe(nome) { return S.nos.find((n) => n.no === "Declaracao" && n.rotulo.endsWith(" " + nome)); }

/* ------------------------------------------------------------ destaques e dicas */
function aplicarDestaques() {
  const f = S.hover || S.pin, hl = new Set(); let tokens = [], no = null, crate = null;
  if (f && S.analise) {
    if (f.kind === "token" && S.pares?.has(f.idx)) {                     // ( ) { }: acende os dois lados
      const par = S.pares.get(f.idx);
      hl.add(f.idx); hl.add(par); tokens = [f.idx, par];
    } else if (f.kind === "token") {
      const n = S.etapa >= 2 && S.analise.ast ? noQueContem(f.idx) : null;
      if (n) { no = n._id; faixa(n.ti, n.tf).forEach((i) => hl.add(i)); } else { hl.add(f.idx); tokens = [f.idx]; }
    } else if (f.kind === "grupo") { f.tokens.forEach((i) => { hl.add(i); tokens.push(i); }); }
    else if (f.kind === "no" || f.kind === "tipo" || f.kind === "erro-sem") {
      const n = f.no; if (n && n.ti >= 0) faixa(n.ti, n.tf).forEach((i) => hl.add(i)); if (n) no = n._id ?? f.id;
    } else if (f.kind === "crate") { const d = declDe(f.nome); if (d) faixa(d.ti, d.tf).forEach((i) => hl.add(i)); crate = f.nome; }
  }
  S.hl = hl; pintarLeitor();
  cena.destacar({ tokens, no, crate });
}
const tip = $("#tooltip");
function mostrarTip(spec, x, y) {
  if (!spec) { tip.hidden = true; return; }
  tip.className = "tooltip" + (spec.erro ? " erro" : "") + (spec.larga ? " larga" : "");
  tip.replaceChildren(...[spec.cat ? h("span", { class: "cat", style: { background: spec.cor || "#eceef4", color: spec.corTexto || "#14172b" } }, spec.cat) : null, h("b", {}, spec.titulo), spec.corpo || ""].filter(Boolean));
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth - r.width - 10, Math.max(10, x + 14)) + "px";
  tip.style.top = Math.min(innerHeight - r.height - 10, y + 18) + "px";
}
function specDe(f) {
  if (f && f.kind === "fase") { const e = ETAPAS[f.i]; return { cat: `Fase ${f.i} de ${ETAPAS.length - 1}`, titulo: e.curto, corpo: e.oque, larga: true }; }
  if (!f || !S.analise) return null;
  if (f.kind === "token") { const t = S.analise.tokens[f.idx], fa = FAM[t.familia] || FAM.pontuacao; return { cat: fa.nome, cor: fa.bg, corTexto: fa.fg, titulo: t.lexema.length > 28 ? t.lexema.slice(0, 27) + "…" : t.lexema, corpo: descToken(t) }; }
  if (f.kind === "no") { const n = f.no; return { erro: n.no === "Erro", titulo: n.no === "Erro" ? `${n.codigo}: aqui quebrou` : n.rotulo, corpo: descNo(n) }; }
  if (f.kind === "tipo") { const c = CORES_TIPO[f.tipo] || FAM.pontuacao; return { cat: "tipo", cor: c.bg, corTexto: c.fg, titulo: f.tipo, corpo: "Este valor é do tipo " + f.tipo + "." }; }
  if (f.kind === "erro" || f.kind === "erro-sem") return { erro: true, titulo: f.erro.codigo, corpo: f.erro.mensagem };
  if (f.kind === "crate") { const c = S.exec?.trace[S.p]?.variaveis[f.nome]; const cc = c && (CORES_TIPO[c.tipo] || FAM.pontuacao); return c ? { cat: c.tipo, cor: cc.bg, corTexto: cc.fg, titulo: f.nome, corpo: `Caixa do tipo ${c.tipo}, guardando ${c.tipo === "texto" ? `"${c.valor}"` : c.valor}.` } : null; }
  return null;
}
cena.onHover((info, ptr) => { S.hover = info; aplicarDestaques(); mostrarTip(specDe(info), ptr.x, ptr.y); });
const chaveDe = (i) => (i ? `${i.kind}:${i.nome ?? i.id ?? i.idx ?? ""}` : "");
cena.onClick((info) => { if (info?.kind === "fase") return; S.pin = info &&chaveDe(info) !== chaveDe(S.pin) ? info : null; aplicarDestaques(); });

const leitor = $("#leitor");
leitor.addEventListener("mouseover", (ev) => {
  const s = ev.target.closest(".tk"); if (!s) return;
  const idx = +s.dataset.i; S.hover = { kind: "token", idx }; aplicarDestaques();
  const r = s.getBoundingClientRect(); mostrarTip(specDe(S.hover), r.left, r.bottom - 8);
});
leitor.addEventListener("mouseout", (ev) => { if (ev.target.closest(".tk")) { S.hover = null; aplicarDestaques(); mostrarTip(null); } });

/* ------------------------------------------------------------ etapas / navegação */
const ilha = (e) => [0, 1, 2, 2, 2, 3][e];
const NA_CENA = (e) => [0, 1, 2, 3, 3, 4][e];       // etapa do app -> etapa da cena 3D (a de código usa a ilha da semântica, coberta pelo painel)
function bloqueioDaEtapa(n = S.etapa) {
  const a = S.analise; if (!a || n === 0) return null;
  if (a.fase === "léxico") return a.erros;                    // não passa do léxico
  if (n >= 2 && a.fase === "sintático") return a.erros;
  if (n >= 3 && a.fase === "semântico") return a.erros;
  return null;
}
async function irEtapa(n) {
  if (S.ocupado) return;
  if (!(await compilarAte(n)) || !fresco()) { renderTudo(); return; }
  const antes = S.etapa; pausar(); S.hover = S.pin = null; S.tabela = false; mostrarTip(null);
  S.etapa = n; S.maxEtapa = Math.max(S.maxEtapa, n);
  if (n >= 1) construirLeitor();
  S.cur = S.prox = null; S.errTokens = new Set();
  if (n === 3 || bloqueioDaEtapa(n)) { tokensComErro(); marcarNosErro(); }
  cena.irPara(NA_CENA(n));
  const demora = ilha(n) !== ilha(antes) ? 1300 : 120;
  if (n === 3 || n === 4) setTimeout(() => { if (S.etapa === n) cena.revelarTipos(true); }, demora); else cena.revelarTipos(false);
  if (n === 5) iniciarExec();
  renderTudo(); aplicarDestaques();
}
function tokensComErro() {
  const a = S.analise; S.errTokens = new Set();
  for (const e of a.erros.filter((e) => e.fase === "semântico")) { const i = a.tokens.findIndex((t) => t.linha === e.linha && t.coluna === e.coluna); if (i >= 0) S.errTokens.add(i); }
}
function marcarNosErro() { for (const n of S.nos) if (n.no === "Erro" && n.ti >= 0) faixa(n.ti, n.tf).forEach((i) => S.errTokens.add(i)); }
function corrigir() { const e = S.analise.erros[0]; irEtapa0(); setTimeout(() => e && irParaErro(e), 60); }
function irEtapa0() {
  pausar(); S.etapa = 0; S.hover = S.pin = null; S.tabela = false; mostrarTip(null); S.cur = S.prox = null; S.errTokens = new Set(); S.hl = new Set();
  cena.irPara(0); cena.revelarTipos(false); cena.destacar({}); mostrarTip(null); renderTudo();
}
$("#btn-voltar").addEventListener("click", () => (S.etapa === 1 ? irEtapa0() : irEtapa(S.etapa - 1)));
$("#btn-avancar").addEventListener("click", () => {
  if (S.etapa === 5) return irEtapa0();
  if (bloqueioDaEtapa(S.etapa)) return corrigir();
  irEtapa(S.etapa + 1);
});
$("#btn-saiba").addEventListener("click", () => { const b = $("#saiba"); b.hidden = !b.hidden; $("#btn-saiba").setAttribute("aria-expanded", String(!b.hidden)); $("#btn-saiba").textContent = b.hidden ? "Saiba mais" : "Fechar"; });
document.addEventListener("keydown", (ev) => {
  if (["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (ev.key === "ArrowRight") $("#btn-avancar").click(); else if (ev.key === "ArrowLeft") $("#btn-voltar").click();
  else if (ev.key === " " && S.etapa === 5 && S.exec) { ev.preventDefault(); alternarPlay(); }
  else if (ev.key === "Escape") { $("#saiba").hidden = true; $("#btn-saiba").textContent = "Saiba mais"; if (document.body.classList.contains("tem-cheio")) maximizar(null); }
});

/* ------------------------------------------------------------ renderização */
function renderTudo() { renderEditor(); renderProblemas(); renderPassos(); renderCodigo(); renderRodape(); renderSobre(); }

function renderPassos() {
  const itens = [];
  ETAPAS.forEach((e, i) => {
    if (i > 0) itens.push(h("span", { class: "chev" }, "›"));
    const liberado = i === 0 || (i <= S.maxEtapa && fresco());
    const erro = fresco() && i === S.etapa && i > 0 && !!bloqueioDaEtapa(i);
    const btn = h("button", { class: `passo ${i === S.etapa ? "atual" : ""} ${erro ? "erro" : ""}`, disabled: !liberado, onclick: () => (i === 0 ? irEtapa0() : irEtapa(i)) }, e.curto);
    itens.push(h("span", {
      class: "passo-wrap",
      onmouseenter: (ev) => { const r = ev.currentTarget.getBoundingClientRect(); mostrarTip({ cat: `Etapa ${i + 1} de ${ETAPAS.length}`, titulo: e.curto, corpo: e.oque, larga: true }, r.left, r.bottom - 8); },
      onmouseleave: () => mostrarTip(null),
    }, btn));
  });
  $("#passos").replaceChildren(...itens);
}

function titulo(nome) {
  const mapa = { lexico: "léxico", sintatico: "sintático", semantico: "semântico", execucao: "execução" };
  const t = nome.replace(/^\d+_/, "").replace(/^erro_/, "Erro ").replace(/_/g, " ").split(" ").map((w) => mapa[w] || w).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function renderSeletor() {
  const box = $("#seletor");
  if (S.etapa > 0) { box.replaceChildren(h("span", { class: "rotulo" }, "Seu código")); return; }
  const bons = S.exemplos.filter((e) => !e.nome.startsWith("erro_")), ruins = S.exemplos.filter((e) => e.nome.startsWith("erro_"));
  const opt = (e) => h("option", { value: e.nome }, `Exemplo: ${titulo(e.nome)}`);
  const sel = h("select", { "aria-label": "Exemplos", onchange: (ev) => { const ex = S.exemplos.find((e) => e.nome === ev.target.value); if (ex) carregarExemplo(ex); } },
    h("option", { value: "" }, "Meu código"), h("optgroup", { label: "Exemplos" }, bons.map(opt)), ruins.length ? h("optgroup", { label: "Para ver erros" }, ruins.map(opt)) : null);
  sel.value = S.exemploAtual; box.replaceChildren(sel);
}
function carregarExemplo(e) {
  ta.value = e.fonte; S.entrada = e.entrada; S.sugestoes = e.entrada.split(/\r?\n/).filter((x) => x !== ""); S.exemploAtual = e.nome; S.nomeArquivo = ""; ta.scrollTop = 0;
  aoEditar(); renderSeletor();
}
function renderCodigo() {
  const edit = S.etapa === 0;
  $("#editor").hidden = !edit; $("#leitor").hidden = edit; $("#problemas").hidden = !edit; $("#status-div").hidden = !edit;
  $("#codigo-nota").textContent = edit ? "" : "passe o mouse nas palavras"; $("#arquivo").hidden = !edit;
  renderSeletor();
  if (!edit) pintarLeitor();
}

function renderProblemas() {
  const box = $("#problemas");
  if (S.semServidor) { box.replaceChildren(h("div", {}, "Não consegui falar com o servidor. Rode: python -m studio")); return; }
  if (!fresco()) { box.replaceChildren(h("div", { class: "mudo-msg" }, ta.value.trim() ? "Nada foi analisado ainda. Clique em “Começar” para rodar a primeira fase (análise léxica)." : "Escreva um programa ou escolha um exemplo.")); return; }
  const erros = S.analise.erros;
  if (!erros.length) { const f = S.analise.feitas.map((x) => NOME_FASE[x].replace("de ", "")); box.replaceChildren(h("div", { class: "ok" }, f.length ? `Sem problemas nas fases já feitas (${f.join(", ")}).` : "Sem problemas até agora.")); return; }
  box.replaceChildren(...erros.map((e) => h("button", { class: "prob", onclick: () => irParaErro(e) }, h("b", {}, e.codigo), h("span", {}, `Linha ${e.linha}: ${e.mensagem}`)))); 
}

function textoDaEtapa() {
  const e = ETAPAS[S.etapa], bloq = bloqueioDaEtapa();
  if (bloq) {
    const um = bloq[0];
    return { titulo: bloq.length > 1 ? `Encontrei ${bloq.length} problemas` : "Encontrei um problema", frase: `Linha ${um.linha}: ${um.mensagem}${bloq.length > 1 ? ` (e mais ${bloq.length - 1})` : ""}`, erro: true,
      saiba: `<h3>O que aconteceu</h3><ul>${bloq.map((x) => `<li><code>${x.codigo}</code> linha ${x.linha}, coluna ${x.coluna}: ${esc(x.mensagem)}${x.explicacao ? ` <i>(${esc(x.explicacao)})</i>` : ""}</li>`).join("")}</ul><p>Clique em “Corrigir no código” para voltar ao editor, já com o cursor no lugar do problema.</p>` };
  }
  if (S.etapa === 5) { const n = narracao(); return { titulo: n.erro ? n.titulo : e.titulo, frase: n.frase, erro: n.erro, saiba: e.saiba }; }
  return { titulo: e.titulo, frase: e.frase(S), saiba: e.saiba };
}
/** troca o texto e, só se ele mudou de verdade, repete a animação de entrada */
function entraSe(el, texto, extra) {
  if (el.textContent === texto) return;
  if (S.etapa === 5) { el.textContent = texto; return; }       // na execução o texto troca sem refazer a animação de entrada (menos pisca-pisca)
  el.textContent = texto;
  el.className = "";
  void el.offsetWidth;                       // reinicia a animação CSS
  el.className = `entra ${extra}`.trim();
}
function renderRodape() {
  const ok = S.analise && fresco(), bloq = bloqueioDaEtapa();
  const t = ok ? textoDaEtapa() : { titulo: ETAPAS[0].titulo, frase: ETAPAS[0].frase(), saiba: ETAPAS[0].saiba };
  $("#direita").classList.toggle("erro", !!t.erro); $("#direita").classList.toggle("exec", S.etapa === 5);
  entraSe($("#titulo"), t.titulo, "");
  entraSe($("#frase"), t.frase, "d2");
  if (S.saibaAtual !== t.saiba) { S.saibaAtual = t.saiba; $("#saiba-corpo").innerHTML = t.saiba; }      // só troca quando muda (evita refazer o painel a cada passo)
  const av = $("#btn-avancar"), vo = $("#btn-voltar");
  vo.disabled = S.etapa === 0; vo.style.visibility = S.etapa === 0 ? "hidden" : "visible";
  av.disabled = !!S.ocupado || (S.etapa === 0 && !ta.value.trim()); av.classList.toggle("erro", !!bloq);
  av.textContent = S.ocupado ? `Rodando a etapa ${NOME_FASE[S.ocupado]}…` : bloq ? "Corrigir no código" : S.etapa === 0 ? "Começar →" : S.etapa === 5 ? "Novo programa" : "Continuar →";
  renderTempo(ok);
}
/** "tempo real" da fase: medido no servidor (Python), só dessa fase */
function fmtTempo(ms) {
  if (ms == null) return "";
  if (ms < 0.001) return "menos de 1 µs";
  if (ms < 1) return `${Math.round(ms * 1000)} µs`;
  return `${ms.toFixed(ms < 10 ? 2 : 1).replace(".", ",")} ms`;
}
function renderTempo(ok) {
  const el = $("#tempo"), a = S.analise; let txt = "", dica = "";
  if (ok && S.etapa >= 1 && S.etapa <= 4) {
    const f = FASES[S.etapa - 1], ms = a.tempos[f];
    if (ms != null) {
      const extra = f === "lexico" ? `${plural(a.tokens.length - 1, "token", "tokens")}` : f === "codigo" ? `${plural(a.python.length, "linha", "linhas")} de Python` : f === "semantico" ? `${plural(a.simbolos.length, "símbolo", "símbolos")}` : `${plural(S.nosContados, "nó", "nós")}`;
      txt = `⏱ ${fmtTempo(ms)} · ${extra}`; dica = "Tempo real que o Python levou para rodar só esta etapa (medido agora, no servidor).";
    }
  } else if (ok && S.etapa === 5 && S.exec) {
    txt = `⏱ ${fmtTempo(S.exec.tempo_ms)} · ${plural(S.exec.passos, "passo", "passos")}`;
    if (S.exec.vm_confere === true) txt += " · máquina virtual ✓ mesmo resultado";
    else if (S.exec.vm_confere === false) txt += " · máquina virtual ✗ resultado diferente";
    dica = "Tempo do interpretador rodando o programa inteiro. A máquina virtual executa o código gerado e o Studio confere se a saída é igual.";
  }
  el.textContent = txt; el.title = dica; el.hidden = !txt;
}

/* ---- sobre a cena e legenda ---- */
const refs = {};
function renderSobre() {
  const caixa = $("#sobre"), kids = [], a = S.analise, ok = a && fresco();
  if (ok && S.etapa === 4 && a.codigo) kids.push(painelCodigo());
  if (ok && S.etapa === 5) kids.push(...painelExec());
  if (ok && S.tabela && (S.etapa === 1 || S.etapa === 3)) kids.push(painelTabela());
  kids.push(h("div", { class: "flutuante ferramentas" },
    ok && (S.etapa === 1 || S.etapa === 3) ? h("button", { class: S.tabela ? "ativo" : "", title: S.etapa === 1 ? "Ver a tabela de tokens" : "Ver a tabela de símbolos", onclick: () => { S.tabela = !S.tabela; renderSobre(); } }, ico("tabela", true)) : null,
    h("button", { title: "Voltar ao enquadramento inicial (duplo clique)", onclick: () => cena.centralizar() }, ico("centrar", true)),
    S.etapa === 1 || S.etapa === 2 ? h("button", { title: "Ver a animação de novo", onclick: () => cena.replay() }, ico("replay", true)) : null));
  caixa.replaceChildren(...kids);
  renderLegenda();
  if (S.etapa === 5) atualizarControles();
}
/** cor da bolinha da legenda: no escuro usa o tom vivo do texto; no claro, o fundo pastel */
function corBola(c, chave) {
  if (S.tema !== "escuro") return c.bg;
  return chave === "nome" ? "#7a80ab" : c.fg;
}
function renderLegenda() {
  const box = $("#legenda"), a = S.analise, ok = a && fresco(), itens = [];
  const bola = (bg) => h("span", { class: "bola", style: { background: bg } });
  if (ok && S.etapa === 1) {
    [...new Set(a.tokens.filter((t) => t.tipo !== "EOF").map((t) => t.familia))].forEach((f) => itens.push(h("span", {
      class: "leg",
      onmouseenter: () => { S.hover = { kind: "grupo", tokens: a.tokens.map((t, i) => (t.familia === f ? i : -1)).filter((i) => i >= 0) }; aplicarDestaques(); },
      onmouseleave: () => { S.hover = null; aplicarDestaques(); },
    }, bola(corBola(FAM[f], f)), FAM[f].nome)));
  } else if (ok && S.etapa === 2 && a.ast) {
    [["comando", "reservada"], ["operação", "operacao"], ["número", "numero"], ["texto", "texto"], ["nome", "nome"]].forEach(([n, k]) => itens.push(h("span", { class: "leg" }, bola(corBola(FAM[k], k)), n)));
  } else if (ok && S.etapa === 3) {
    if (a.simbolos.length) a.simbolos.forEach((s) => {
      const c = CORES_TIPO[s.tipo] || FAM.pontuacao;
      itens.push(h("span", {
        class: "leg",
        onmouseenter: () => { const d = S.nos.find((n) => n.no === "Declaracao" && n.linha === s.linha && n.rotulo.endsWith(" " + s.nome)); if (d) { S.hover = { kind: "no", id: d._id, ti: d.ti, tf: d.tf, no: d }; aplicarDestaques(); } },
        onmouseleave: () => { S.hover = null; aplicarDestaques(); },
      }, h("b", {}, s.nome), h("span", { class: "pilula", style: { background: c.bg, color: c.fg } }, s.tipo)));
    });
    else Object.entries(CORES_TIPO).forEach(([t, c]) => itens.push(h("span", { class: "leg" }, bola(corBola(c, "")), t)));
  }
  const dica = !ok ? "" : bloqueioDaEtapa() ? (S.etapa === 2 ? "Os blocos vermelhos mostram onde a estrutura quebrou · passe o mouse neles" : "Passe o mouse na peça vermelha para ver o problema") : S.etapa === 5 && !S.exec ? "" : ETAPAS[S.etapa].dica;
  $("#dica").textContent = dica;
  box.replaceChildren(...itens);
}
function painelTabela() {
  const a = S.analise; let cab, linhas, titulo;
  const pil = (txt, c) => h("span", { class: "pilula", style: { background: c.bg, color: c.fg } }, txt);
  if (S.etapa === 1) {
    titulo = "Tabela de tokens"; cab = ["#", "Token", "Texto", "Posição", "Família"];
    linhas = a.tokens.map((t, i) => ({ t, i })).filter((o) => o.t.tipo !== "EOF").map(({ t, i }) => {
      const f = FAM[t.familia] || FAM.pontuacao;
      return h("tr", { onmouseenter: () => { S.hover = { kind: "token", idx: i }; aplicarDestaques(); }, onmouseleave: () => { S.hover = null; aplicarDestaques(); } },
        h("td", { class: "mudo" }, i + 1), h("td", { class: "mono" }, t.tipo), h("td", { class: "mono" }, t.lexema), h("td", { class: "mudo" }, `${t.linha}:${t.coluna}`), h("td", {}, pil(f.nome, f)));
    });
  } else {
    titulo = "Tabela de símbolos"; cab = ["Nome", "Tipo", "Linha", "Escopo"];
    linhas = a.simbolos.map((s) => {
      const c = CORES_TIPO[s.tipo] || FAM.pontuacao;
      return h("tr", {
        onmouseenter: () => { const d = S.nos.find((n) => n.no === "Declaracao" && n.linha === s.linha && n.rotulo.endsWith(" " + s.nome)); if (d) { S.hover = { kind: "no", id: d._id, ti: d.ti, tf: d.tf, no: d }; aplicarDestaques(); } },
        onmouseleave: () => { S.hover = null; aplicarDestaques(); },
      }, h("td", { class: "mono" }, s.nome), h("td", {}, pil(s.tipo, c)), h("td", { class: "mudo" }, s.linha), h("td", { class: "mudo" }, s.escopo === 0 ? "global" : `bloco ${s.escopo}`));
    });
    if (!linhas.length) linhas = [h("tr", {}, h("td", { colspan: 4, class: "mudo" }, "Nenhuma variável declarada."))];
  }
  return h("div", { class: "flutuante tabela" },
    h("div", { class: "tabela-topo" }, h("b", {}, `${titulo} · ${S.etapa === 1 ? plural(linhas.length, "peça", "peças") : plural(a.simbolos.length, "variável", "variáveis")}`),
      h("button", { class: "link", onclick: () => { S.tabela = false; renderSobre(); } }, "Fechar")),
    h("div", { class: "tabela-rolar" }, h("table", {}, h("thead", {}, h("tr", {}, cab.map((x) => h("th", {}, x)))), h("tbody", {}, linhas))));
}
/** etapa "Código": a lista de instruções; passar o mouse acende, no código, o trecho que gerou a instrução */
function painelInstrucoes() {
  const a = S.analise, cod = a.codigo, dois = (n) => String(n).padStart(2, "0");
  const GRUPO = { EMPILHAR: "dado", CARREGAR: "dado", CRIAR: "dado", GUARDAR: "dado", LER: "es", ESCREVER: "es", SALTAR: "salto", SALTAR_SE_FALSO: "salto", CURTO_E: "salto", CURTO_OU: "salto", ENTRAR_BLOCO: "bloco", SAIR_BLOCO: "bloco", PARAR: "bloco" };
  const alvos = new Set(cod.filter((i) => i.alvo != null).map((i) => i.alvo));
  const linhas = cod.map((i) => h("tr", {
    class: alvos.has(i.end) ? "alvo" : "",
    onmouseenter: () => { if (i.ti >= 0) { S.hover = { kind: "grupo", tokens: faixa(i.ti, i.tf) }; aplicarDestaques(); } },
    onmouseleave: () => { S.hover = null; aplicarDestaques(); },
  }, h("td", { class: "mudo mono" }, dois(i.end)), h("td", {}, h("span", { class: `op op-${GRUPO[i.op] || "conta"}` }, i.op)),
    h("td", { class: "mono" }, i.alvo != null ? `→ ${dois(i.alvo)}` : i.arg), h("td", { class: "mudo" }, i.expl), h("td", { class: "mudo mono" }, `L${i.linha}`)));
  return h("div", { class: "flutuante tabela" },
    h("div", { class: "tabela-topo" }, abasCodigo(), h("span", { class: "nota" }, `${plural(cod.length, "instrução", "instruções")} · fundo marcado = destino de um salto`)),
    h("div", { class: "tabela-rolar" }, h("table", { class: "cod" }, h("thead", {}, h("tr", {}, ["#", "Instrução", "Dado", "O que faz", "Linha"].map((x) => h("th", {}, x)))), h("tbody", {}, linhas))));
}
/* ---- etapa "Código": o programa traduzido para Python (principal) ou como instruções de uma máquina de pilha ---- */
S.vistaCodigo = "python";
function abasCodigo() {
  const aba = (id, txt) => h("button", { class: `aba ${S.vistaCodigo === id ? "ativa" : ""}`, onclick: () => { S.vistaCodigo = id; S.hover = null; aplicarDestaques(); renderSobre(); } }, txt);
  return h("div", { class: "abas" }, aba("python", "Python"), aba("maquina", "Instruções da máquina"));
}
function textoPython() {
  const a = S.analise;
  return `${a.prelude}\n\n# --- seu programa ---\n${a.python.map((l) => "    ".repeat(l.ind) + l.t).join("\n")}\n`;
}
const PY_KW = new Set(["if", "elif", "else", "while", "and", "or", "not", "pass", "def", "return", "raise", "try", "except", "True", "False"]);
function colorirPython(t) {
  const out = []; let ult = 0;
  for (const m of t.matchAll(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\d+\.\d+|\d+|[A-Za-z_]\w*/g)) {
    const w = m[0]; let c = "";
    if (w[0] === "'" || w[0] === '"') c = "c-str"; else if (/^\d/.test(w)) c = "c-num"; else if (PY_KW.has(w)) c = "c-kw"; else if (/^_[a-z]/.test(w)) c = "c-fn";
    if (!c) continue;
    if (m.index > ult) out.push(t.slice(ult, m.index));
    out.push(h("span", { class: c }, w)); ult = m.index + w.length;
  }
  if (ult < t.length) out.push(t.slice(ult));
  return out;
}
function painelPython() {
  const a = S.analise, py = a.python;
  const linhas = py.map((l, i) => h("div", {
    class: `pl ${l.ti >= 0 ? "liga" : ""}`,
    onmouseenter: () => { if (l.ti >= 0) { S.hover = { kind: "grupo", tokens: faixa(l.ti, l.tf) }; aplicarDestaques(); } },
    onmouseleave: () => { S.hover = null; aplicarDestaques(); },
  }, h("span", { class: "n" }, i + 1), h("span", { class: "t", style: { paddingLeft: `${l.ind * 2.4}ch` } }, colorirPython(l.t))));
  const copiar = h("button", { class: "mini", onclick: async (ev) => { try { await navigator.clipboard.writeText(textoPython()); ev.target.textContent = "Copiado ✓"; setTimeout(() => (ev.target.textContent = "Copiar"), 1500); } catch (e) { ev.target.textContent = "Não consegui copiar"; } } }, "Copiar");
  const baixar = h("button", { class: "mini", title: "Baixa um arquivo .py que roda sozinho com: python programa.py", onclick: () => {
    const url = URL.createObjectURL(new Blob([textoPython()], { type: "text/x-python;charset=utf-8" }));
    const l = h("a", { href: url, download: ((S.nomeArquivo || S.exemploAtual || "programa").replace(/\.[^.]*$/, "") || "programa") + ".py" }); document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  } }, "Baixar .py");
  const prel = h("details", { class: "prelude" }, h("summary", {}, "Funções auxiliares (a PortuLang usa para ler, escrever e dividir)"), h("pre", {}, a.prelude));
  return h("div", { class: "flutuante tabela" },
    h("div", { class: "tabela-topo" }, abasCodigo(), h("span", { class: "acoes" }, copiar, baixar)),
    h("div", { class: "tabela-rolar pycod" }, h("div", { class: "pynota" }, "Este é o seu programa traduzido para Python. Passe o mouse numa linha para ver de onde ela veio."), linhas, prel));
}
function painelCodigo() { return S.vistaCodigo === "maquina" ? painelInstrucoes() : painelPython(); }
function painelSimbolos() {
  const sims = S.analise.simbolos;
  return h("div", { class: "flutuante simbolos" }, h("h4", {}, "Variáveis"),
    sims.length ? sims.map((s) => {
      const c = CORES_TIPO[s.tipo] || FAM.pontuacao;
      return h("div", {
        class: "simbolo",
        onmouseenter: () => { const d = S.nos.find((n) => n.no === "Declaracao" && n.linha === s.linha && n.rotulo.endsWith(" " + s.nome)); if (d) { S.hover = { kind: "no", id: d._id, ti: d.ti, tf: d.tf, no: d }; aplicarDestaques(); } },
        onmouseleave: () => { S.hover = null; aplicarDestaques(); },
      }, h("b", {}, s.nome), h("span", { class: "pilula", style: { background: c.bg, color: c.fg } }, s.tipo), h("span", { class: "linha" }, `linha ${s.linha}`));
    }) : h("div", { class: "nota" }, "Nenhuma variável."));
}

/* ------------------------------------------------------------ execução (etapa 5) */
const temLer = () => S.analise.tokens.some((t) => t.tipo === "LER");
S.entradas = []; S.sugestoes = [];
function iniciarExec() { S.p = 0; S.entradas = []; rodar(0); }
/** Roda do começo com os valores já digitados. Se o programa pedir mais um valor, `aguardando` volta true e a barra de digitação aparece. */
async function rodar(posicao = 0, manter = false, seguir = true) {
  const r = await post("/api/executar", { fonte: S.fonteAnalisada, entrada: S.entradas.join("\n") });
  if (!r || !r.executou) return;
  S.exec = r; S.p = Math.min(posicao, r.trace.length - 1);
  if (!manter) cena.execReiniciar();       // manter = continua na mesma sala (depois de digitar um valor): nada é refeito, o robô segue de onde parou
  cena.execVelocidade(S.vel);
  if (!manter) renderSobre();       // depois de digitar um valor a barra de controles continua a mesma (nada pisca)
  atualizarExec(manter);
  if (seguir && S.p < r.trace.length - 1) tocar();       // seguir=false: quem está avançando passo a passo continua no comando dele
}
/** o que foi digitado chega da API marcado com \x01 e é colado na linha do pedido */
const limpaTela = (s) => s.replace(/\n\u0001/g, "").replace(/\u0001/g, "");
function enviarEntrada(seguir = true) {
  const ex = S.exec; if (!ex || !ex.aguardando) return;
  const sug = S.sugestoes[S.entradas.length];
  S.entradas.push(refs.entrada.value !== "" ? refs.entrada.value : (sug ?? ""));
  refs.entrada.value = ""; cena.execDigitando(null);
  rodar(ex.trace.length - 1, true, seguir);  // roda de novo por baixo, mas a sala continua a mesma; o passo que recebeu o valor é animado
}
function painelExec() {
  if (!S.exec) return [];
  refs.cont = h("span", { class: "cont" });
  refs.play = h("button", { class: "play", title: "Reproduzir / pausar (espaço)", onclick: alternarPlay }, ico("play"));
  const vel = h("select", { onchange: (ev) => { S.vel = +ev.target.value; cena.execVelocidade(S.vel); }, title: "Velocidade" }, [[0.5, "0,5×"], [1, "1×"], [2, "2×"], [4, "4×"]].map(([v, t]) => h("option", { value: v, selected: v === S.vel }, t)));
  const ir = (f) => () => { pausar(); irPasso(f(S.p)); };
  refs.prompt = h("span", { class: "terminal-prompt" });
  refs.entrada = h("input", { class: "terminal-in", type: "text", autocomplete: "off", spellcheck: "false", onkeydown: (ev) => { ev.stopPropagation(); if (ev.key === "Enter") enviarEntrada(); }, oninput: () => cena.execDigitando(refs.entrada.value) });
  refs.barra = h("div", { class: "flutuante barra-entrada", hidden: true }, h("span", { class: "terminal-seta" }, "›"), refs.prompt, refs.entrada, h("button", { class: "link", onclick: enviarEntrada }, "Enviar ↵"));
  return [refs.barra, h("div", { class: "flutuante controles" },
    h("button", { title: "Início", onclick: ir(() => 0) }, ico("first")), h("button", { title: "Passo anterior", onclick: ir((p) => p - 1) }, ico("prev")), refs.play,
    h("button", { title: "Próximo passo (se o programa estiver esperando um valor, envia o que você digitou)", onclick: proximoPasso }, ico("next")), h("button", { title: "Ir ao fim", onclick: ir(() => 1e9) }, ico("last")),
    h("button", { title: "Reiniciar só a execução (mantém o que você digitou)", onclick: reiniciarExec }, ico("replay", true)),
    temLer() ? h("button", { title: "Apagar o que foi digitado e começar de novo", onclick: () => { pausar(); S.entradas = []; rodar(0); } }, ico("editar", true)) : null,
    refs.cont, vel)];
}function reiniciarExec() { pausar(); rodar(0); }
/** "Próximo passo": se o programa está parado esperando um valor, o próprio clique envia o que foi digitado (ou o valor sugerido) e anima o ler(); senão, avança um passo */
function proximoPasso() {
  pausar();
  const ex = S.exec; if (!ex) return;
  if (ex.aguardando && S.p >= ex.trace.length - 1) {
    if (refs.barra?.hidden) return;                                  // o robô ainda está chegando; a barra ainda não apareceu
    if (refs.entrada.value === "" && S.sugestoes[S.entradas.length] === undefined) { refs.entrada.focus(); return; }   // nada digitado: leva o cursor para a barra
    enviarEntrada(false); return;
  }
  irPasso(S.p + 1);
}
function irPasso(p) { const M = S.exec.trace.length - 1, novo = Math.max(0, Math.min(M, p)), animado = novo === S.p + 1; S.p = novo; atualizarExec(animado); }   // só o passo seguinte é animado; pulos vão direto ao estado
/** Reprodução contínua: o próximo passo só começa quando o robô terminou o anterior, então nunca há corte no meio do movimento. */
function tocar() {
  if (!S.exec) return; const M = S.exec.trace.length - 1;
  pausar();
  if (S.p >= M) { S.p = 0; atualizarExec(false); }
  S.timer = setTimeout(proximoAuto, 0); atualizarControles();
}
function proximoAuto() {
  if (!S.exec || !S.timer) return;
  const M = S.exec.trace.length - 1;
  if (S.p >= M) { pausar(); return; }
  if (cena.execOcioso()) { S.p++; atualizarExec(true); S.timer = setTimeout(proximoAuto, 160 / S.vel); }
  else S.timer = setTimeout(proximoAuto, 40);
}
function pausar() { if (S.timer) { clearTimeout(S.timer); S.timer = null; } if (S.etapa === 5) atualizarControles(); }
function alternarPlay() { if (S.timer) pausar(); else tocar(); }
function atualizarControles() {
  if (!S.exec || !refs.cont || !refs.cont.isConnected) return;
  const M = S.exec.trace.length - 1, ag = !!S.exec.aguardando; refs.cont.textContent = S.p >= M ? (ag ? "esperando você" : "fim") : (ag ? `passo ${S.p}` : `passo ${S.p} de ${M}`);      // "fim" só quando o programa acabou de verdade
  const est = S.timer ? "pause" : "play"; if (refs.play.dataset.est !== est) { refs.play.dataset.est = est; refs.play.replaceChildren(ico(est)); }
}

function trecho(ti, tf) {
  const T = S.analise.tokens, a = T[ti], b = T[tf], src = S.fonteAnalisada.split("\n");
  if (!a || !b) return "";
  if (a.linha === b.linha) return src[a.linha - 1].slice(a.coluna - 1, b.coluna - 1 + b.lexema.length);
  return T.slice(ti, tf + 1).map((t) => t.lexema).join(" ");
}
function focoDe(en) {
  if (!en) return null; const T = S.analise.tokens;
  if (en.no === "Declaracao") return { tipo: "var", nome: T[en.ti + 1].lexema };
  if (en.no === "Atribuicao") return { tipo: "var", nome: T[en.ti].lexema };
  if (en.no === "Leitura") return { tipo: "var", nome: T[en.ti + 2].lexema };
  if (en.no === "Escrita") return { tipo: "tela" };
  return null;
}
const fmt = (v, tipoTexto) => (tipoTexto ? `“${v}”` : v);
function narracao() {
  const ex = S.exec; if (!ex) return { titulo: "Execução", frase: temLer() ? "Digite os valores que o programa vai pedir e clique em “Rodar o programa”." : "Preparando a execução…" };
  const tr = ex.trace, M = tr.length - 1, p = S.p, en = p > 0 ? tr[p - 1] : null, T = S.analise.tokens;
  const fim = p === M, erro = ex.erros_exec[0];
  if (p === 0) return { titulo: "Execução", frase: M === 0 ? "O programa está vazio: não há nenhum comando para executar." : "O computador vai executar os comandos de cima para baixo. Aperte ▶ para ver, passo a passo." };
  if (ex.aguardando && p === M) { const nome = en && en.no === "Leitura" ? T[en.ti + 2].lexema : "valor"; return { titulo: "Execução", frase: `O programa parou e espera você digitar o valor de “${nome}”. Escreva na barra abaixo e tecle Enter.` }; }
  if (fim && erro) return { titulo: "O programa parou com um erro", frase: `${erro.mensagem}.`, erro: true };
  let frase = "";
  switch (en.no) {
    case "Declaracao": { const tp = T[en.ti].lexema, nome = T[en.ti + 1].lexema; frase = `Cria a caixa “${nome}” (do tipo ${tp}) e guarda nela ${fmt(en.valor, tp === "texto")}.`; break; }
    case "Atribuicao": { const nome = T[en.ti].lexema, tp = tr[p].variaveis[nome]?.tipo; frase = `Faz a conta “${trecho(en.ti + 2, en.tf - 1)}” e guarda o resultado, ${fmt(en.valor, tp === "texto")}, na caixa “${nome}”.`; break; }
    case "Leitura": { const nome = T[en.ti + 2].lexema; frase = `Espera o usuário digitar um valor e guarda ${fmt(en.valor, tr[p].variaveis[nome]?.tipo === "texto")} na caixa “${nome}”.`; break; }
    case "Escrita": frase = `Mostra na tela: ${en.texto === "" ? "(uma linha vazia)" : `“${en.texto}”`}.`; break;
    case "Se": frase = `Pergunta: ${trecho(en.ti + 2, en.tf - 1)}? A resposta é ${en.condicao ? "VERDADEIRO, então entra no bloco." : "FALSO, então pula o bloco."}`; break;
    case "Enquanto": frase = `Confere a condição: ${trecho(en.ti + 2, en.tf - 1)}? A resposta é ${en.condicao ? "VERDADEIRO, então repete o bloco." : "FALSO, então sai da repetição."}`; break;
  }
  if (fim) frase += " Fim do programa!";
  return { titulo: "Execução", frase };
}
/** a barra de digitação só aparece quando o robô terminou de andar (senão ela surgiria no meio do movimento) */
function atualizarBarra() {
  const ex = S.exec; if (!ex || !refs.barra || !refs.barra.isConnected) return;
  const tr = ex.trace, M = tr.length - 1, p = S.p, est = tr[p], espera = !!ex.aguardando && p === M;
  if (espera && !cena.execOcioso()) { refs.barra.hidden = true; clearTimeout(S.pollBarra); S.pollBarra = setTimeout(atualizarBarra, 80); return; }
  const nova = refs.barra.hidden && espera;
  refs.barra.hidden = !espera;
  if (!espera) cena.execDigitando(null);
  if (espera) {
    cena.execDigitando(refs.entrada.value);
    const T = S.analise.tokens, pedido = tr[M - 1] && tr[M - 1].no === "Leitura" ? T[tr[M - 1].ti + 2].lexema : "";
    refs.prompt.textContent = (limpaTela(ex.saida.slice(0, est.saida)).split("\n").filter(Boolean).pop() || "").trimEnd() + " ";
    const sug = S.sugestoes[S.entradas.length];
    refs.entrada.placeholder = sug !== undefined ? `${sug}  (Enter aceita)` : `valor de ${pedido}`;
    if (nova) setTimeout(() => refs.entrada.focus(), 60);
  }
}
function atualizarExec(animado = false) {
  const ex = S.exec; if (!ex) return;
  const tr = ex.trace, M = tr.length - 1, p = S.p, est = tr[p], en = p > 0 ? tr[p - 1] : null, prox = p < M ? tr[p] : null;
  cena.execEstado({ variaveis: est.variaveis, saida: limpaTela(ex.saida.slice(0, est.saida)), foco: focoDe(en) }, { instante: !animado });
  atualizarBarra();
  S.cur = en && en.ti >= 0 ? [en.ti, en.tf] : null; S.prox = prox && prox.ti >= 0 ? [prox.ti, prox.tf] : null;
  S.errTokens = new Set();
  if (p === M && ex.erros_exec[0]) { const e = ex.erros_exec[0], i = S.analise.tokens.findIndex((t) => t.linha === e.linha && t.coluna === e.coluna); if (i >= 0) S.errTokens.add(i); }
  atualizarControles(); renderRodape(); pintarLeitor();
  const cur = document.querySelector(".tk.cur"); cur?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ------------------------------------------------------------ início */
async function iniciar() {
  let salvo = null; try { salvo = localStorage.getItem("portulang.fonte"); } catch (e) { /* ignora */ }
  try { S.exemplos = await (await fetch("/api/exemplos")).json(); } catch (e) { S.exemplos = []; }
  if (salvo) ta.value = salvo; else if (S.exemplos.length) { ta.value = S.exemplos[0].fonte; S.entrada = S.exemplos[0].entrada; S.sugestoes = S.exemplos[0].entrada.split(/\r?\n/).filter((x) => x !== ""); S.exemploAtual = S.exemplos[0].nome; }
  ta.addEventListener("input", () => { S.exemploAtual = ""; S.sugestoes = []; aoEditar(); renderSeletor(); });
  ta.addEventListener("scroll", syncScroll);
  ta.addEventListener("keydown", (ev) => {
    const inserir = (txt) => { if (!document.execCommand("insertText", false, txt)) ta.setRangeText(txt, ta.selectionStart, ta.selectionEnd, "end"); };
    if (ev.key === "Tab") { ev.preventDefault(); inserir("    "); }
    else if (ev.key === "Enter") { ev.preventDefault(); const antes = ta.value.slice(0, ta.selectionStart), linha = antes.slice(antes.lastIndexOf("\n") + 1); let ind = linha.match(/^\s*/)[0]; if (/\{\s*$/.test(linha)) ind += "    "; inserir("\n" + ind); }
    else if (ev.key === "}") { const antes = ta.value.slice(0, ta.selectionStart), linha = antes.slice(antes.lastIndexOf("\n") + 1); if (/^ +$/.test(linha) && linha.length >= 4) { ev.preventDefault(); ta.setSelectionRange(ta.selectionStart - 4, ta.selectionStart); inserir("}"); } }
  });
  renderTudo();
}
/* ------------------------------------------------------------ tema claro / escuro */
const ICONE_LUA = '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
const ICONE_SOL = '<svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>';
const ICONE_SISTEMA = '<svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
const escuroDoSistema = () => !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
/** pref: "sistema" (padrão, segue o computador), "claro" ou "escuro" */
function aplicarTema(pref) {
  S.prefTema = pref;
  const nome = pref === "sistema" ? (escuroDoSistema() ? "escuro" : "claro") : pref;
  S.tema = nome; document.documentElement.dataset.tema = nome;
  try { localStorage.setItem("portulang.tema", pref); } catch (e) { /* sem armazenamento */ }
  const b = $("#btn-tema");
  b.innerHTML = pref === "sistema" ? ICONE_SISTEMA : nome === "escuro" ? ICONE_LUA : ICONE_SOL;
  b.title = `Tema: ${pref === "sistema" ? "automático (segue o sistema)" : nome}. Clique para trocar`;
  cena.setTema(nome);
  if (S.analise) {
    cena.mostrarPrograma(S.analise);
    if (S.etapa >= 1) construirLeitor();
    renderTudo();
    if (S.etapa === 5 && S.exec) atualizarExec();
  }
}
$("#btn-tema").addEventListener("click", () => aplicarTema({ sistema: "claro", claro: "escuro", escuro: "sistema" }[S.prefTema] || "sistema"));
if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (S.prefTema === "sistema") aplicarTema("sistema"); });
let temaSalvo = "sistema"; try { temaSalvo = localStorage.getItem("portulang.tema") || "sistema"; } catch (e) { /* ignora */ }aplicarTema(temaSalvo);

/* ------------------------------------------------------------ painéis: divisor arrastável e tela cheia */
const palco = $("#palco"), divisor = $("#divisor");
let prop = 0.44;
try { const s = parseFloat(localStorage.getItem("portulang.prop")); if (s > 0.2 && s < 0.8) prop = s; } catch (e) { /* ignora */ }
function aplicarProporcao(r) { palco.style.setProperty("--esq", `${(r * 100).toFixed(2)}fr`); palco.style.setProperty("--dir", `${((1 - r) * 100).toFixed(2)}fr`); }
aplicarProporcao(prop);
divisor.addEventListener("pointerdown", (ev) => { try { divisor.setPointerCapture(ev.pointerId); } catch (e) { /* sem ponteiro ativo */ } divisor.classList.add("arrasta"); document.body.style.userSelect = "none"; });
divisor.addEventListener("pointermove", (ev) => {
  if (!divisor.classList.contains("arrasta")) return;
  const r = palco.getBoundingClientRect(), cs = getComputedStyle(palco);
  const util = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 28;
  prop = Math.min(0.78, Math.max(0.22, (ev.clientX - r.left - parseFloat(cs.paddingLeft) - 14) / util));
  aplicarProporcao(prop);
});
const soltar = () => { divisor.classList.remove("arrasta"); document.body.style.userSelect = ""; try { localStorage.setItem("portulang.prop", String(prop)); } catch (e) { /* ignora */ } };
divisor.addEventListener("pointerup", soltar); divisor.addEventListener("pointercancel", soltar);
divisor.addEventListener("dblclick", () => { prop = 0.44; aplicarProporcao(prop); soltar(); });

const ICO_EXPANDIR = '<svg viewBox="0 0 24 24"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>';
const ICO_RECOLHER = '<svg viewBox="0 0 24 24"><path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/></svg>';
function maximizar(qual) {
  const cartoes = { esq: document.querySelector(".codigo"), dir: $("#direita") };
  const atual = cartoes.esq.classList.contains("cheio") ? "esq" : cartoes.dir.classList.contains("cheio") ? "dir" : null;
  for (const q in cartoes) cartoes[q].classList.remove("cheio");
  if (qual && qual !== atual) cartoes[qual].classList.add("cheio");        // o cartão cobre a janela inteira
  const agora = cartoes.esq.classList.contains("cheio") ? "esq" : cartoes.dir.classList.contains("cheio") ? "dir" : null;
  document.body.classList.toggle("tem-cheio", !!agora);
  for (const q of ["esq", "dir"]) { const b = $(`#max-${q}`); b.innerHTML = agora === q ? ICO_RECOLHER : ICO_EXPANDIR; b.title = agora === q ? "Voltar ao tamanho normal (Esc)" : (q === "esq" ? "Código em tela cheia (Esc volta)" : "Análise em tela cheia (Esc volta)"); }
}$("#max-esq").addEventListener("click", () => maximizar("esq"));
$("#max-dir").addEventListener("click", () => maximizar("dir"));
maximizar(null);

/* ------------------------------------------------------------ "Saiba mais": fecha no X; rolagem fica dentro da janela */
function fecharSaiba() { $("#saiba").hidden = true; const b = $("#btn-saiba"); b.textContent = "Saiba mais"; b.setAttribute("aria-expanded", "false"); }
$("#saiba-x").addEventListener("click", fecharSaiba);
$("#saiba").addEventListener("wheel", (ev) => ev.stopPropagation(), { passive: true });

/* ------------------------------------------------------------ lista de erros com altura ajustável */
const sdiv = $("#status-div"), cartaoCodigo = document.querySelector(".codigo");
sdiv.addEventListener("pointerdown", (ev) => { try { sdiv.setPointerCapture(ev.pointerId); } catch (e) { /* sem ponteiro ativo */ } sdiv.classList.add("arrasta"); document.body.style.userSelect = "none"; });
sdiv.addEventListener("pointermove", (ev) => {
  if (!sdiv.classList.contains("arrasta")) return;
  const r = cartaoCodigo.getBoundingClientRect();
  cartaoCodigo.style.setProperty("--status-h", `${Math.min(r.height * 0.75, Math.max(56, r.bottom - ev.clientY - 6))}px`);
});
const soltaStatus = () => { sdiv.classList.remove("arrasta"); document.body.style.userSelect = ""; };
sdiv.addEventListener("pointerup", soltaStatus); sdiv.addEventListener("pointercancel", soltaStatus);
sdiv.addEventListener("dblclick", () => cartaoCodigo.style.removeProperty("--status-h"));

window.__app = { S, cena };
iniciar();


/* ------------------------------------------------------------ abrir / salvar arquivo .pl */
async function abrirArquivo(f) {
  if (!f) return;
  if (f.size > 500000) { $("#problemas").replaceChildren(h("div", {}, "Esse arquivo é grande demais para um programa PortuLang (limite de 500 KB).")); return; }
  ta.value = (await f.text()).replace(/\r\n?/g, "\n"); ta.scrollTop = 0;
  S.exemploAtual = ""; S.sugestoes = []; S.nomeArquivo = f.name;
  if (S.etapa !== 0) irEtapa0();
  aoEditar(); renderSeletor();
}
function salvarArquivo() {
  let nome = (S.nomeArquivo || (S.exemploAtual ? `${S.exemploAtual}` : "programa")).replace(/[\\/:*?"<>|]/g, "_");
  if (!/\.(pl|ptl)$/i.test(nome)) nome = nome.replace(/\.[^.]*$/, "") + ".pl";
  const url = URL.createObjectURL(new Blob([ta.value.replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" }));
  const a = h("a", { href: url, download: nome }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$("#btn-abrir").addEventListener("click", () => $("#entrada-arquivo").click());
$("#entrada-arquivo").addEventListener("change", async (ev) => { await abrirArquivo(ev.target.files[0]); ev.target.value = ""; });
$("#btn-salvar").addEventListener("click", salvarArquivo);
const editorEl = $("#editor");
editorEl.addEventListener("dragover", (ev) => { if (ev.dataTransfer?.types?.includes("Files")) { ev.preventDefault(); editorEl.classList.add("solta"); } });
editorEl.addEventListener("dragleave", () => editorEl.classList.remove("solta"));
editorEl.addEventListener("drop", async (ev) => { ev.preventDefault(); editorEl.classList.remove("solta"); await abrirArquivo(ev.dataTransfer.files[0]); });




