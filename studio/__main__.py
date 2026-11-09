"""Uso: python -m studio [--porta 8765] [--sem-navegador]"""
import argparse

from .server import main

ap = argparse.ArgumentParser(prog="studio", description="PortuLang Studio")
ap.add_argument("--porta", type=int, default=8765)
ap.add_argument("--sem-navegador", action="store_true")
a = ap.parse_args()
main(a.porta, not a.sem_navegador)
