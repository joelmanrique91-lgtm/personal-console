import shutil
import subprocess
import sys
from pathlib import Path


def main() -> None:
    repo_root = Path(__file__).resolve().parent
    shutil.os.chdir(repo_root)

    if shutil.which("node") is None:
        print("Node.js no esta instalado. Descargalo desde https://nodejs.org/.")
        sys.exit(1)

    if not shutil.which("npm"):
        print("npm no esta disponible. Reinstala Node.js para incluir npm.")
        sys.exit(1)

    if not shutil.os.path.exists("node_modules"):
        print("Instalando dependencias...")
        subprocess.check_call(["npm", "install"])

    if shutil.which("cloudflared") is None:
        print("cloudflared no esta instalado.")
        print("Instalacion sugerida: winget install Cloudflare.cloudflared")
        print("Tambien podes usar: choco install cloudflared")
        sys.exit(1)

    print("URL local: http://localhost:5173")
    print("Iniciando Vite en http://localhost:5173 ...")
    vite_process = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
    )
    print("Iniciando Cloudflare Tunnel...")
    tunnel_process = subprocess.Popen(
        ["cloudflared", "tunnel", "--url", "http://localhost:5173"]
    )

    try:
        tunnel_process.wait()
    except KeyboardInterrupt:
        print("\nCerrando procesos...")
    finally:
        tunnel_process.terminate()
        vite_process.terminate()
        tunnel_process.wait(timeout=5)
        vite_process.wait(timeout=5)


if __name__ == "__main__":
    main()
