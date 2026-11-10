"""PortuLang Studio como aplicativo de janela própria (sem abrir o navegador).

Sobe o servidor local numa porta livre e mostra a página numa janela nativa
(WebView2 do Windows). Ao fechar a janela, o servidor encerra junto."""
import os
import sys
import threading


def main():
    import webview
    from studio.server import criar_servidor

    srv = criar_servidor()
    porta = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    webview.settings["ALLOW_DOWNLOADS"] = True          # botões "Salvar" (.pl) e "Baixar .py"
    pasta_dados = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "PortuLang")
    os.makedirs(pasta_dados, exist_ok=True)              # guarda o código, o tema e as proporções entre uma abertura e outra

    webview.create_window(
        "PortuLang", f"http://127.0.0.1:{porta}/",
        width=1440, height=900, min_size=(1000, 640), background_color="#0b0d1c",
    )
    try:
        webview.start(private_mode=False, storage_path=pasta_dados)
    finally:
        srv.shutdown()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:                               # sem console: mostra o erro numa caixa de mensagem
        try:
            import ctypes
            dica = ""
            if "Python.Runtime" in str(e):
                dica = ("\n\nO Windows provavelmente bloqueou os arquivos baixados da internet. Feche, clique com o botão direito no "
                        "arquivo .zip, escolha Propriedades, marque \"Desbloquear\", clique em OK e extraia de novo.")
            ctypes.windll.user32.MessageBoxW(0, f"Não foi possível abrir o PortuLang:\n\n{e}{dica}", "PortuLang", 0x10)
        except Exception:
            pass
        sys.exit(1)
