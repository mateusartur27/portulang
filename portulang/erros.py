"""Erros da PortuLang. Todo erro informa fase, código, linha e coluna."""


class ErroPortuLang(Exception):
    def __init__(self, fase, codigo, mensagem, linha=0, coluna=0):
        super().__init__(mensagem)
        self.fase = fase          # 'léxico' | 'sintático' | 'semântico' | 'execução'
        self.codigo = codigo      # L01.., P01.., S01.., E01..
        self.mensagem = mensagem
        self.linha = linha
        self.coluna = coluna

    def __str__(self):
        local = f"linha {self.linha}, coluna {self.coluna}: " if self.linha else ""
        return f"[Erro {self.fase} {self.codigo}] {local}{self.mensagem}"

    def para_dict(self):
        return {"fase": self.fase, "codigo": self.codigo, "mensagem": self.mensagem,
                "linha": self.linha, "coluna": self.coluna}


# Catálogo (para documentação e para o Studio)
CATALOGO = {
    "L01": "caractere inválido",
    "L02": "texto sem aspas de fechamento",
    "L03": "número decimal malformado",
    "L04": "sequência de escape inválida",
    "P01": "token esperado não encontrado",
    "P02": "expressão esperada",
    "P03": "comando inválido",
    "P04": "código depois de 'fim'",
    "P05": "parêntese ou chave aberto e nunca fechado",
    "S01": "variável não declarada",
    "S02": "variável já declarada",
    "S03": "tipo incompatível",
    "S04": "decimal em inteiro (perda de dados)",
    "S05": "operador com tipos inválidos",
    "S06": "comparação inválida",
    "S07": "condição não é logico",
    "S08": "operando não é logico",
    "S09": "leitura em variável não declarada",
    "E01": "divisão por zero",
    "E02": "valor lido não converte para o tipo",
    "E03": "limite de passos excedido",
    "E04": "entrada de dados esgotada",
}

