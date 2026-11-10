# Gera o aplicativo de janela (build\dist\PortuLang\PortuLang.exe) e o zip em release\
# Requisitos: Python 3.11+ (cria o ambiente em build\venv na primeira vez).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path build\venv)) { python -m venv build\venv }
& build\venv\Scripts\python.exe -m pip install --quiet --disable-pip-version-check pywebview pyinstaller pillow
& build\venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --windowed --name PortuLang `
  --icon "$PWD\assets\PortuLang.ico" --distpath build\dist --workpath build\work --specpath build `
  --add-data "$PWD\studio\static;studio\static" --add-data "$PWD\exemplos;exemplos" `
  --collect-all webview --hidden-import studio.server --paths $PWD desktop.py
# Arquivos baixados da internet vem com a "marca da web"; sem este arquivo o .NET se recusa a carregar as DLLs do pywebview/pythonnet
$config = '<?xml version="1.0" encoding="utf-8"?><configuration><runtime><loadFromRemoteSources enabled="true"/></runtime></configuration>'
Set-Content -Path build\dist\PortuLang\PortuLang.exe.config -Value $config -Encoding utf8
Copy-Item LEIA-ME.txt build\dist\PortuLang\ -Force
New-Item -ItemType Directory -Force release | Out-Null
$zip = "release\PortuLang-windows.zip"; if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path build\dist\PortuLang -DestinationPath $zip
"Pronto: $zip"
