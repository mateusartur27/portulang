"""Tradutor PortuLang -> Python (a "compilação" de verdade: gera um programa em outra linguagem).

O resultado roda sozinho com `python programa.py`. Cada linha gerada guarda quais
tokens do código-fonte a originaram (o Studio usa isso para ligar as duas telas)."""
import keyword

from . import ast_nodes as A

PADRAO = {"inteiro": "0", "decimal": "0.0", "texto": '""', "logico": "False"}
OPS = {"e": "and", "ou": "or"}
RESERVADOS = set(keyword.kwlist) | {"print", "input", "int", "float", "str", "bool", "abs", "len", "range", "SystemExit"}


def nome_py(nome):
    """Nome da variável em Python: evita palavras que o Python já usa."""
    return nome + "_" if nome in RESERVADOS or nome.startswith("_") else nome

PRELUDIO = '''# Funções auxiliares da PortuLang (o programa abaixo as usa)
def _fmt(v):
    return ("verdadeiro" if v else "falso") if isinstance(v, bool) else str(v)


def _escrever(*partes):
    print("".join(_fmt(p) for p in partes))


def _dividir(a, b):
    if b == 0:
        raise ZeroDivisionError("divisão por zero")
    if isinstance(a, int) and isinstance(b, int):
        q = abs(a) // abs(b)              # divisão inteira, truncada em direção ao zero
        return q if (a >= 0) == (b >= 0) else -q
    return a / b


def _ler(tipo, nome):
    texto = input()
    try:
        if tipo == "inteiro":
            return int(texto.strip())
        if tipo == "decimal":
            return float(texto.strip().replace(",", "."))
        if tipo == "logico":
            t = texto.strip().lower()
            if t not in ("verdadeiro", "falso"):
                raise ValueError
            return t == "verdadeiro"
        return texto
    except ValueError:
        raise SystemExit(f"erro: o valor {texto!r} não serve para '{nome}' ({tipo})")
'''


class Tradutor:
    def __init__(self):
        self.linhas = []              # {"ind", "t", "ti", "tf"}
        self.escopos = [{}]           # nome -> tipo
        self.ind = 0

    def _l(self, texto, ti=-1, tf=-1):
        self.linhas.append({"ind": self.ind, "t": texto, "ti": ti, "tf": tf})

    def traduzir(self, prog):
        self._comandos(prog.comandos)
        if not self.linhas:
            self._l("pass", prog.ti, prog.tf)
        return self.linhas

    def _tipo(self, nome):
        for esc in reversed(self.escopos):
            if nome in esc:
                return esc[nome]
        return None

    def _bloco(self, lista, ti, tf):
        self.ind += 1
        self.escopos.append({})
        n = len(self.linhas)
        self._comandos(lista)
        if len(self.linhas) == n:
            self._l("pass", ti, tf)
        self.escopos.pop()
        self.ind -= 1

    def _comandos(self, lista):
        for c in lista:
            self._comando(c)

    def _comando(self, c):
        if isinstance(c, A.Declaracao):
            v = self._expr(c.inicial, True) if c.inicial is not None else PADRAO[c.tipo_var]
            if c.tipo_var == "decimal" and c.inicial is not None:
                v = f"float({v})"
            self.escopos[-1][c.nome] = c.tipo_var
            self._l(f"{nome_py(c.nome)} = {v}", c.ti, c.tf)
        elif isinstance(c, A.Atribuicao):
            v = self._expr(c.valor, True)
            if self._tipo(c.nome) == "decimal":
                v = f"float({v})"
            self._l(f"{nome_py(c.nome)} = {v}", c.ti, c.tf)
        elif isinstance(c, A.Leitura):
            self._l(f'{nome_py(c.nome)} = _ler("{self._tipo(c.nome)}", "{c.nome}")', c.ti, c.tf)
        elif isinstance(c, A.Escrita):
            self._l(f"_escrever({', '.join(self._expr(a, True) for a in c.args)})", c.ti, c.tf)
        elif isinstance(c, A.Se):
            self._se(c, "if")
        elif isinstance(c, A.Enquanto):
            cab = c.condicao.tf + 1
            self._l(f"while {self._expr(c.condicao, True)}:", c.ti, cab)
            self._bloco(c.corpo, c.ti, cab)

    def _se(self, c, palavra):
        cab = c.condicao.tf + 1
        self._l(f"{palavra} {self._expr(c.condicao, True)}:", c.ti, cab)
        self._bloco(c.entao, c.ti, cab)
        if c.senao is None:
            return
        if len(c.senao) == 1 and isinstance(c.senao[0], A.Se):
            self._se(c.senao[0], "elif")
        else:
            self._l("else:")
            self._bloco(c.senao, c.ti, cab)

    def _expr(self, e, topo=False):
        if isinstance(e, A.Literal):
            if e.tipo_literal == "texto":
                return repr(e.valor)
            return repr(e.valor)
        if isinstance(e, A.Variavel):
            return nome_py(e.nome)
        if isinstance(e, A.Unario):
            return f"not {self._expr(e.operando)}" if e.op == "nao" else f"-{self._expr(e.operando)}"
        if isinstance(e, A.Binario):
            a, b = self._expr(e.esq), self._expr(e.dir)
            if e.op == "/":
                return f"_dividir({self._expr(e.esq, True)}, {self._expr(e.dir, True)})"
            txt = f"{a} {OPS.get(e.op, e.op)} {b}"
            return txt if topo else f"({txt})"
        return "None"


def traduzir_para_python(ast):
    """Devolve a lista de linhas do programa (sem as funções auxiliares)."""
    return Tradutor().traduzir(ast)


def texto_completo(linhas):
    corpo = "\n".join("    " * l["ind"] + l["t"] for l in linhas)
    return PRELUDIO + "\n\n# --- seu programa ---\n" + corpo + "\n"

