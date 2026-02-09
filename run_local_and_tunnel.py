import shutil
import subprocess
import sys


def main() -> None:
    if shutil.which("node") is None:
        print("Node.js no esta instalado. Descargalo desde https://nodejs.org/.")
        sys.exit(1)

    if not shutil.which("npm"):
        print("npm no esta disponible. Reinstala Node.js para incluir npm.")
        sys.exit(1)

    if not shutil.os.path.exists("node_modules"):
        print("Instalando dependencias...")
        subprocess.check_call(["npm", "install"])

    print("Iniciando Vite en http://localhost:5173 ...")
    vite_process = subprocess.Popen(["npm", "run", "dev"])

    if shutil.which("cloudflared") is None:
        print("cloudflared no esta instalado.")
        print("Instalacion sugerida: winget install Cloudflare.cloudflared")
        print("Tambien podes usar: choco install cloudflared")
        vite_process.wait()
        sys.exit(1)

    print("URL local: http://localhost:5173")
    print("Iniciando Cloudflare Tunnel...")
    subprocess.call(["cloudflared", "tunnel", "--url", "http://localhost:5173"])


if __name__ == "__main__":
    main()
