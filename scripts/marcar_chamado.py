#!/usr/bin/env python3
"""Marca status de um chamado via API (reusa as mesmas credenciais do verificar_chamados.py).

Uso:
  python scripts/marcar_chamado.py <banco> <id> <status> ["resposta opcional"]
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
import os


def carregar_env_file(caminho: Path) -> None:
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip())


carregar_env_file(SCRIPT_DIR / "chamados.env")

API_URL = os.environ.get("CHAMADOS_API_URL", "https://api.administrandoleiloes.cc")
CPF = os.environ.get("CHAMADOS_CPF")
SENHA = os.environ.get("CHAMADOS_SENHA")


def requisicao(url: str, metodo: str = "GET", body=None, token=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=metodo)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (compatible; Leiloes2026-ChamadosBot/1.0)")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def login(banco: str):
    r = requisicao(f"{API_URL}/api/{banco}/auth/login", "POST", {"cpf": CPF, "senha": SENHA})
    return r.get("token")


def main():
    if len(sys.argv) < 4:
        print("Uso: marcar_chamado.py <banco> <id> <status> [resposta]", file=sys.stderr)
        sys.exit(1)
    banco, cid, status = sys.argv[1], sys.argv[2], sys.argv[3]
    resposta = sys.argv[4] if len(sys.argv) > 4 else None

    token = login(banco)
    if not token:
        print("login falhou", file=sys.stderr)
        sys.exit(1)

    body = {"status": status}
    if resposta is not None:
        body["resposta"] = resposta

    try:
        r = requisicao(f"{API_URL}/api/{banco}/chamados/{cid}/status", "PATCH", body, token=token)
        print(json.dumps(r, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"erro {e.code}: {e.read().decode('utf-8', errors='replace')}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
