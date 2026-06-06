"""
import_folder.py — Importa todos los extractos bancarios de una carpeta.

Detecta automáticamente el banco y tipo por el contenido del archivo.
Soporta PDF y XLS/XLSX mezclados en la misma carpeta.

Uso:
  python scripts/import_folder.py /ruta/a/la/carpeta
  python scripts/import_folder.py /ruta/a/la/carpeta --dry-run
  python scripts/import_folder.py .  # carpeta actual

Env vars opcionales:
  DILUSSO_API_URL  → https://dilusso-joyas.vercel.app (default)
"""

import os
import sys
import base64
import argparse
import requests

API_URL = os.getenv("DILUSSO_API_URL", "https://dilusso-joyas.vercel.app")

# ── Detección automática de banco ─────────────────────────────────────────────

def detect_banco_pdf(filepath):
    """Lee el PDF y detecta el banco por strings conocidos."""
    try:
        with open(filepath, "rb") as f:
            raw = f.read()
        # Decodificar partes legibles del binario PDF
        text = raw.decode("latin-1", errors="ignore").upper()

        if "SCOTIABANK URUGUAY" in text:
            return "scotiabank-pdf"
        if "BANCO ITA" in text and "VISA" in text:
            return "itau-card-pdf"
        if "BBVA" in text and ("PESOS URUGUAYOS" in text or "DOLARES U.S.A" in text or "CUENTAS CORRIENTES" in text or "CAJA DE AHORROS" in text):
            return "bbva-pdf"
        if "OCA S.A" in text or "OCA BLUE" in text or ("OCA" in text and "ESTADO DE CUENTA" in text):
            return "oca-pdf"
        if "BANCO ITA" in text:
            return "itau-card-pdf"  # fallback Itaú
    except Exception as e:
        print(f"    ⚠ No se pudo leer el PDF: {e}")
    return None


def detect_banco_xls(filepath):
    """Lee el XLS/XLSX y detecta el banco por celdas conocidas."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        ws = wb.active
        # Leer primeras 10 filas como texto plano
        rows = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            rows.append([str(c).upper() if c is not None else "" for c in row])
            if i >= 9:
                break

        full_text = " ".join(cell for row in rows for cell in row)

        if "CUENTAS CORRIENTES" in full_text:
            return "bbva-xls"
        # Itaú: buscar cuenta 365921 o 365913 o "Dólares" en fila 5 col G
        if len(rows) >= 5 and len(rows[4]) >= 7:
            g5 = rows[4][6]
            if "365921" in g5 or "365913" in g5 or "DOLARES" in g5 or "DOLAR" in g5:
                return "itau-xls"
        if "365921" in full_text or "365913" in full_text:
            return "itau-xls"
    except Exception:
        # Try xlrd for old .xls format
        try:
            import xlrd
            wb = xlrd.open_workbook(filepath)
            ws = wb.sheet_by_index(0)
            rows = []
            for i in range(min(10, ws.nrows)):
                rows.append([str(ws.cell_value(i, j)).upper() for j in range(ws.ncols)])
            full_text = " ".join(cell for row in rows for cell in row)
            if "CUENTAS CORRIENTES" in full_text:
                return "bbva-xls"
            if "365921" in full_text or "365913" in full_text:
                return "itau-xls"
        except Exception as e:
            print(f"    ⚠ No se pudo leer el XLS: {e}")
    return None


def detect_banco(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext in (".xls", ".xlsx"):
        return detect_banco_xls(filepath)
    elif ext == ".pdf":
        return detect_banco_pdf(filepath)
    return None


BANCO_LABELS = {
    "bbva-xls":       "BBVA XLS",
    "bbva-pdf":       "BBVA PDF",
    "itau-xls":       "Itaú XLS",
    "oca-pdf":        "OCA PDF",
    "scotiabank-pdf": "Scotiabank PDF",
    "itau-card-pdf":  "Itaú Tarjeta PDF",
}

# ── Importar al sistema ────────────────────────────────────────────────────────

def import_file(filepath, banco, dry_run=False):
    filename = os.path.basename(filepath)

    if dry_run:
        print(f"    [DRY RUN] importaría como {BANCO_LABELS.get(banco, banco)}")
        return {"dry_run": True}

    with open(filepath, "rb") as f:
        data = f.read()

    b64 = base64.b64encode(data).decode("utf-8")

    try:
        resp = requests.post(
            f"{API_URL}/api/admin/import-from-base64",
            json={"base64": b64, "filename": filename, "banco": banco},
            timeout=120,
        )
        if resp.ok:
            return resp.json()
        else:
            return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"error": str(e)}

# ── Main ───────────────────────────────────────────────────────────────────────

VALID_EXTS = {".pdf", ".xls", ".xlsx"}

def main():
    parser = argparse.ArgumentParser(description="Importar extractos bancarios desde una carpeta")
    parser.add_argument("carpeta", help="Carpeta con los archivos")
    parser.add_argument("--dry-run", action="store_true", help="Solo detecta, no importa")
    args = parser.parse_args()

    carpeta = os.path.abspath(args.carpeta)
    if not os.path.isdir(carpeta):
        print(f"Error: '{carpeta}' no es una carpeta válida")
        sys.exit(1)

    archivos = sorted([
        f for f in os.listdir(carpeta)
        if os.path.splitext(f)[1].lower() in VALID_EXTS
    ])

    if not archivos:
        print(f"No se encontraron archivos PDF/XLS en {carpeta}")
        sys.exit(0)

    print(f"Carpeta: {carpeta}")
    print(f"Archivos encontrados: {len(archivos)}\n")

    total_inserted = 0
    no_detectados = []

    for fname in archivos:
        fpath = os.path.join(carpeta, fname)
        print(f"📄 {fname}")

        banco = detect_banco(fpath)
        if not banco:
            print(f"    ✗ No se pudo detectar el banco — omitido")
            no_detectados.append(fname)
            continue

        print(f"    Detectado: {BANCO_LABELS.get(banco, banco)}")
        result = import_file(fpath, banco, dry_run=args.dry_run)

        if "error" in result:
            print(f"    ✗ Error: {result['error']}")
        elif result.get("dry_run"):
            pass
        else:
            ins = result.get("inserted", 0)
            skp = result.get("skipped", 0)
            warn = result.get("warning", "")
            total_inserted += ins
            if warn:
                print(f"    ⚠ {warn}")
            else:
                print(f"    ✓ {ins} nuevos, {skp} ya existían")

    print(f"\n{'─'*50}")
    if args.dry_run:
        print("Dry run completado — no se importó nada")
    else:
        print(f"Total: {total_inserted} movimientos nuevos importados")

    if no_detectados:
        print(f"\nArchivos no detectados ({len(no_detectados)}):")
        for f in no_detectados:
            print(f"  - {f}")


if __name__ == "__main__":
    main()
