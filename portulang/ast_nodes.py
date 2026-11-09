"""Nós da árvore sintática abstrata (AST)."""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(eq=False)
class No:
    linha: int = 0
    coluna: int = 0
    # Faixa de tokens que o nó cobre (índices na lista de tokens). São atributos
    # comuns, não campos do dataclass, para não mudar a ordem dos argumentos.
    ti = -1
    tf = -1


# ---- expressões (o campo `tipo` é preenchido pelo analisador semântico) ----
@dataclass(eq=False)
class Literal(No):
    tipo_literal: str = ""       # inteiro | decimal | texto | logico
    valor: object = None
    tipo: Optional[str] = None


@dataclass(eq=False)
class Variavel(No):
    nome: str = ""
    tipo: Optional[str] = None


@dataclass(eq=False)
class Unario(No):
    op: str = ""
    operando: No = None
    tipo: Optional[str] = None


@dataclass(eq=False)
class Binario(No):
    op: str = ""
    esq: No = None
    dir: No = None
    tipo: Optional[str] = None


# ---- comandos ----
@dataclass(eq=False)
class Declaracao(No):
    tipo_var: str = ""
    nome: str = ""
    inicial: Optional[No] = None


@dataclass(eq=False)
class Atribuicao(No):
    nome: str = ""
    valor: No = None


@dataclass(eq=False)
class Leitura(No):
    nome: str = ""


@dataclass(eq=False)
class Escrita(No):
    args: List[No] = field(default_factory=list)


@dataclass(eq=False)
class Se(No):
    condicao: No = None
    entao: List[No] = field(default_factory=list)
    senao: Optional[List[No]] = None   # lista de comandos; um "senao se" é [Se]


@dataclass(eq=False)
class Enquanto(No):
    condicao: No = None
    corpo: List[No] = field(default_factory=list)


@dataclass(eq=False)
class Erro(No):
    """Marca, na árvore parcial, o trecho que o parser não conseguiu entender."""
    codigo: str = ""
    mensagem: str = ""


@dataclass(eq=False)
class Programa(No):
    comandos: List[No] = field(default_factory=list)


def _bloco(rotulo, comandos):
    return {"no": "Bloco", "rotulo": rotulo, "linha": 0, "coluna": 0, "tipo": None, "ti": -1, "tf": -1,
            "filhos": [para_dict(c) for c in comandos]}


def para_dict(n):
    """Converte a AST em dicionário/JSON, usado pelo Studio para desenhar a árvore."""
    base = {"no": type(n).__name__, "linha": n.linha, "coluna": n.coluna,
            "tipo": getattr(n, "tipo", None), "ti": n.ti, "tf": n.tf}
    if isinstance(n, Programa):
        base.update(rotulo="programa", filhos=[para_dict(c) for c in n.comandos])
    elif isinstance(n, Declaracao):
        base.update(rotulo=f"criar {n.tipo_var} {n.nome}",
                    filhos=[para_dict(n.inicial)] if n.inicial else [])
    elif isinstance(n, Atribuicao):
        base.update(rotulo=f"guardar em {n.nome}", filhos=[para_dict(n.valor)])
    elif isinstance(n, Leitura):
        base.update(rotulo=f"ler {n.nome}", filhos=[])
    elif isinstance(n, Escrita):
        base.update(rotulo="mostrar na tela", filhos=[para_dict(a) for a in n.args])
    elif isinstance(n, Se):
        filhos = [para_dict(n.condicao), _bloco("então", n.entao)]
        if n.senao is not None:
            filhos.append(_bloco("senão", n.senao))
        base.update(rotulo="decisão (se)", filhos=filhos, tf=n.condicao.tf + 1)  # só o cabeçalho
    elif isinstance(n, Enquanto):
        base.update(rotulo="repetição (enquanto)",
                    filhos=[para_dict(n.condicao), _bloco("repetir", n.corpo)],
                    tf=n.condicao.tf + 1)
    elif isinstance(n, Erro):
        base.update(rotulo=f"✗ {n.codigo}", filhos=[], codigo=n.codigo, mensagem=n.mensagem)
    elif isinstance(n, Literal):
        txt = f'"{n.valor}"' if n.tipo_literal == "texto" else (
            ("verdadeiro" if n.valor else "falso") if n.tipo_literal == "logico" else str(n.valor))
        base.update(rotulo=txt, filhos=[])
    elif isinstance(n, Variavel):
        base.update(rotulo=n.nome, filhos=[])
    elif isinstance(n, Unario):
        base.update(rotulo=n.op, filhos=[para_dict(n.operando)])
    elif isinstance(n, Binario):
        base.update(rotulo=n.op, filhos=[para_dict(n.esq), para_dict(n.dir)])
    return base
