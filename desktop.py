"""PortuLang Studio como aplicativo de janela própria (sem abrir o navegador).

Sobe o servidor local numa porta livre e mostra a página numa janela nativa
(WebView2 do Windows). Ao fechar a janela, o servidor encerra junto.
Se a janela própria não puder abrir (por exemplo, sem WebView2), abre no navegador."""
import os
import sys
import threading


def caixa(texto, icone=0x40):
    """Caixa de mensagem do Windows (o aplicativo não tem console)."""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, texto, "PortuLang", icone)
    except Exception:
        pass


class Zoom:
    """Zoom da janela: automático em telas pequenas e ajustável pelos botões − e + do cabeçalho."""

    def __init__(self, pasta):
        self.arquivo = os.path.join(pasta, "zoom.txt")
        self.janela = None
        self.fator = 1.0

    def _aplicar(self, f):
        f = max(0.5, min(2.0, round(f, 2)))
        try:
            from System import Action
            wv = self.janela.native.webview
            self.janela.native.Invoke(Action(lambda: setattr(wv, "ZoomFactor", f)))     # precisa rodar na thread da janela
            self.fator = f
        except Exception:
            pass
        return self.fator

    def _salvar(self):
        try:
            with open(self.arquivo, "w") as a:
                a.write(str(self.fator))
        except OSError:
            pass

    # --- chamados pela página (botões do cabeçalho)
    def zoom(self, delta):
        r = self._aplicar(self.fator + delta)
        self._salvar()
        return r

    def zoom_padrao(self):
        r = self._aplicar(1.0)
        self._salvar()
        return r

    def zoom_atual(self):
        return self.fator

    def ao_carregar(self):
        """Primeira vez: encolhe se a janela for pequena para o layout (feito para ~1500 px). Depois, lembra a escolha."""
        try:
            if os.path.exists(self.arquivo):
                self._aplicar(float(open(self.arquivo).read().strip()))
            else:
                larg = self.janela.evaluate_js("window.innerWidth")
                alt = self.janela.evaluate_js("window.innerHeight")
                f = min(1.0, larg / 1500, alt / 860)
                if f < 0.97:
                    self._aplicar(max(0.6, round(f * 20) / 20))
            self.janela.evaluate_js("(()=>{const e=document.querySelector('#zoom-pct'); if(e) e.textContent='%d%%';})()" % round(self.fator * 100))
        except Exception:
            pass


_zoom = None


class ApiZoom:
    """O que a página enxerga. Fica sem atributos de propósito: o pywebview percorre tudo que um objeto da API
    guarda, e percorrer a janela inteira não termina."""

    def zoom(self, delta):
        return _zoom.zoom(delta)

    def zoom_padrao(self):
        return _zoom.zoom_padrao()

    def zoom_atual(self):
        return _zoom.zoom_atual()


def main():
    global _zoom
    from studio.server import criar_servidor

    srv = criar_servidor()
    porta = srv.server_address[1]
    url = f"http://127.0.0.1:{porta}/"
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    pasta_dados = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "PortuLang")
    os.makedirs(pasta_dados, exist_ok=True)              # guarda o código, o tema, o zoom e as proporções entre uma abertura e outra
    falha = None
    try:
        if os.environ.get("PORTULANG_FORCAR_NAVEGADOR"):
            raise RuntimeError("teste: janela própria desligada")
        import webview
        webview.settings["ALLOW_DOWNLOADS"] = True       # botões "Salvar" (.pl) e "Baixar .py"
        _zoom = Zoom(pasta_dados)
        _zoom.janela = webview.create_window(
            "PortuLang", url, width=1440, height=900, min_size=(900, 600), background_color="#0b0d1c",
            zoomable=True, js_api=ApiZoom(),             # Ctrl + roda e Ctrl + / Ctrl - também dão zoom
        )
        _zoom.janela.events.loaded += _zoom.ao_carregar
        webview.start(private_mode=False, storage_path=pasta_dados)
    except Exception as e:
        falha = e
    finally:
        if falha is None:
            srv.shutdown()
    if falha is not None:
        # plano B: abre no navegador do computador e mantém o servidor vivo até a pessoa fechar esta mensagem
        if not os.environ.get("PORTULANG_SEM_NAVEGADOR"):
            import webbrowser
            webbrowser.open(url)
        caixa("A janela própria do PortuLang não pôde abrir neste computador, então ele foi aberto no seu navegador.\n\n"
              "Deixe esta mensagem aberta enquanto estiver usando. Clique em OK para encerrar o PortuLang.\n\n"
              f"(Detalhe técnico: {falha})", 0x40)
        srv.shutdown()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        dica = ""
        if "Python.Runtime" in str(e):
            dica = ("\n\nO Windows provavelmente bloqueou os arquivos baixados da internet. Feche, clique com o botão direito no "
                    "arquivo .zip, escolha Propriedades, marque \"Desbloquear\", clique em OK e extraia de novo.")
        caixa(f"Não foi possível abrir o PortuLang:\n\n{e}{dica}", 0x10)
        sys.exit(1)
