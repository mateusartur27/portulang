"""Análise léxica: transforma o código-fonte em uma lista de tokens."""
from .erros import ErroPortuLang
from .tokens import PALAVRAS_CHAVE, Token

SIMPLES = {
    "+": "MAIS", "-": "MENOS", "*": "VEZES", "/": "DIVIDE",
    "(": "ABRE_PAR", ")": "FECHA_PAR", "{": "ABRE_CHAVE", "}": "FECHA_CHAVE",
    ";": "PONTO_VIRGULA", ",": "VIRGULA",
    "<": "MENOR", ">": "MAIOR", "=": "ATRIBUI",
}
DUPLOS = {"==": "IGUAL_IGUAL", "!=": "DIFERENTE", "<=": "MENOR_IGUAL", ">=": "MAIOR_IGUAL"}
ESCAPES = {"n": "\n", "t": "\t", '"': '"', "\\": "\\"}


def _letra(c):
    return c.isascii() and (c.isalpha() or c == "_")


def _digito(c):
    return c.isascii() and c.isdigit()


class Lexer:
    def __init__(self, fonte):
        self.fonte = fonte
        self.i = 0
        self.linha = 1
        self.col = 1
        self.tokens = []
        self.erros = []

    # -- utilidades ---------------------------------------------------
    def _olhar(self, k=0):
        j = self.i + k
        return self.fonte[j] if j < len(self.fonte) else ""

    def _avancar(self):
        c = self.fonte[self.i]
        self.i += 1
        if c == "\n":
            self.linha += 1
            self.col = 1
        else:
            self.col += 1
        return c

    def _erro(self, codigo, msg, linha, col):
        self.erros.append(ErroPortuLang("léxico", codigo, msg, linha, col))

    def _emitir(self, tipo, lexema, linha, col, valor=None):
        self.tokens.append(Token(tipo, lexema, linha, col, valor))

    # -- varredura ----------------------------------------------------
    def tokenizar(self):
        while self.i < len(self.fonte):
            c = self._olhar()
            linha, col = self.linha, self.col

            if c in " \t\r\n":
                self._avancar()
            elif c == "/" and self._olhar(1) == "/":
                while self.i < len(self.fonte) and self._olhar() != "\n":
                    self._avancar()
            elif _letra(c):
                self._identificador(linha, col)
            elif _digito(c):
                self._numero(linha, col)
            elif c == '"':
                self._texto(linha, col)
            elif c + self._olhar(1) in DUPLOS:
                lex = self._avancar() + self._avancar()
                self._emitir(DUPLOS[lex], lex, linha, col)
            elif c in SIMPLES:
                self._avancar()
                self._emitir(SIMPLES[c], c, linha, col)
            else:
                self._avancar()
                self._erro("L01", f"caractere inválido {c!r}", linha, col)

        self._emitir("EOF", "", self.linha, self.col)
        return self.tokens, self.erros

    def _identificador(self, linha, col):
        ini = self.i
        while _letra(self._olhar()) or _digito(self._olhar()):
            self._avancar()
        lex = self.fonte[ini:self.i]
        tipo = PALAVRAS_CHAVE.get(lex, "ID")
        valor = {"VERDADEIRO": True, "FALSO": False}.get(tipo)
        self._emitir(tipo, lex, linha, col, valor)

    def _numero(self, linha, col):
        ini = self.i
        while _digito(self._olhar()):
            self._avancar()
        if self._olhar() == ".":
            if _digito(self._olhar(1)):
                self._avancar()
                while _digito(self._olhar()):
                    self._avancar()
                lex = self.fonte[ini:self.i]
                self._emitir("LIT_DECIMAL", lex, linha, col, float(lex))
                return
            self._avancar()  # consome o '.' solto
            lex = self.fonte[ini:self.i]
            self._erro("L03", f"número decimal malformado {lex!r}: faltam dígitos depois do ponto",
                       linha, col)
            return
        lex = self.fonte[ini:self.i]
        self._emitir("LIT_INTEIRO", lex, linha, col, int(lex))

    def _texto(self, linha, col):
        ini = self.i
        self._avancar()  # abre aspas
        partes = []
        while True:
            c = self._olhar()
            if c == "" or c == "\n":
                self._erro("L02", "texto sem aspas de fechamento", linha, col)
                return
            if c == '"':
                self._avancar()
                break
            if c == "\\":
                el, ec = self.linha, self.col
                self._avancar()
                e = self._olhar()
                if e in ESCAPES:
                    partes.append(ESCAPES[e])
                    self._avancar()
                elif e == "" or e == "\n":
                    continue  # será reportado como texto não fechado
                else:
                    self._erro("L04", f"sequência de escape inválida '\\{e}'", el, ec)
                    self._avancar()
                continue
            partes.append(self._avancar())
        self._emitir("LIT_TEXTO", self.fonte[ini:self.i], linha, col, "".join(partes))


def tokenizar(fonte):
    """Retorna (tokens, erros). O último token é sempre EOF."""
    return Lexer(fonte).tokenizar()
