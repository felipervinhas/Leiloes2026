#!/usr/bin/env python3
"""
Verifica chamados novos (abertura de tickets de erro/melhoria) em um ou mais
bancos do sistema Leiloes2026, comparando com o que já foi visto antes.

Configuração via variáveis de ambiente (ou um arquivo scripts/chamados.env,
formato CHAVE=valor, um por linha):

  CHAMADOS_API_URL   URL base da API (default: https://api.administrandoleiloes.cc)
  CHAMADOS_BANCOS    Bancos a checar, separados por vírgula
                      (default: knorr,MacedoLeiloes,LoteRural,G2,MacedoBkp)
  CHAMADOS_CPF       CPF do usuário admin usado pra login
  CHAMADOS_SENHA     Senha desse usuário
  CHAMADOS_STATE     Caminho do arquivo de estado (default: scripts/.chamados_state.json)

Uso:
  python scripts/verificar_chamados.py            # lista só os novos desde a última execução
  python scripts/verificar_chamados.py --todos     # lista todos os pendentes/em andamento, ignorando o estado salvo
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


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
BANCOS = [b.strip() for b in os.environ.get(
    "CHAMADOS_BANCOS", "knorr,MacedoLeiloes,LoteRural,G2,MacedoBkp"
).split(",") if b.strip()]
CPF = os.environ.get("CHAMADOS_CPF")
SENHA = os.environ.get("CHAMADOS_SENHA")
STATE_FILE = Path(os.environ.get("CHAMADOS_STATE", str(SCRIPT_DIR / ".chamados_state.json")))

STATUS_ABERTOS = {"Pendente", "Em Andamento"}


def requisicao(url: str, metodo: str = "GET", body: dict | None = None, token: str | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=metodo)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    # Cloudflare bloqueia (403) o User-Agent padrão do urllib por parecer bot.
    req.add_header("User-Agent", "Mozilla/5.0 (compatible; Leiloes2026-ChamadosBot/1.0)")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def login(banco: str) -> str | None:
    try:
        r = requisicao(f"{API_URL}/api/{banco}/auth/login", "POST", {"cpf": CPF, "senha": SENHA})
        return r.get("token")
    except urllib.error.HTTPError as e:
        print(f"[{banco}] login falhou ({e.code}) — pulando", file=sys.stderr)
        return None
    except Exception as e:
        print(f"[{banco}] erro de conexão no login: {e} — pulando", file=sys.stderr)
        return None


def listar_chamados(banco: str, token: str) -> list[dict]:
    return requisicao(f"{API_URL}/api/{banco}/chamados", token=token)


def carregar_estado() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def salvar_estado(estado: dict) -> None:
    STATE_FILE.write_text(json.dumps(estado, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    # Evita mojibake no console do Windows (cp1252) ao imprimir acentos.
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser()
    parser.add_argument("--todos", action="store_true", help="Lista tudo que está aberto, ignora o estado salvo")
    args = parser.parse_args()

    if not CPF or not SENHA:
        print("Defina CHAMADOS_CPF e CHAMADOS_SENHA (env var ou scripts/chamados.env).", file=sys.stderr)
        sys.exit(1)

    estado = {} if args.todos else carregar_estado()
    novos_por_banco: dict[str, list[dict]] = {}

    for banco in BANCOS:
        token = login(banco)
        if not token:
            continue
        try:
            chamados = listar_chamados(banco, token)
        except Exception as e:
            print(f"[{banco}] erro ao listar chamados: {e}", file=sys.stderr)
            continue

        vistos = set(estado.get(banco, []))
        abertos = [c for c in chamados if c.get("status") in STATUS_ABERTOS]
        novos = abertos if args.todos else [c for c in abertos if c["id"] not in vistos]
        if novos:
            novos_por_banco[banco] = novos

        estado[banco] = [c["id"] for c in chamados]

    if not args.todos:
        salvar_estado(estado)

    if not novos_por_banco:
        print(json.dumps({"novos": {}}, ensure_ascii=False))
        return

    print(json.dumps({"novos": novos_por_banco}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
