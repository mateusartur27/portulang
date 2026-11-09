"""Análise sintática: parser descendente recursivo (uma função por regra da EBNF)."""
from . import ast_nodes as A
from .erros import ErroPortuLang
from .tokens import NOMES_AMIGAVEIS, TIPOS_DECLARAVEIS

INICIOS_DE_COMANDO = set(TIPOS_DECLARAVEIS) | {"ID", "LER", "ESCREVER", "SE", "ENQUANTO"}


def _descrever(tok):
    if tok.tipo == "EOF":
        return "o fim do arquivo"
    return repr(tok.lexema)


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.i = 0
        self.erros = []

    # -- utilidades ---------------------------------------------------
    @property
    def atual(self):
        return self.tokens[self.i]

    def _avancar(self):
        tok = self.tokens[self.i]
        if tok.tipo != "EOF":
            self.i += 1
        return tok

    def _erro(self, codigo, msg, tok=None):
        tok = tok or self.atual
        return ErroPortuLang("sintático", codigo, msg, tok.linha, tok.coluna)

    def _consumir(self, tipo, contexto=""):
        if self.atual.tipo == tipo:
            return self._avancar()
        esperado = NOMES_AMIGAVEIS.get(tipo, tipo)
        extra = f" {contexto}" if contexto else ""
        # ';' esquecido: aponta para o fim do comando anterior, onde ele deveria estar
        ref = self.atual
        if tipo == "PONTO_VIRGULA" and self.i > 0:
            ant = self.tokens[self.i - 1]
            ref = type(ant)(ant.tipo, ant.lexema, ant.linha, ant.coluna + len(ant.lexema))
        raise self._erro("P01", f"esperado {esperado}{extra}, mas foi encontrado {_descrever(self.atual)}", ref)

    # -- programa e comandos -----------------------------------------
    def programa(self):
        ini = self.atual
        try:
            self._consumir("PROGRAMA", "no início do programa")
        except ErroPortuLang as e:
            self.erros.append(e)
        comandos = self._lista_comandos({"FIM"})
        try:
            self._consumir("FIM", "para encerrar o programa")
        except ErroPortuLang as e:
            self.erros.append(e)
        if self.atual.tipo != "EOF":
            self.erros.append(self._erro("P04", "existe código depois de 'fim'"))
        return A.Programa(ini.linha, ini.coluna, comandos)

    def _lista_comandos(self, terminadores):
        comandos = []
        while self.atual.tipo not in terminadores and self.atual.tipo != "EOF":
            inicio = self.i
            try:
                comandos.append(self._comando())
            except ErroPortuLang as e:
                self.erros.append(e)
                self._sincronizar(inicio)
                if self.i == inicio:      # garante progresso (ex.: '}' sobrando)
                    self._avancar()
                no = A.Erro(e.linha, e.coluna, e.codigo, e.mensagem)     # a árvore parcial mostra onde quebrou
                no.ti, no.tf = inicio, max(inicio, self.i - 1)
                comandos.append(no)
        return comandos

    def _sincronizar(self, inicio):
        """Recuperação de erro: pula até o fim do comando com problema."""
        while True:
            t = self.atual.tipo
            if t in ("EOF", "FIM", "FECHA_CHAVE"):
                return
            if t == "PONTO_VIRGULA":
                self._avancar()
                return
            if t in INICIOS_DE_COMANDO and self.i > inicio:
                return
            self._avancar()

    def _marcar(self, no, ini):
        """Guarda quais tokens (índices ini..fim) o nó cobre; usado pelo Studio
        para acender as palavras certas no código."""
        no.ti, no.tf = ini, self.i - 1
        return no

    def _comando(self):
        ini = self.i
        return self._marcar(self._comando_interno(), ini)

    def _comando_interno(self):
        t = self.atual
        if t.tipo in TIPOS_DECLARAVEIS:
            return self._declaracao()
        if t.tipo == "ID":
            return self._atribuicao()
        if t.tipo == "LER":
            return self._leitura()
        if t.tipo == "ESCREVER":
            return self._escrita()
        if t.tipo == "SE":
            return self._condicional()
        if t.tipo == "ENQUANTO":
            return self._repeticao()
        if t.tipo == "FECHA_CHAVE":
            raise self._erro("P03", "'}' sobrando: não existe bloco aberto para fechar")
        raise self._erro("P03", f"comando inválido: {_descrever(t)}")

    def _declaracao(self):
        tipo_tok = self._avancar()
        nome = self._consumir("ID", f"(nome da variável) depois de '{tipo_tok.lexema}'")
        inicial = None
        if self.atual.tipo == "ATRIBUI":
            self._avancar()
            inicial = self._expressao()
        self._consumir("PONTO_VIRGULA", "no fim da declaração")
        return A.Declaracao(tipo_tok.linha, tipo_tok.coluna,
                            TIPOS_DECLARAVEIS[tipo_tok.tipo], nome.lexema, inicial)

    def _atribuicao(self):
        nome = self._avancar()
        self._consumir("ATRIBUI", f"depois de '{nome.lexema}'")
        valor = self._expressao()
        self._consumir("PONTO_VIRGULA", "no fim da atribuição")
        return A.Atribuicao(nome.linha, nome.coluna, nome.lexema, valor)

    def _leitura(self):
        t = self._avancar()
        self._consumir("ABRE_PAR", "depois de 'ler'")
        nome = self._consumir("ID", "(nome da variável) dentro de ler(...)")
        self._consumir("FECHA_PAR")
        self._consumir("PONTO_VIRGULA", "no fim do comando")
        return A.Leitura(t.linha, t.coluna, nome.lexema)

    def _escrita(self):
        t = self._avancar()
        self._consumir("ABRE_PAR", "depois de 'escrever'")
        args = [self._expressao()]
        while self.atual.tipo == "VIRGULA":
            self._avancar()
            args.append(self._expressao())
        self._consumir("FECHA_PAR")
        self._consumir("PONTO_VIRGULA", "no fim do comando")
        return A.Escrita(t.linha, t.coluna, args)

    def _condicional(self):
        ini = self.i
        return self._marcar(self._condicional_interno(), ini)

    def _condicional_interno(self):
        t = self._avancar()
        abre = self.atual
        self._consumir("ABRE_PAR", "depois de 'se'")
        cond = self._expressao()
        self._fechar_condicao(abre)
        entao = self._bloco()
        senao = None
        if self.atual.tipo == "SENAO":
            self._avancar()
            if self.atual.tipo == "SE":
                senao = [self._condicional()]
            else:
                senao = self._bloco()
        return A.Se(t.linha, t.coluna, cond, entao, senao)

    def _repeticao(self):
        t = self._avancar()
        abre = self.atual
        self._consumir("ABRE_PAR", "depois de 'enquanto'")
        cond = self._expressao()
        self._fechar_condicao(abre)
        corpo = self._bloco()
        return A.Enquanto(t.linha, t.coluna, cond, corpo)

    def _fechar_condicao(self, abre):
        """')' da condição. Se faltar mas já vem o '{', registra o erro e segue,
        assim o bloco continua na árvore em vez de virar cascata de erros."""
        if self.atual.tipo == "FECHA_PAR":
            self._avancar()
            return
        self.erros.append(self._erro("P05", "falta fechar o '(' desta condição com ')'", abre))
        if self.atual.tipo != "ABRE_CHAVE":
            raise self._erro("P01", f"esperado ')' depois da condição, mas foi encontrado {_descrever(self.atual)}")

    def _bloco(self):
        abre = self.atual
        self._consumir("ABRE_CHAVE", "para abrir o bloco")
        comandos = self._lista_comandos({"FECHA_CHAVE", "FIM"})
        if self.atual.tipo != "FECHA_CHAVE":
            self.erros.append(self._erro("P05", "este '{' abriu um bloco que nunca foi fechado com '}'", abre))
        self._consumir("FECHA_CHAVE", "para fechar o bloco")
        return comandos

    # -- expressões (menor -> maior precedência) ---------------------
    def _expressao(self):
        return self._binaria(0)

    NIVEIS = [
        {"OU"},
        {"E"},
        {"IGUAL_IGUAL", "DIFERENTE"},
        {"MENOR", "MAIOR", "MENOR_IGUAL", "MAIOR_IGUAL"},
        {"MAIS", "MENOS"},
        {"VEZES", "DIVIDE"},
    ]

    def _binaria(self, nivel):
        if nivel == len(self.NIVEIS):
            return self._unario()
        esq = self._binaria(nivel + 1)
        while self.atual.tipo in self.NIVEIS[nivel]:
            op = self._avancar()
            dir_ = self._binaria(nivel + 1)
            esq = self._marcar(A.Binario(op.linha, op.coluna, op.lexema, esq, dir_), esq.ti)
        return esq

    def _unario(self):
        if self.atual.tipo in ("MENOS", "NAO"):
            ini = self.i
            op = self._avancar()
            return self._marcar(A.Unario(op.linha, op.coluna, op.lexema, self._unario()), ini)
        return self._primario()

    def _primario(self):
        ini = self.i
        return self._marcar(self._primario_interno(), ini)

    def _primario_interno(self):
        t = self.atual
        if t.tipo == "LIT_INTEIRO":
            self._avancar()
            return A.Literal(t.linha, t.coluna, "inteiro", t.valor)
        if t.tipo == "LIT_DECIMAL":
            self._avancar()
            return A.Literal(t.linha, t.coluna, "decimal", t.valor)
        if t.tipo == "LIT_TEXTO":
            self._avancar()
            return A.Literal(t.linha, t.coluna, "texto", t.valor)
        if t.tipo in ("VERDADEIRO", "FALSO"):
            self._avancar()
            return A.Literal(t.linha, t.coluna, "logico", t.valor)
        if t.tipo == "ID":
            self._avancar()
            return A.Variavel(t.linha, t.coluna, t.lexema)
        if t.tipo == "ABRE_PAR":
            self._avancar()
            e = self._expressao()
            if self.atual.tipo != "FECHA_PAR":
                self.erros.append(self._erro("P05", "este '(' foi aberto mas nunca fechado com ')'", t))
            self._consumir("FECHA_PAR", "para fechar o parêntese")
            return e
        raise self._erro("P02", f"esperada uma expressão, mas foi encontrado {_descrever(t)}")


def analisar_sintaxe(tokens):
    """Retorna (ast, erros)."""
    p = Parser(tokens)
    return p.programa(), p.erros

