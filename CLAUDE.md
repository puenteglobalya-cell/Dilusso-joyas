# Dilusso Joyas — Instrucciones para Claude

## Stack
- Next.js 15 App Router + TypeScript
- Supabase (PostgreSQL) — proyecto `acruykhrkugckpjcqwmb`
- Vercel deploy, branch de trabajo: `claude/magical-mendel-VpSUG`

## Tarea recurrente: Importar extractos bancarios desde Gmail

### Flujo completo

1. **Buscar emails** con adjuntos de cada banco usando el MCP de Gmail
2. **Obtener el adjunto** en base64 desde el thread
3. **Llamar al endpoint** `/api/admin/import-from-base64` con el archivo
4. **Confirmar** los movimientos insertados y hacer commit/push si hubo cambios de código

### URL del sistema

La app está en producción en Vercel. Para importar, usar la URL de producción (ver `.env` o Vercel dashboard).
En desarrollo local: `http://localhost:3000`

### Búsquedas de Gmail por banco

```
BBVA CC (extracto XLS/PDF):
  query: "from:bbva.com.uy has:attachment filename:(xls OR xlsx OR pdf) subject:(extracto OR cuenta corriente OR movimientos)"

Itaú (extracto XLS):
  query: "from:itau.com.uy has:attachment filename:(xls OR xlsx) subject:(extracto OR movimientos OR cuenta)"

OCA (PDF):
  query: "from:oca.com.uy has:attachment filename:pdf subject:(extracto OR estado de cuenta)"

Scotiabank (PDF):
  query: "from:scotiabank.com.uy has:attachment filename:pdf"

Itaú Tarjeta VISA (PDF):
  query: "from:itau.com.uy has:attachment filename:pdf subject:(visa OR tarjeta OR liquidacion)"
```

### Mapeo banco → tipo de import

| Banco | tipo (`banco` param) | Formato |
|-------|---------------------|---------|
| BBVA Cuenta Corriente XLS | `bbva-xls` | .xls/.xlsx |
| BBVA Cuenta PDF | `bbva-pdf` | .pdf |
| Itaú Cuenta XLS | `itau-xls` | .xls/.xlsx |
| OCA | `oca-pdf` | .pdf |
| Scotiabank | `scotiabank-pdf` | .pdf |
| Itaú Tarjeta VISA | `itau-card-pdf` | .pdf |

### Cómo llamar al endpoint

```bash
# El endpoint acepta POST con JSON:
POST /api/admin/import-from-base64
Content-Type: application/json

{
  "base64": "<contenido del archivo en base64>",
  "filename": "nombre-del-archivo.pdf",
  "banco": "scotiabank-pdf"
}

# Respuesta exitosa:
{ "ok": true, "inserted": 12, "parsed": 15, "skipped": 3 }
```

### Pasos detallados para Claude

```
1. mcp__Gmail__search_threads con la query del banco
2. Para cada thread encontrado:
   a. mcp__Gmail__get_thread con messageFormat: "FULL_CONTENT"
   b. Buscar mensajes con attachment_ids en la respuesta
   c. Extraer el base64 del attachment (campo data o similar)
   d. Determinar el tipo de banco por el remitente/asunto
   e. POST a /api/admin/import-from-base64
   f. Reportar resultado: cuántos movimientos nuevos insertados

3. Si hay meses faltantes, consultar /api/admin/coverage para ver qué falta
4. Buscar emails de esos meses específicamente con: newer_than:YYYY/MM/DD before:YYYY/MM/DD
```

### Detección automática de banco

Si el adjunto es XLS, el sistema detecta automáticamente si es BBVA o Itaú y devuelve error si no coincide con el tipo seleccionado.

Para PDFs, determinar el tipo por el remitente o nombre del archivo:
- Nombre contiene "15051382" o "BBVA" → `bbva-pdf`
- Nombre contiene "365921" o "365913" o "Itau" → `itau-xls` o `itau-card-pdf`
- Nombre contiene "43185955" o "Scotia" → `scotiabank-pdf`
- Remitente contiene "oca.com.uy" → `oca-pdf`

### Verificar cobertura de meses

```
GET /api/admin/coverage
→ Devuelve grilla de bancos × meses con qué está cargado y qué falta
```

## Estructura de la base de datos

Tabla principal: `bank_statements`
- `banco`: "BBVA" | "Itaú" | "OCA" | "Scotiabank" | "Itau-Card"
- `cuenta`: número de cuenta
- `fecha`: YYYY-MM-DD
- `descripcion`: texto del movimiento
- `numero`: número de cheque (solo BBVA)
- `debito`, `credito`: importes
- `saldo`: saldo después del movimiento
- `moneda`: "UYU" | "USD"
- `tc`: tipo de cambio aplicado
- `importe_uyu`: equivalente en pesos
- `clasificado`: "Si" | "No"
- `tipo`: "negocio" | "personal"
- `categoria_negocio`, `categoria_personal`: categorías

## Comandos útiles

```bash
# Verificar tipos antes de hacer push
npx tsc --noEmit

# Build local
npm run build

# Ver logs de Vercel
# Usar mcp__Vercel__get_runtime_logs
```
