"""Uso: python -m portulang arquivo.pl [--tokens] [--ast] [--simbolos]"""
import argparse
import json
import sys

from . import analisar, executar
from .ast_nodes import para_dict


def _imprimir_arvore(no, prefixo="", ultimo=True, raiz=True):
    tipo = f"  : {no['tipo']}" if no.get("tipo") else ""
    if raiz:
        print(no["rotulo"])
    else:
        print(prefixo + ("└── " if ultimo else "├── ") + no["rotulo"] + tipo)
    filhos = no.get("filhos", [])
    novo = prefixo if raiz else prefixo + ("    " if ultimo else "│   ")
    for i, f in enumerate(filhos):
        _imprimir_arvore(f, novo, i == len(filhos) - 1, raiz=False)


def main():
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser(prog="portulang", description="Interpretador da PortuLang")
    ap.add_argument("arquivo")
    ap.add_argument("--tokens", action="store_true", help="mostra os tokens")
    ap.add_argument("--ast", action="store_true", help="mostra a árvore sintática")
    ap.add_argument("--simbolos", action="store_true", help="mostra a tabela de símbolos")
    ap.add_argument("--json", action="store_true", help="saída da análise em JSON")
    ap.add_argument("--sem-executar", action="store_true", help="só analisa")
    a = ap.parse_args()

    with open(a.arquivo, encoding="utf-8") as f:
        fonte = f.read()

    if a.tokens or a.ast or a.simbolos or a.json:
        r = analisar(fonte)
        if a.json:
            print(json.dumps({
                "tokens": [t.para_dict() for t in r.tokens],
                "ast": para_dict(r.ast) if r.ast else None,
                "simbolos": r.simbolos,
                "erros": [e.para_dict() for e in r.erros],
            }, ensure_ascii=False, indent=2))
        else:
            if a.tokens:
                print(f"{'TIPO':<16}{'LEXEMA':<14}LINHA:COL")
                for t in r.tokens:
                    print(f"{t.tipo:<16}{t.lexema!r:<14}{t.linha}:{t.coluna}")
            if a.ast and r.ast and not r.fase_com_erro in ("léxico", "sintático"):
                _imprimir_arvore(para_dict(r.ast))
            if a.simbolos:
                print(f"{'NOME':<14}{'TIPO':<10}{'LINHA':<7}ESCOPO")
                for s in r.simbolos:
                    print(f"{s['nome']:<14}{s['tipo']:<10}{s['linha']:<7}{s['escopo']}")
        for e in r.erros:
            print(e, file=sys.stderr)
        if r.erros or a.sem_executar:
            sys.exit(1 if r.erros else 0)

    def entrada():
        linha = sys.stdin.readline()
        return linha if linha != "" else None

    r = executar(fonte, entrada, sys.stdout.write)
    for e in r.erros:
        print(e, file=sys.stderr)
    sys.exit(1 if r.erros else 0)


if __name__ == "__main__":
    main()
