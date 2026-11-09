"""Definição dos tokens da PortuLang (ver seção 4 da especificação)."""
from dataclasses import dataclass
from typing import Any

PALAVRAS_CHAVE = {
    "programa": "PROGRAMA",
    "fim": "FIM",
    "inteiro": "TIPO_INTEIRO",
    "decimal": "TIPO_DECIMAL",
    "texto": "TIPO_TEXTO",
    "logico": "TIPO_LOGICO",
    "verdadeiro": "VERDADEIRO",
    "falso": "FALSO",
    "se": "SE",
    "senao": "SENAO",
    "enquanto": "ENQUANTO",
    "ler": "LER",
    "escrever": "ESCREVER",
    "e": "E",
    "ou": "OU",
    "nao": "NAO",
}

# tipo de token de declaração -> nome do tipo da linguagem
TIPOS_DECLARAVEIS = {
    "TIPO_INTEIRO": "inteiro",
    "TIPO_DECIMAL": "decimal",
    "TIPO_TEXTO": "texto",
    "TIPO_LOGICO": "logico",
}

# Como cada token aparece nas mensagens de erro.
NOMES_AMIGAVEIS = {
    "EOF": "fim do arquivo",
    "ID": "um nome (identificador)",
    "PONTO_VIRGULA": "';'",
    "VIRGULA": "','",
    "ABRE_PAR": "'('",
    "FECHA_PAR": "')'",
    "ABRE_CHAVE": "'{'",
    "FECHA_CHAVE": "'}'",
    "ATRIBUI": "'='",
    "PROGRAMA": "'programa'",
    "FIM": "'fim'",
}


@dataclass(frozen=True)
class Token:
    tipo: str
    lexema: str
    linha: int
    coluna: int
    valor: Any = None

    def para_dict(self):
        return {"tipo": self.tipo, "lexema": self.lexema,
                "linha": self.linha, "coluna": self.coluna}
