"""Geração de código: transforma a AST (já validada) em código intermediário
para uma pequena máquina de pilha, e uma máquina virtual que o executa.

O Studio mostra esta lista de instruções na etapa "Código". A máquina virtual
existe para provar que a lista é fiel: ela produz exatamente a mesma saída que o
interpretador da árvore (os testes comparam as duas)."""
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Optional

from . import ast_nodes as A
from .erros import ErroPortuLang
from .interpretador import Interpretador, PADRAO, formatar

OPS_BINARIAS = {
    "+": ("SOMAR", "soma"), "-": ("SUBTRAIR", "subtrai"), "*": ("MULTIPLICAR", "multiplica"),
    "/": ("DIVIDIR", "divide"), "<": ("MENOR", "compara: é menor?"), ">": ("MAIOR", "compara: é maior?"),
    "<=": ("MENOR_IGUAL", "compara: é menor ou igual?"), ">=": ("MAIOR_IGUAL", "compara: é maior ou igual?"),
    "==": ("IGUAL", "compara: são iguais?"), "!=": ("DIFERENTE", "compara: são diferentes?"),
}
SIMBOLO_DE = {nome: simb for simb, (nome, _) in OPS_BINARIAS.items()}


@dataclass
class Instr:
    op: str
    arg: str = ""                 # o que aparece ao lado do nome da instrução
    expl: str = ""                # explicação em português
    valor: object = None          # dado bruto (constante, nome, tipo...) usado pela máquina virtual
    alvo: Optional[int] = None    # endereço de destino, nos saltos
    linha: int = 0
    coluna: int = 0
    ti: int = -1                  # faixa de tokens do código-fonte que gerou a instrução
    tf: int = -1

    def para_dict(self, endereco):
        return {"end": endereco, "op": self.op, "arg": self.arg, "expl": self.expl, "alvo": self.alvo,
                "linha": self.linha, "ti": self.ti, "tf": self.tf}


def _lit(v):
    if isinstance(v, bool):
        return "verdadeiro" if v else "falso"
    if isinstance(v, str):
        return f'"{v}"'
    return str(v)


class Gerador:
    def __init__(self):
        self.c = []

    def _emit(self, op, no, arg="", expl="", valor=None, alvo=None, ti=None, tf=None):
        self.c.append(Instr(op, arg, expl, valor, alvo, no.linha, no.coluna,
                            no.ti if ti is None else ti, no.tf if tf is None else tf))
        return len(self.c) - 1

    def gerar(self, prog):
        self._comandos(prog.comandos)
        self._emit("PARAR", prog, expl="fim do programa: a máquina para", ti=prog.ti, tf=prog.tf)
        return self.c

    def _comandos(self, lista):
        for c in lista:
            self._comando(c)

    def _bloco(self, lista, ref):
        self._emit("ENTRAR_BLOCO", ref, expl="abre um bloco: variáveis criadas aqui dentro somem no fim dele", ti=ref.ti, tf=ref.ti)
        self._comandos(lista)
        self._emit("SAIR_BLOCO", ref, expl="fecha o bloco e esquece as variáveis criadas nele", ti=ref.tf, tf=ref.tf)

    def _comando(self, c):
        if isinstance(c, A.Declaracao):
            if c.inicial is not None:
                self._expr(c.inicial)
            else:
                self._emit("EMPILHAR", c, _lit(PADRAO[c.tipo_var]), f"valor inicial padrão do tipo {c.tipo_var}", valor=PADRAO[c.tipo_var])
            self._emit("CRIAR", c, f"{c.tipo_var} {c.nome}", f"cria a caixa “{c.nome}” ({c.tipo_var}) com o valor que está no topo da pilha",
                       valor=(c.tipo_var, c.nome))
        elif isinstance(c, A.Atribuicao):
            self._expr(c.valor)
            self._emit("GUARDAR", c, c.nome, f"tira o valor do topo da pilha e guarda na caixa “{c.nome}”", valor=c.nome)
        elif isinstance(c, A.Leitura):
            self._emit("LER", c, c.nome, f"pede um valor ao usuário e guarda em “{c.nome}”", valor=c.nome)
        elif isinstance(c, A.Escrita):
            for a in c.args:
                self._expr(a)
            n = len(c.args)
            self._emit("ESCREVER", c, str(n), f"junta os {n} valores do topo e mostra na tela" if n > 1 else "mostra na tela o valor do topo", valor=n)
        elif isinstance(c, A.Se):
            cab = c.condicao.tf + 1
            self._expr(c.condicao)
            sf = self._emit("SALTAR_SE_FALSO", c, "", "se a condição deu falso, pula para o endereço indicado", ti=c.ti, tf=cab)
            self._bloco(c.entao, c)
            if c.senao is not None:
                fim = self._emit("SALTAR", c, "", "termina o “então”: pula por cima do “senão”", ti=c.ti, tf=cab)
                self.c[sf].alvo = len(self.c)
                self._bloco(c.senao, c)
                self.c[fim].alvo = len(self.c)
            else:
                self.c[sf].alvo = len(self.c)
        elif isinstance(c, A.Enquanto):
            cab = c.condicao.tf + 1
            ini = len(self.c)
            self._expr(c.condicao)
            sf = self._emit("SALTAR_SE_FALSO", c, "", "se a condição deu falso, sai da repetição", ti=c.ti, tf=cab)
            self._bloco(c.corpo, c)
            self._emit("SALTAR", c, "", "volta ao começo para conferir a condição de novo", alvo=ini, ti=c.ti, tf=cab)
            self.c[sf].alvo = len(self.c)
        # nós de erro nunca chegam aqui: só geramos código de programa sem erros

    def _expr(self, e):
        if isinstance(e, A.Literal):
            self._emit("EMPILHAR", e, _lit(e.valor), f"põe o valor {_lit(e.valor)} no topo da pilha", valor=e.valor)
        elif isinstance(e, A.Variavel):
            self._emit("CARREGAR", e, e.nome, f"copia o valor da caixa “{e.nome}” para o topo da pilha", valor=e.nome)
        elif isinstance(e, A.Unario):
            self._expr(e.operando)
            if e.op == "nao":
                self._emit("NAO", e, "", "inverte o valor do topo: verdadeiro vira falso e vice-versa")
            else:
                self._emit("NEGAR", e, "", "troca o sinal do valor do topo")
        elif isinstance(e, A.Binario):
            if e.op in ("e", "ou"):
                self._expr(e.esq)
                if e.op == "e":
                    j = self._emit("CURTO_E", e, "", "se o lado esquerdo já é falso, o resultado é falso: pula o lado direito")
                else:
                    j = self._emit("CURTO_OU", e, "", "se o lado esquerdo já é verdadeiro, o resultado é verdadeiro: pula o lado direito")
                self._expr(e.dir)
                self.c[j].alvo = len(self.c)
            else:
                self._expr(e.esq)
                self._expr(e.dir)
                nome, verbo = OPS_BINARIAS[e.op]
                self._emit(nome, e, "", f"tira os dois valores do topo, {verbo} e empilha o resultado")


def gerar_codigo(ast):
    return Gerador().gerar(ast)


def para_dict(codigo):
    return [i.para_dict(n) for n, i in enumerate(codigo)]


def executar_codigo(codigo, entrada=None, saida=None, max_instrucoes=5_000_000):
    """Máquina virtual de pilha. Levanta os mesmos erros de execução do interpretador."""
    it = Interpretador(entrada, saida)
    pilha, pc, n = [], 0, 0
    while True:
        ins = codigo[pc]
        pc += 1
        n += 1
        if n > max_instrucoes:
            raise ErroPortuLang("execução", "E03", f"limite de {max_instrucoes} instruções excedido (possível laço infinito)", ins.linha, ins.coluna)
        op = ins.op
        no = SimpleNamespace(linha=ins.linha, coluna=ins.coluna, nome=ins.valor)
        if op == "PARAR":
            return
        elif op == "EMPILHAR":
            pilha.append(ins.valor)
        elif op == "CARREGAR":
            pilha.append(it._celula(ins.valor)[1])
        elif op == "CRIAR":
            tipo, nome = ins.valor
            v = pilha.pop()
            it.escopos[-1][nome] = [tipo, float(v) if tipo == "decimal" else v]
        elif op == "GUARDAR":
            v = pilha.pop()
            cel = it._celula(ins.valor)
            cel[1] = float(v) if cel[0] == "decimal" else v
        elif op == "LER":
            it._ler(no)
        elif op == "ESCREVER":
            k = ins.valor
            vals = pilha[len(pilha) - k:]
            del pilha[len(pilha) - k:]
            it.saida("".join(formatar(v) for v in vals) + "\n")
        elif op == "ENTRAR_BLOCO":
            it.escopos.append({})
        elif op == "SAIR_BLOCO":
            it.escopos.pop()
        elif op == "SALTAR":
            pc = ins.alvo
        elif op == "SALTAR_SE_FALSO":
            if not pilha.pop():
                pc = ins.alvo
        elif op == "CURTO_E":
            if not pilha[-1]:
                pc = ins.alvo
            else:
                pilha.pop()
        elif op == "CURTO_OU":
            if pilha[-1]:
                pc = ins.alvo
            else:
                pilha.pop()
        elif op == "NAO":
            pilha.append(not pilha.pop())
        elif op == "NEGAR":
            pilha.append(-pilha.pop())
        else:
            b, a = pilha.pop(), pilha.pop()
            pilha.append(it._operar(no, SIMBOLO_DE[op], a, b))
