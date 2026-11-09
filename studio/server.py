"""Servidor local do PortuLang Studio (somente biblioteca padrão)."""
import json
import os
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from portulang import analisar
from portulang.ast_nodes import para_dict
from portulang.erros import CATALOGO, ErroPortuLang
from portulang.interpretador import Interpretador
from portulang.lexer import tokenizar
from portulang.parser import analisar_sintaxe
from portulang.semantico import analisar_semantica
from portulang.codigo import gerar_codigo, executar_codigo, para_dict as codigo_dict
from portulang.transpilador import traduzir_para_python, PRELUDIO
import time
from collections import OrderedDict

RAIZ = os.path.dirname(os.path.abspath(__file__))
ESTATICOS = os.path.join(RAIZ, "static")
EXEMPLOS = os.path.join(RAIZ, "..", "exemplos")
MIME = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webp": "image/webp"}

LIMITE_TRACE = 3000      # passos guardados para a execução passo a passo
LIMITE_PASSOS = 200_000  # proteção contra laço infinito


def categoria(tipo):
    if tipo in ("PROGRAMA", "FIM"):
        return "estrutura"
    if tipo.startswith("TIPO_"):
        return "tipo"
    if tipo in ("VERDADEIRO", "FALSO") or tipo.startswith("LIT_"):
        return "literal"
    if tipo == "ID":
        return "identificador"
    if tipo in ("SE", "SENAO", "ENQUANTO"):
        return "controle"
    if tipo in ("LER", "ESCREVER"):
        return "entrada/saída"
    if tipo in ("E", "OU", "NAO"):
        return "lógico"
    if tipo in ("PONTO_VIRGULA", "VIRGULA", "ABRE_PAR", "FECHA_PAR", "ABRE_CHAVE", "FECHA_CHAVE"):
        return "delimitador"
    if tipo == "EOF":
        return "fim"
    return "operador"


def resumo(r):
    return {
        "tokens": [dict(t.para_dict(), categoria=categoria(t.tipo)) for t in r.tokens],
        "ast": para_dict(r.ast) if r.ast and r.fase_com_erro in ("", "semântico", "sintático") else None,   # com erro de sintaxe: árvore parcial
        "simbolos": r.simbolos,
        "erros": [dict(e.para_dict(), explicacao=CATALOGO.get(e.codigo, "")) for e in r.erros],
        "fase": r.fase_com_erro,
    }


def api_analisar(corpo):
    return resumo(analisar(corpo.get("fonte", "")))


_cache = OrderedDict()      # fonte -> resultados já calculados de cada fase (para não refazer ao voltar)
ORDEM = ["lexico", "sintatico", "semantico", "codigo"]


def _med(f):
    t = time.perf_counter_ns()
    r = f()
    return r, (time.perf_counter_ns() - t) / 1e6


def _erros(lista):
    return [dict(e.para_dict(), explicacao=CATALOGO.get(e.codigo, "")) for e in lista]


def api_fase(corpo):
    """Roda UMA fase do compilador (e só ela) e devolve o resultado com o tempo que levou.
    As fases anteriores são reaproveitadas do que já foi calculado para este mesmo código."""
    fonte, fase = corpo.get("fonte", ""), corpo.get("fase", "")
    if fase not in ORDEM:
        return {"erro": "fase desconhecida"}
    e = _cache.setdefault(fonte, {"d": {}, "resp": {}})
    _cache.move_to_end(fonte)
    while len(_cache) > 16:
        _cache.popitem(last=False)
    d, resp = e["d"], e["resp"]
    if fase in resp:
        return dict(resp[fase], do_cache=True)
    i = ORDEM.index(fase)
    if i > 0:
        ant = api_fase({"fonte": fonte, "fase": ORDEM[i - 1]})
        if ant.get("erros") or ant.get("bloqueado"):
            return {"fase": fase, "bloqueado": True, "erros": [], "tempo_ms": 0}
    if fase == "lexico":
        (d["tokens"], erros), ms = _med(lambda: tokenizar(fonte))
        out = {"tokens": [dict(t.para_dict(), categoria=categoria(t.tipo)) for t in d["tokens"]], "erros": _erros(erros)}
    elif fase == "sintatico":
        (d["ast"], erros), ms = _med(lambda: analisar_sintaxe(d["tokens"]))
        out = {"ast": para_dict(d["ast"]), "erros": _erros(erros)}      # com erro: árvore parcial
    elif fase == "semantico":
        (erros, simbolos), ms = _med(lambda: analisar_semantica(d["ast"]))
        out = {"ast": para_dict(d["ast"]), "simbolos": simbolos, "erros": _erros(erros)}
    else:
        (d["codigo"], linhas_py), ms = _med(lambda: (gerar_codigo(d["ast"]), traduzir_para_python(d["ast"])))
        out = {"codigo": codigo_dict(d["codigo"]), "python": linhas_py, "prelude": PRELUDIO, "erros": []}
    out.update(fase=fase, tempo_ms=ms)
    resp[fase] = out
    return dict(out, do_cache=False)


def api_executar(corpo):
    fonte = corpo.get("fonte", "")
    r = analisar(fonte)
    resp = resumo(r)
    resp.update(executou=False, saida="", trace=[], truncado=False, passos=0, erros_exec=[], aguardando=False)
    if not r.ok:
        return resp

    linhas = iter(corpo.get("entrada", "").splitlines(keepends=True))
    saida = []                # só o que o programa escreveu (usado para conferir com a máquina virtual)
    tela = [""]               # o que aparece na tela: a saída + o que foi digitado em cada ler()
    total_saida = [0]
    trace = []
    contador = [0]

    def escrever(txt):
        saida.append(txt)
        tela[0] += txt
        total_saida[0] = len(tela[0])

    def ler_linha():
        linha = next(linhas, None)
        if linha is not None:
            # o valor digitado fica na tela, na linha do pedido (\x01 = "junte à linha anterior"; o Studio faz a junção)
            tela[0] += "\x01" + linha.rstrip("\r\n") + "\n"
            total_saida[0] = len(tela[0])
        return linha

    def observador(no, variaveis):
        contador[0] += 1
        if len(trace) >= LIMITE_TRACE:
            return None
        tf = no.tf
        if hasattr(no, "condicao"):          # se/enquanto: só o cabeçalho "(condição)"
            tf = no.condicao.tf + 1
        entrada = {"linha": no.linha, "coluna": no.coluna, "no": type(no).__name__,
                   "ti": no.ti, "tf": tf, "variaveis": variaveis, "saida": total_saida[0]}
        trace.append(entrada)
        return entrada                      # o interpretador completa com o que o comando fez

    interp = Interpretador(ler_linha, escrever, LIMITE_PASSOS, observador)
    erros = []
    t0 = time.perf_counter_ns()
    try:
        interp.executar(r.ast)
    except ErroPortuLang as e:
        erros.append(dict(e.para_dict(), explicacao=CATALOGO.get(e.codigo, "")))
    tempo_ms = (time.perf_counter_ns() - t0) / 1e6
    # confere: o código gerado, rodando na máquina virtual, dá a mesma saída e o mesmo erro?
    vm_linhas = iter(corpo.get("entrada", "").splitlines(keepends=True))
    vm_saida, vm_erro = [], None
    try:
        executar_codigo(gerar_codigo(r.ast), lambda: next(vm_linhas, None), vm_saida.append, 1_000_000)
    except ErroPortuLang as e:
        vm_erro = e.codigo
    arv_erro = erros[0]["codigo"] if erros else None
    vm_confere = None if "E03" in (vm_erro, arv_erro) else ("".join(vm_saida) == "".join(saida) and vm_erro == arv_erro)
    # entrada esgotada não é erro: o programa está esperando o usuário digitar o próximo valor
    aguardando = bool(erros) and erros[0]["codigo"] == "E04"
    if aguardando:
        erros = []
    trace.append({"linha": erros[0]["linha"] if erros else None, "coluna": erros[0]["coluna"] if erros else None,
                  "no": "fim", "final": True, "variaveis": interp.variaveis(),
                  "saida": total_saida[0]})
    resp.update(executou=True, saida=tela[0], trace=trace,
                truncado=contador[0] > LIMITE_TRACE, passos=contador[0], erros_exec=erros, aguardando=aguardando,
                tempo_ms=tempo_ms, vm_confere=vm_confere)
    return resp


def api_exemplos():
    itens = []
    if os.path.isdir(EXEMPLOS):
        ordem = ["erro_lexico", "erro_sintatico", "erro_semantico", "erro_execucao"]     # na ordem das fases
        chave = lambda n: (1, ordem.index(n[:-3]) if n[:-3] in ordem else 99, n) if n.startswith("erro_") else (0, 0, n)
        for nome in sorted(os.listdir(EXEMPLOS), key=chave):
            if not nome.endswith(".pl"):
                continue
            base = nome[:-3]
            with open(os.path.join(EXEMPLOS, nome), encoding="utf-8") as f:
                fonte = f.read()
            entrada = ""
            caminho_in = os.path.join(EXEMPLOS, base + ".entrada")
            if os.path.exists(caminho_in):
                with open(caminho_in, encoding="utf-8") as f:
                    entrada = f.read()
            itens.append({"nome": base, "fonte": fonte, "entrada": entrada})
    return itens


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, obj, status=200):
        dados = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        caminho = self.path.split("?")[0]
        if caminho == "/api/exemplos":
            return self._json(api_exemplos())
        if caminho == "/":
            caminho = "/index.html"
        destino = os.path.normpath(os.path.join(ESTATICOS, caminho.lstrip("/")))
        if not destino.startswith(ESTATICOS) or not os.path.isfile(destino):
            self.send_response(404)
            self.end_headers()
            return
        with open(destino, "rb") as f:
            dados = f.read()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(os.path.splitext(destino)[1], "application/octet-stream"))
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dados)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            if self.path == "/api/analisar":
                return self._json(api_analisar(corpo))
            if self.path == "/api/fase":
                return self._json(api_fase(corpo))
            if self.path == "/api/executar":
                return self._json(api_executar(corpo))
            self._json({"erro": "rota inexistente"}, 404)
        except Exception as e:  # nunca derruba o servidor
            self._json({"erro": f"falha interna: {e}"}, 500)


class ServidorExclusivo(ThreadingHTTPServer):
    allow_reuse_address = False       # no Windows isso deixaria dois programas dividirem a mesma porta


def criar_servidor(porta_preferida=47651, tentativas=20):
    """Servidor do aplicativo desktop: porta fixa (para o navegador embutido lembrar do que foi salvo); se estiver ocupada, tenta a seguinte."""
    for p in range(porta_preferida, porta_preferida + tentativas):
        try:
            return ServidorExclusivo(("127.0.0.1", p), Handler)
        except OSError:
            continue
    return ServidorExclusivo(("127.0.0.1", 0), Handler)


def main(porta=8765, abrir=True):
    srv = ThreadingHTTPServer(("127.0.0.1", porta), Handler)
    url = f"http://127.0.0.1:{porta}"
    print(f"PortuLang Studio em {url}  (Ctrl+C para sair)")
    if abrir:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()

