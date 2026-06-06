"""
gmail_import.py — Descarga extractos bancarios de Gmail e importa a Dilusso Joyas.

Uso:
  python scripts/gmail_import.py --banco scotiabank-pdf
  python scripts/gmail_import.py --banco bbva-xls --dias 60
  python scripts/gmail_import.py --all

Variables de entorno requeridas:
  GMAIL_CREDENTIALS_JSON  → path al archivo credentials.json de Google Cloud
  GMAIL_TOKEN_JSON        → path al archivo token.json (se crea en primer uso)
  DILUSSO_API_URL         → https://dilusso-joyas.vercel.app (o localhost:3000)
"""

import os
import sys
import base64
import json
import argparse
import requests
from datetime import datetime, timedelta
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# ── Configuración ─────────────────────────────────────────────────────────────

API_URL = os.getenv("DILUSSO_API_URL", "https://dilusso-joyas.vercel.app")
CREDENTIALS_FILE = os.getenv("GMAIL_CREDENTIALS_JSON", "credentials.json")
TOKEN_FILE = os.getenv("GMAIL_TOKEN_JSON", "token.json")
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Mapa de banco → { query Gmail, tipo import, extensiones válidas }
BANCOS = {
    "bbva-xls": {
        "query": "from:bbva.com.uy has:attachment (filename:xls OR filename:xlsx) subject:(extracto OR movimientos OR cuenta corriente)",
        "tipos": [".xls", ".xlsx"],
        "label": "BBVA XLS",
    },
    "bbva-pdf": {
        "query": "from:bbva.com.uy has:attachment filename:pdf subject:(extracto OR estado de cuenta OR movimientos)",
        "tipos": [".pdf"],
        "label": "BBVA PDF",
    },
    "itau-xls": {
        "query": "from:itau.com.uy has:attachment (filename:xls OR filename:xlsx) subject:(extracto OR movimientos OR cuenta)",
        "tipos": [".xls", ".xlsx"],
        "label": "Itaú XLS",
    },
    "oca-pdf": {
        "query": "from:oca.com.uy has:attachment filename:pdf subject:(extracto OR estado de cuenta)",
        "tipos": [".pdf"],
        "label": "OCA PDF",
    },
    "scotiabank-pdf": {
        "query": "from:scotiabank.com.uy has:attachment filename:pdf",
        "tipos": [".pdf"],
        "label": "Scotiabank PDF",
    },
    "itau-card-pdf": {
        "query": "from:itau.com.uy has:attachment filename:pdf subject:(visa OR tarjeta OR liquidacion OR estado de cuenta tarjeta)",
        "tipos": [".pdf"],
        "label": "Itaú Tarjeta PDF",
    },
}

# ── Autenticación Gmail ────────────────────────────────────────────────────────

def get_gmail_service():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)

# ── Buscar y descargar adjuntos ────────────────────────────────────────────────

def search_messages(service, query, dias=30):
    after = (datetime.now() - timedelta(days=dias)).strftime("%Y/%m/%d")
    full_query = f"{query} after:{after}"
    print(f"  Query: {full_query}")

    result = service.users().messages().list(userId="me", q=full_query, maxResults=50).execute()
    return result.get("messages", [])


def get_attachments(service, msg_id, extensiones_validas):
    """Retorna lista de {filename, data_b64} para adjuntos con extensión válida."""
    msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
    attachments = []

    def walk_parts(parts):
        for part in parts:
            fname = part.get("filename", "")
            ext = os.path.splitext(fname)[1].lower()
            if ext in extensiones_validas and part.get("body", {}).get("attachmentId"):
                att = service.users().messages().attachments().get(
                    userId="me", messageId=msg_id, id=part["body"]["attachmentId"]
                ).execute()
                attachments.append({"filename": fname, "data_b64": att["data"]})
            if "parts" in part:
                walk_parts(part["parts"])

    payload = msg.get("payload", {})
    if "parts" in payload:
        walk_parts(payload["parts"])

    return attachments

# ── Importar al sistema ────────────────────────────────────────────────────────

def import_attachment(filename, data_b64, banco):
    # Gmail usa base64 URL-safe; convertir a estándar
    data_b64_std = data_b64.replace("-", "+").replace("_", "/")

    url = f"{API_URL}/api/admin/import-from-base64"
    resp = requests.post(url, json={
        "base64": data_b64_std,
        "filename": filename,
        "banco": banco,
    }, timeout=120)

    if resp.ok:
        return resp.json()
    else:
        return {"error": resp.text}

# ── Main ───────────────────────────────────────────────────────────────────────

def run_banco(service, banco_key, dias=30):
    cfg = BANCOS[banco_key]
    print(f"\n{'='*60}")
    print(f"Banco: {cfg['label']}")
    msgs = search_messages(service, cfg["query"], dias)
    print(f"  Emails encontrados: {len(msgs)}")

    total_inserted = 0
    total_skipped = 0
    processed_files = set()

    for msg in msgs:
        atts = get_attachments(service, msg["id"], cfg["tipos"])
        for att in atts:
            fname = att["filename"]
            if fname in processed_files:
                continue
            processed_files.add(fname)

            print(f"  → Importando: {fname}")
            result = import_attachment(fname, att["data_b64"], banco_key)

            if "error" in result:
                print(f"    ✗ Error: {result['error']}")
            else:
                ins = result.get("inserted", 0)
                skp = result.get("skipped", 0)
                warn = result.get("warning", "")
                total_inserted += ins
                total_skipped += skp
                if warn:
                    print(f"    ⚠ {warn}")
                else:
                    print(f"    ✓ {ins} nuevos, {skp} ya existían")

    print(f"  Total: {total_inserted} insertados, {total_skipped} omitidos")
    return total_inserted


def main():
    parser = argparse.ArgumentParser(description="Importar extractos bancarios desde Gmail")
    parser.add_argument("--banco", choices=list(BANCOS.keys()), help="Banco a importar")
    parser.add_argument("--all", action="store_true", help="Importar todos los bancos")
    parser.add_argument("--dias", type=int, default=30, help="Buscar emails de los últimos N días (default: 30)")
    args = parser.parse_args()

    if not args.banco and not args.all:
        parser.print_help()
        sys.exit(1)

    print("Conectando a Gmail...")
    service = get_gmail_service()
    print("✓ Conectado")

    bancos_a_procesar = list(BANCOS.keys()) if args.all else [args.banco]
    total = 0
    for banco in bancos_a_procesar:
        total += run_banco(service, banco, args.dias)

    print(f"\n{'='*60}")
    print(f"Total general: {total} movimientos nuevos importados")


if __name__ == "__main__":
    main()
