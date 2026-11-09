"""Análise semântica: declarações, escopos e tipos (regras S01 a S09)."""
from . import ast_nodes as A
from .erros import ErroPortuLang

NUMERICOS = ("inteiro", "decimal")


def _promover(a, b):
    return "decimal" if "decimal" in (a, b) else "inteiro"


class Analisador:
    def __init__(self):
        self.escopos = [{}]           # pilha de escopos: nome -> tipo
        self.erros = []
        self.simbolos = []            # tabela de símbolos (para o Studio)
        self._contador_escopo = 0
        self._ids_escopo = [0]        # id numérico de cada escopo da pilha

    # -- utilidades ---------------------------------------------------
    def _erro(self, codigo, msg, no):
        self.erros.append(ErroPortuLang("semântico", codigo, msg, no.linha, no.coluna))

    def _buscar(self, nome):
        for esc in reversed(self.escopos):
            if nome in esc:
                return esc[nome]
        return None

    def _entrar(self):
        self._contador_escopo += 1
        self.escopos.append({})
        self._ids_escopo.append(self._contador_escopo)

    def _sair(self):
        self.escopos.pop()
        self._ids_escopo.pop()

    def _bloco(self, comandos):
        self._entrar()
        for c in comandos:
            self._comando(c)
        self._sair()

    # -- comandos -----------------------------------------------------
    def programa(self, prog):
        for c in prog.comandos:
            self._comando(c)
        return self.erros, self.simbolos

    def _comando(self, c):
        if isinstance(c, A.Declaracao):
            tipo_val = self._expr(c.inicial) if c.inicial else None
            if self._buscar(c.nome) is not None:
                self._erro("S02", f"a variável '{c.nome}' já foi declarada "
                                  f"como '{self._buscar(c.nome)}'", c)
            else:
                self.escopos[-1][c.nome] = c.tipo_var
                self.simbolos.append({"nome": c.nome, "tipo": c.tipo_var, "linha": c.linha,
                                      "escopo": self._ids_escopo[-1]})
            if c.inicial is not None:
                self._compativel(c.tipo_var, tipo_val, c.nome, c.inicial)
        elif isinstance(c, A.Atribuicao):
            tipo_val = self._expr(c.valor)
            destino = self._buscar(c.nome)
            if destino is None:
                self._erro("S01", f"a variável '{c.nome}' não foi declarada", c)
            else:
                self._compativel(destino, tipo_val, c.nome, c.valor)
        elif isinstance(c, A.Leitura):
            if self._buscar(c.nome) is None:
                self._erro("S09", f"ler(...) usa a variável '{c.nome}', que não foi declarada", c)
        elif isinstance(c, A.Escrita):
            for a in c.args:
                self._expr(a)
        elif isinstance(c, A.Se):
            self._condicao(c.condicao, "se")
            self._bloco(c.entao)
            if c.senao is not None:
                self._bloco(c.senao)
        elif isinstance(c, A.Enquanto):
            self._condicao(c.condicao, "enquanto")
            self._bloco(c.corpo)

    def _condicao(self, expr, comando):
        t = self._expr(expr)
        if t is not None and t != "logico":
            self._erro("S07", f"a condição do '{comando}' deve ser logico, mas é '{t}'", expr)

    def _compativel(self, destino, origem, nome, no_valor):
        if origem is None or origem == destino:
            return
        if destino == "decimal" and origem == "inteiro":
            return
        if destino == "inteiro" and origem == "decimal":
            self._erro("S04", f"não é possível guardar um 'decimal' em '{nome}', que é "
                              f"'inteiro' (perda de dados)", no_valor)
        else:
            self._erro("S03", f"não é possível guardar um '{origem}' em '{nome}', "
                              f"que é do tipo '{destino}'", no_valor)

    # -- expressões: retornam o tipo (ou None se já houve erro) -------
    def _expr(self, e):
        t = self._tipo(e)
        e.tipo = t
        return t

    def _tipo(self, e):
        if isinstance(e, A.Literal):
            return e.tipo_literal
        if isinstance(e, A.Variavel):
            t = self._buscar(e.nome)
            if t is None:
                self._erro("S01", f"a variável '{e.nome}' não foi declarada", e)
            return t
        if isinstance(e, A.Unario):
            t = self._expr(e.operando)
            if e.op == "-":
                if t is not None and t not in NUMERICOS:
                    self._erro("S05", f"o operador '-' não se aplica a '{t}'", e)
                    return None
                return t
            if t is not None and t != "logico":
                self._erro("S08", f"'nao' exige um valor logico, mas recebeu '{t}'", e)
            return "logico"
        if isinstance(e, A.Binario):
            return self._binario(e)
        return None

    def _binario(self, e):
        a = self._expr(e.esq)
        b = self._expr(e.dir)
        op = e.op

        if op in ("e", "ou"):
            for t in (a, b):
                if t is not None and t != "logico":
                    self._erro("S08", f"'{op}' exige valores logico, mas recebeu '{t}'", e)
                    break
            return "logico"

        if op in (">", "<", ">=", "<="):
            if a is not None and b is not None and not (a in NUMERICOS and b in NUMERICOS):
                self._erro("S06", f"'{op}' só compara números, mas recebeu '{a}' e '{b}'", e)
            return "logico"

        if op in ("==", "!="):
            if a is not None and b is not None and a != b \
                    and not (a in NUMERICOS and b in NUMERICOS):
                self._erro("S06", f"não é possível comparar '{a}' com '{b}' usando '{op}'", e)
            return "logico"

        # aritméticos
        if a is None or b is None:
            return None
        if op == "+" and a == b == "texto":
            return "texto"
        if a in NUMERICOS and b in NUMERICOS:
            if op == "/" and a == b == "inteiro":
                return "inteiro"
            return _promover(a, b)
        self._erro("S05", f"o operador '{op}' não se aplica a '{a}' e '{b}'", e)
        return None


def analisar_semantica(ast):
    """Retorna (erros, tabela_de_simbolos)."""
    return Analisador().programa(ast)
