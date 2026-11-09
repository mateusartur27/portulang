"""PortuLang: linguagem de programação em português com tipos declarados."""
from dataclasses import dataclass, field
from typing import List

from .erros import ErroPortuLang
from .interpretador import Interpretador
from .lexer import tokenizar
from .parser import analisar_sintaxe
from .semantico import analisar_semantica


@dataclass
class Resultado:
    fonte: str
    tokens: list = field(default_factory=list)
    ast: object = None
    simbolos: list = field(default_factory=list)
    erros: List[ErroPortuLang] = field(default_factory=list)
    fase_com_erro: str = ""      # primeira fase que falhou ('' = tudo certo)

    @property
    def ok(self):
        return not self.erros


def analisar(fonte):
    """Roda léxico -> sintático -> semântico. Para na primeira fase que tiver erros
    (mas reporta todos os erros dessa fase)."""
    r = Resultado(fonte)
    r.tokens, erros = tokenizar(fonte)
    if erros:
        r.erros, r.fase_com_erro = erros, "léxico"
        return r
    r.ast, erros = analisar_sintaxe(r.tokens)
    if erros:
        r.erros, r.fase_com_erro = erros, "sintático"
        return r
    erros, r.simbolos = analisar_semantica(r.ast)
    if erros:
        r.erros, r.fase_com_erro = erros, "semântico"
    return r


def executar(fonte, entrada=None, saida=None, max_passos=1_000_000, observador=None):
    """Analisa e executa. Retorna o Resultado; se houver erro de execução,
    ele é acrescentado a `erros` com fase_com_erro == 'execução'."""
    r = analisar(fonte)
    if not r.ok:
        return r
    try:
        Interpretador(entrada, saida, max_passos, observador).executar(r.ast)
    except ErroPortuLang as e:
        r.erros.append(e)
        r.fase_com_erro = "execução"
    return r
