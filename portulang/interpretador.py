"""Interpretador: executa a AST (já validada pelo analisador semântico)."""
from . import ast_nodes as A
from .erros import ErroPortuLang

PADRAO = {"inteiro": 0, "decimal": 0.0, "texto": "", "logico": False}


def formatar(v):
    if isinstance(v, bool):
        return "verdadeiro" if v else "falso"
    return str(v)


class Interpretador:
    def __init__(self, entrada=None, saida=None, max_passos=1_000_000, observador=None):
        self.entrada = entrada or (lambda: None)      # devolve uma linha ou None
        self.saida = saida or (lambda texto: None)
        self.max_passos = max_passos
        self.observador = observador                  # observador(no, variaveis) por comando
        self.passos = 0
        self._registro = None
        self.escopos = [{}]                         # nome -> [tipo, valor]

    def _erro(self, codigo, msg, no):
        return ErroPortuLang("execução", codigo, msg, no.linha, no.coluna)

    def variaveis(self):
        """Valores visíveis agora (usado na execução passo a passo)."""
        vis = {}
        for esc in self.escopos:
            for nome, (tipo, valor) in esc.items():
                vis[nome] = {"tipo": tipo, "valor": formatar(valor)}
        return vis

    def _celula(self, nome):
        for esc in reversed(self.escopos):
            if nome in esc:
                return esc[nome]
        raise KeyError(nome)

    # -- execução -----------------------------------------------------
    def executar(self, prog):
        self._bloco(prog.comandos, novo_escopo=False)

    def _bloco(self, comandos, novo_escopo=True):
        if novo_escopo:
            self.escopos.append({})
        try:
            for c in comandos:
                self._comando(c)
        finally:
            if novo_escopo:
                self.escopos.pop()

    def _passo(self, no):
        self.passos += 1
        if self.passos > self.max_passos:
            raise self._erro("E03", f"limite de {self.max_passos} passos excedido "
                                    f"(possível laço infinito)", no)
        # o observador pode devolver um dicionário, que depois é preenchido com
        # o que o comando fez (valor guardado, texto escrito, resultado da condição)
        self._registro = self.observador(no, self.variaveis()) if self.observador else None

    def _anotar(self, chave, valor):
        if isinstance(self._registro, dict):
            self._registro[chave] = valor

    def _comando(self, c):
        if not isinstance(c, A.Enquanto):
            self._passo(c)
        if isinstance(c, A.Declaracao):
            valor = self._aval(c.inicial) if c.inicial else PADRAO[c.tipo_var]
            if c.tipo_var == "decimal":
                valor = float(valor)
            self.escopos[-1][c.nome] = [c.tipo_var, valor]
            self._anotar("valor", formatar(valor))
        elif isinstance(c, A.Atribuicao):
            valor = self._aval(c.valor)
            cel = self._celula(c.nome)
            cel[1] = float(valor) if cel[0] == "decimal" else valor
            self._anotar("valor", formatar(cel[1]))
        elif isinstance(c, A.Leitura):
            self._ler(c)
            self._anotar("valor", formatar(self._celula(c.nome)[1]))
        elif isinstance(c, A.Escrita):
            texto = "".join(formatar(self._aval(a)) for a in c.args)
            self._anotar("texto", texto)
            self.saida(texto + "\n")
        elif isinstance(c, A.Se):
            cond = self._aval(c.condicao)
            self._anotar("condicao", bool(cond))
            if cond:
                self._bloco(c.entao)
            elif c.senao is not None:
                self._bloco(c.senao)
        elif isinstance(c, A.Enquanto):
            while True:
                self._passo(c)                  # um passo para cada vez que a condição é conferida
                cond = self._aval(c.condicao)
                self._anotar("condicao", bool(cond))
                if not cond:
                    break
                self._bloco(c.corpo)

    def _ler(self, c):
        linha = self.entrada()
        if linha is None:
            raise self._erro("E04", "a entrada de dados terminou, mas o programa tentou ler "
                                    f"'{c.nome}'", c)
        texto = linha.rstrip("\r\n")
        cel = self._celula(c.nome)
        tipo = cel[0]
        try:
            if tipo == "inteiro":
                cel[1] = int(texto.strip())
            elif tipo == "decimal":
                cel[1] = float(texto.strip().replace(",", "."))
            elif tipo == "logico":
                t = texto.strip().lower()
                if t not in ("verdadeiro", "falso"):
                    raise ValueError
                cel[1] = t == "verdadeiro"
            else:
                cel[1] = texto
        except ValueError:
            raise self._erro("E02", f"o valor {texto!r} não pode ser convertido para "
                                    f"'{tipo}' (variável '{c.nome}')", c)

    # -- expressões ---------------------------------------------------
    def _aval(self, e):
        if isinstance(e, A.Literal):
            return e.valor
        if isinstance(e, A.Variavel):
            return self._celula(e.nome)[1]
        if isinstance(e, A.Unario):
            v = self._aval(e.operando)
            return (not v) if e.op == "nao" else -v
        if isinstance(e, A.Binario):
            if e.op == "e":
                return self._aval(e.esq) and self._aval(e.dir)
            if e.op == "ou":
                return self._aval(e.esq) or self._aval(e.dir)
            a, b = self._aval(e.esq), self._aval(e.dir)
            return self._operar(e, e.op, a, b)

    def _operar(self, e, op, a, b):
        if op == "+":
            return a + b
        if op == "-":
            return a - b
        if op == "*":
            return a * b
        if op == "/":
            if b == 0:
                raise self._erro("E01", "divisão por zero", e)
            if isinstance(a, int) and isinstance(b, int):
                q = abs(a) // abs(b)               # divisão inteira truncada
                return q if (a >= 0) == (b >= 0) else -q
            return a / b
        if op == "<":
            return a < b
        if op == ">":
            return a > b
        if op == "<=":
            return a <= b
        if op == ">=":
            return a >= b
        if op == "==":
            return a == b
        if op == "!=":
            return a != b
        raise AssertionError(op)
