import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from portulang import analisar, executar
from portulang.lexer import tokenizar

EXEMPLOS = os.path.join(os.path.dirname(__file__), "..", "exemplos")


def rodar(corpo, entradas=()):
    """Executa um programa e devolve (saida, codigos_de_erro)."""
    fonte = "programa\n" + corpo + "\nfim"
    it = iter(entradas)
    out = []
    r = executar(fonte, lambda: next(it, None), out.append)
    return "".join(out), [e.codigo for e in r.erros]


def codigos(corpo):
    return [e.codigo for e in analisar("programa\n" + corpo + "\nfim").erros]


class TesteLexer(unittest.TestCase):
    def tipos(self, fonte):
        toks, erros = tokenizar(fonte)
        return [t.tipo for t in toks], erros

    def test_palavras_chave_e_ids(self):
        tipos, _ = self.tipos("inteiro idade se senao enquanto verdadeiro e ou nao")
        self.assertEqual(tipos, ["TIPO_INTEIRO", "ID", "SE", "SENAO", "ENQUANTO",
                                 "VERDADEIRO", "E", "OU", "NAO", "EOF"])

    def test_maior_casamento(self):
        tipos, _ = self.tipos(">= <= == != > < =")
        self.assertEqual(tipos[:-1], ["MAIOR_IGUAL", "MENOR_IGUAL", "IGUAL_IGUAL",
                                      "DIFERENTE", "MAIOR", "MENOR", "ATRIBUI"])

    def test_numeros_e_texto(self):
        toks, erros = tokenizar('42 3.14 "a\\nb"')
        self.assertEqual(erros, [])
        self.assertEqual([t.valor for t in toks[:-1]], [42, 3.14, "a\nb"])

    def test_posicao(self):
        toks, _ = tokenizar("a\n  bb")
        self.assertEqual((toks[1].linha, toks[1].coluna), (2, 3))

    def test_comentario_ignorado(self):
        tipos, _ = self.tipos("x // tudo isso some\ny")
        self.assertEqual(tipos, ["ID", "ID", "EOF"])

    def test_erros_lexicos(self):
        self.assertEqual([e.codigo for e in self.tipos("@")[1]], ["L01"])
        self.assertEqual([e.codigo for e in self.tipos('"abc')[1]], ["L02"])
        self.assertEqual([e.codigo for e in self.tipos("3.")[1]], ["L03"])
        self.assertEqual([e.codigo for e in self.tipos('"a\\q"')[1]], ["L04"])


class TesteParser(unittest.TestCase):
    def codigos(self, corpo):
        r = analisar("programa\n" + corpo + "\nfim")
        return [e.codigo for e in r.erros]

    def test_precedencia(self):
        r = analisar("programa inteiro x = 1 + 2 * 3; fim")
        init = r.ast.comandos[0].inicial
        self.assertEqual(init.op, "+")
        self.assertEqual(init.dir.op, "*")

    def test_faixa_de_tokens_dos_nos(self):
        # tokens: programa(0) inteiro(1) x(2) =(3) 1(4) +(5) 2(6) ;(7) fim(8)
        r = analisar("programa inteiro x = 1 + 2; fim")
        decl = r.ast.comandos[0]
        self.assertEqual((decl.ti, decl.tf), (1, 7))
        self.assertEqual((decl.inicial.ti, decl.inicial.tf), (4, 6))

    def test_faixa_inclui_parenteses(self):
        r = analisar("programa inteiro x = (1 + 2) * 3; fim")
        soma = r.ast.comandos[0].inicial.esq
        self.assertEqual((soma.ti, soma.tf), (4, 8))      # '(' 1 + 2 ')'

    def test_arvore_parcial_marca_o_erro(self):
        r = analisar("programa inteiro x = ; inteiro y = 2; fim")
        tipos = [type(c).__name__ for c in r.ast.comandos]
        self.assertEqual(tipos, ["Erro", "Declaracao"])             # o que deu certo continua na árvore
        self.assertEqual(r.ast.comandos[0].codigo, "P02")

    def test_senao_se(self):
        r = analisar("programa inteiro x = 1; se (x == 1) { } senao se (x == 2) { } senao { } fim")
        se = r.ast.comandos[1]
        self.assertEqual(type(se.senao[0]).__name__, "Se")

    def test_ponto_virgula_faltando(self):
        self.assertEqual(self.codigos("inteiro x = 1"), ["P01"])

    def test_expressao_faltando(self):
        self.assertEqual(self.codigos("inteiro x = ;"), ["P02"])

    def test_comando_invalido_e_chave_sobrando(self):
        self.assertEqual(self.codigos("5;"), ["P03"])
        self.assertEqual(self.codigos("}"), ["P03"])

    def test_sem_fim_e_codigo_apos_fim(self):
        self.assertEqual([e.codigo for e in analisar("programa inteiro x;").erros], ["P01"])
        self.assertEqual([e.codigo for e in analisar("programa fim inteiro x;").erros], ["P04"])

    def test_recuperacao_acumula_erros(self):
        self.assertEqual(len(self.codigos("inteiro x = ;\nescrever(;")), 2)

    def test_nao_trava_com_lixo(self):
        self.assertTrue(self.codigos("} } ) ( ; ; {"))


class TesteSemantico(unittest.TestCase):
    def test_codigos(self):
        casos = {
            "S01": "x = 1;",
            "S02": "inteiro a; inteiro a;",
            "S03": 'inteiro x = "oi";',
            "S04": "inteiro x = 2.5;",
            "S05": 'texto t = "a" - 1;',
            "S06": 'inteiro x = 1; logico b = x == "a";',
            "S07": "inteiro c = 1; enquanto (c) { }",
            "S08": "logico b = nao 5;",
            "S09": "ler(y);",
        }
        for cod, corpo in casos.items():
            with self.subTest(cod):
                self.assertIn(cod, codigos(corpo))

    def test_programas_validos(self):
        validos = [
            "decimal d = 3;",                          # inteiro -> decimal
            'texto t = "a" + "b";',
            "inteiro a = 1; decimal b = a + 0.5;",
            "logico l = 1 < 2 e 3 >= 3;",
            "inteiro a = 1; se (a == 1.0) { }",         # inteiro == decimal
            "logico b = verdadeiro == falso;",
        ]
        for corpo in validos:
            with self.subTest(corpo):
                self.assertEqual(codigos(corpo), [])

    def test_escopo(self):
        self.assertEqual(codigos("se (verdadeiro) { inteiro a = 1; } escrever(a);"), ["S01"])
        self.assertEqual(codigos("inteiro a = 1; se (verdadeiro) { inteiro a = 2; }"), ["S02"])

    def test_uso_na_propria_declaracao(self):
        self.assertIn("S01", codigos("inteiro x = x + 1;"))

    def test_acumula_varios_erros(self):
        self.assertEqual(len(codigos('inteiro a = "x"; b = 1; ler(c);')), 3)

    def test_tabela_de_simbolos(self):
        r = analisar("programa inteiro a; texto t; fim")
        self.assertEqual([(s["nome"], s["tipo"]) for s in r.simbolos],
                         [("a", "inteiro"), ("t", "texto")])


class TesteInterpretador(unittest.TestCase):
    def test_aritmetica_e_precedencia(self):
        self.assertEqual(rodar("escrever(2 + 3 * 4, \" \", (2 + 3) * 4);")[0], "14 20\n")

    def test_divisao_inteira_e_decimal(self):
        self.assertEqual(rodar("escrever(7 / 2, \" \", -7 / 2, \" \", 7 / 2.0);")[0], "3 -3 3.5\n")

    def test_decimal_recebe_inteiro(self):
        self.assertEqual(rodar("decimal d = 3; escrever(d);")[0], "3.0\n")

    def test_logico_impressao(self):
        self.assertEqual(rodar("escrever(1 < 2, \" \", 1 > 2);")[0], "verdadeiro falso\n")

    def test_valores_padrao(self):
        self.assertEqual(rodar('inteiro a; decimal b; texto c; logico d; escrever(a, "|", b, "|", c, "|", d);')[0],
                         "0|0.0||falso\n")

    def test_enquanto(self):
        out, _ = rodar("inteiro i = 1; enquanto (i <= 3) { escrever(i); i = i + 1; }")
        self.assertEqual(out, "1\n2\n3\n")

    def test_arvore_parcial_marca_o_erro(self):
        r = analisar("programa inteiro x = ; inteiro y = 2; fim")
        tipos = [type(c).__name__ for c in r.ast.comandos]
        self.assertEqual(tipos, ["Erro", "Declaracao"])             # o que deu certo continua na árvore
        self.assertEqual(r.ast.comandos[0].codigo, "P02")

    def test_senao_se(self):
        corpo = ("inteiro n = 5;"
                 "se (n < 3) { escrever(\"a\"); } senao se (n < 10) { escrever(\"b\"); } senao { escrever(\"c\"); }")
        self.assertEqual(rodar(corpo)[0], "b\n")

    def test_curto_circuito(self):
        # a divisão por zero nunca é avaliada
        out, erros = rodar("inteiro z = 0; se (falso e 1 / z == 1) { escrever(\"x\"); } escrever(\"ok\");")
        self.assertEqual((out, erros), ("ok\n", []))

    def test_ler_todos_os_tipos(self):
        out, erros = rodar("inteiro a; decimal b; texto c; logico d;"
                           "ler(a); ler(b); ler(c); ler(d); escrever(a, b, c, d);",
                           ["7", "2,5", "oi mundo", "verdadeiro"])
        self.assertEqual((out, erros), ("72.5oi mundoverdadeiro\n", []))

    def test_erros_de_execucao(self):
        self.assertEqual(rodar("escrever(1 / 0);")[1], ["E01"])
        self.assertEqual(rodar("inteiro a; ler(a);", ["abc"])[1], ["E02"])
        self.assertEqual(rodar("inteiro a; ler(a);")[1], ["E04"])

    def test_limite_de_passos(self):
        r = executar("programa enquanto (verdadeiro) { } fim", max_passos=1000)
        self.assertEqual([e.codigo for e in r.erros], ["E03"])

    def test_nao_executa_com_erro_semantico(self):
        out, erros = rodar('escrever("antes"); inteiro x = "a";')
        self.assertEqual((out, erros), ("", ["S03"]))

    def test_observador_recebe_anotacoes(self):
        regs = []

        def obs(no, variaveis):
            reg = {"no": type(no).__name__}
            regs.append(reg)
            return reg          # o interpretador completa o registro

        executar('programa inteiro i = 0; enquanto (i < 2) { i = i + 1; } escrever("ok"); fim', observador=obs)
        self.assertEqual(regs[0]["valor"], "0")                                   # declaração
        conds = [r["condicao"] for r in regs if r["no"] == "Enquanto"]
        self.assertEqual(conds, [True, True, False])                              # confere a cada volta
        self.assertEqual([r["valor"] for r in regs if r["no"] == "Atribuicao"], ["1", "2"])
        self.assertEqual(regs[-1]["texto"], "ok")

    def test_observador_recebe_variaveis(self):
        vistos = []
        executar("programa inteiro a = 4; a = a + 1; fim",
                 observador=lambda no, v: vistos.append(dict(v)))
        self.assertEqual(vistos[-1]["a"]["valor"], "4")   # antes do último comando
        self.assertEqual(len(vistos), 2)


class TesteExemplos(unittest.TestCase):
    def rodar_arquivo(self, nome, entradas=()):
        with open(os.path.join(EXEMPLOS, nome), encoding="utf-8") as f:
            fonte = f.read()
        it = iter(entradas)
        out = []
        r = executar(fonte, lambda: next(it, None), out.append)
        return "".join(out), [e.codigo for e in r.erros]

    def test_idade(self):
        out, erros = self.rodar_arquivo("01_idade.pl")
        self.assertEqual((out, erros), ("Maior de idade\n1\n2\n3\n4\n5\n", []))

    def test_media(self):
        out, erros = self.rodar_arquivo("02_media.pl", ["Ana", "8", "7,5"])
        self.assertEqual(erros, [])
        self.assertTrue(out.endswith("Ana foi aprovado(a) com 7.75\n"))

    def test_fatorial(self):
        out, erros = self.rodar_arquivo("03_fatorial.pl", ["5"])
        self.assertTrue(out.endswith("5! = 120\n"))
        self.assertEqual(erros, [])

    def test_logico(self):
        out, erros = self.rodar_arquivo("04_logico.pl")
        self.assertEqual((out, erros), ("Pode dirigir: verdadeiro\n", []))

    def test_exemplos_com_erro(self):
        esperado = {
            "erro_lexico.pl": ["L01", "L02", "L03"],
            "erro_sintatico.pl": ["P02", "P01", "P05"],
            "erro_semantico.pl": ["S03", "S01", "S02", "S04", "S07", "S05", "S09"],
            "erro_execucao.pl": ["E01"],
        }
        for nome, cods in esperado.items():
            with self.subTest(nome):
                self.assertEqual(self.rodar_arquivo(nome)[1], cods)


if __name__ == "__main__":
    unittest.main()

class TesteDelimitadoresAbertos(unittest.TestCase):
    def codigos(self, fonte):
        from portulang import analisar
        return [e.codigo for e in analisar(fonte).erros]

    def test_chave_aberta_aponta_para_a_abertura(self):
        from portulang import analisar
        r = analisar("programa\nse (verdadeiro) {\nescrever(1);\nfim")
        p05 = [e for e in r.erros if e.codigo == "P05"]
        self.assertEqual((p05[0].linha, p05[0].coluna), (2, 17))

    def test_parentese_da_condicao_sem_fechar_nao_vira_cascata(self):
        self.assertEqual(self.codigos("programa\nse (verdadeiro {\nescrever(1);\n}\nfim"), ["P05"])

class TesteCodigoIntermediario(unittest.TestCase):
    """A máquina virtual precisa dar exatamente o mesmo resultado que o interpretador da árvore."""

    def comparar(self, fonte, entradas=()):
        from portulang import analisar
        from portulang.erros import ErroPortuLang
        from portulang.codigo import gerar_codigo, executar_codigo
        from portulang.interpretador import Interpretador
        r = analisar(fonte)
        self.assertTrue(r.ok, [e.mensagem for e in r.erros])
        resultados = []
        for modo in ("arvore", "vm"):
            it, out, erro = iter(entradas), [], None
            try:
                if modo == "arvore":
                    Interpretador(lambda: next(it, None), out.append).executar(r.ast)
                else:
                    executar_codigo(gerar_codigo(r.ast), lambda: next(it, None), out.append)
            except ErroPortuLang as e:
                erro = (e.codigo, e.linha, e.coluna)
            resultados.append(("".join(out), erro))
        self.assertEqual(resultados[0], resultados[1])
        return resultados[0]

    def test_exemplos(self):
        for nome, entradas in [("01_idade.pl", []), ("02_media.pl", ["Ana", "8", "7,5"]),
                               ("03_fatorial.pl", ["5"]), ("04_logico.pl", []), ("erro_execucao.pl", [])]:
            with self.subTest(nome):
                with open(os.path.join(EXEMPLOS, nome), encoding="utf-8") as f:
                    self.comparar(f.read(), entradas)

    def test_curto_circuito_e_blocos(self):
        out, erro = self.comparar(
            'programa\ninteiro i = 0;\nenquanto (i < 3 e nao (i == 5)) {\n inteiro d = i * 2;\n'
            ' se (d == 2 ou d > 3) { escrever("d=", d); } senao { escrever("x", i); }\n i = i + 1;\n}\nfim')
        self.assertEqual(out, "x0\nd=2\nd=4\n")

    def test_decimais_texto_e_divisao(self):
        out, erro = self.comparar('programa\ndecimal a = 7;\ninteiro q = 0 - 7 / 2;\ntexto t = "oi";\nescrever(t + "!", a, " ", q, -a);\nfim')
        self.assertEqual(out, "oi!7.0 -3-7.0\n")

    def test_erros_iguais(self):
        self.assertEqual(self.comparar("programa\ninteiro x = 0;\nescrever(1 / x);\nfim")[1][0], "E01")
        self.assertEqual(self.comparar("programa\ninteiro x;\nler(x);\nfim", ["abc"])[1][0], "E02")

    def test_lista_de_instrucoes(self):
        from portulang import analisar
        from portulang.codigo import gerar_codigo
        cod = gerar_codigo(analisar("programa\ninteiro x = 1 + 2;\nfim").ast)
        self.assertEqual([i.op for i in cod], ["EMPILHAR", "EMPILHAR", "SOMAR", "CRIAR", "PARAR"])

class TesteTranspilador(unittest.TestCase):
    """O Python gerado precisa se comportar como o interpretador."""

    def rodar_python(self, fonte, entradas=()):
        from portulang import analisar
        from portulang.transpilador import traduzir_para_python, texto_completo
        r = analisar(fonte)
        self.assertTrue(r.ok)
        codigo = texto_completo(traduzir_para_python(r.ast))
        it, out = iter(entradas), []

        def entrada():
            try:
                return next(it)
            except StopIteration:
                raise EOFError

        g = {"input": entrada, "print": lambda s="": out.append(str(s) + "\n")}
        erro = None
        try:
            exec(compile(codigo, "<gerado>", "exec"), g)
        except ZeroDivisionError:
            erro = "E01"
        except SystemExit:
            erro = "E02"
        except EOFError:
            erro = "E04"
        return "".join(out), erro

    def rodar_arvore(self, fonte, entradas=()):
        from portulang import executar
        it, out = iter(entradas), []
        r = executar(fonte, lambda: next(it, None), out.append)
        return "".join(out), (r.erros[0].codigo if r.erros else None)

    def conferir(self, fonte, entradas=()):
        self.assertEqual(self.rodar_python(fonte, entradas), self.rodar_arvore(fonte, entradas))

    def test_exemplos(self):
        for nome, entradas in [("01_idade.pl", []), ("02_media.pl", ["Ana", "8", "7,5"]),
                               ("03_fatorial.pl", ["5"]), ("04_logico.pl", []), ("erro_execucao.pl", [])]:
            with self.subTest(nome):
                with open(os.path.join(EXEMPLOS, nome), encoding="utf-8") as f:
                    self.conferir(f.read(), entradas)

    def test_casos_especiais(self):
        self.conferir('programa\ndecimal a = 7;\ninteiro q = 0 - 7 / 2;\ntexto t = "oi";\nescrever(t + "!", a, " ", q, -a);\nfim')
        self.conferir('programa\ninteiro i = 0;\nenquanto (i < 3 e nao (i == 5)) {\n se (i == 0) { escrever("zero"); } senao se (i == 1) { escrever("um"); } senao { escrever("outro"); }\n i = i + 1;\n}\nfim')
        self.conferir('programa\ninteiro class = 2;\ninteiro print = class * 3;\nescrever(print);\nfim')
        self.conferir("programa\ninteiro x;\nler(x);\nfim", ["abc"])
        self.conferir("programa\ninteiro x;\nler(x);\nfim")
        self.conferir("programa\nse (verdadeiro) {\n}\nfim")
