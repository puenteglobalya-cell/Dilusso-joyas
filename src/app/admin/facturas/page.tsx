"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { formatUYU } from "@/lib/utils";

type Tipo = "negocio" | "personal";

interface BankStatement {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  moneda: string;
  tipo: string | null;
}

interface Factura {
  id: string;
  created_at: string;
  filename: string;
  storage_path: string;
  tipo: Tipo;
  año: number;
  mes: number;
  proveedor: string | null;
  fecha_factura: string | null;
  importe: number | null;
  moneda: string;
  notas: string | null;
  bank_statement_id: string | null;
  bank_statements: BankStatement | null;
}

interface UploadResult {
  ok: boolean;
  filename: string;
  error?: string;
  duplicado?: boolean;
  motivo?: string;
  autoMatched?: boolean;
  matches?: BankStatement[];
  row?: Factura;
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatImporte(importe: number | null, moneda: string) {
  if (!importe) return "—";
  if (moneda === "USD") return `USD ${importe.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`;
  return formatUYU(importe);
}

export default function FacturasPage() {
  const [tipo, setTipo] = useState<Tipo>("negocio");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [linkModal, setLinkModal] = useState<{ factura: Factura; matches: BankStatement[] } | null>(null);
  const [searchMatches, setSearchMatches] = useState<BankStatement[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [reglaModal, setReglaModal] = useState<{ factura: Factura; statement: BankStatement } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (t: Tipo) => {
    setLoading(true);
    const res = await fetch(`/api/admin/facturas?tipo=${t}`);
    const data = await res.json();
    setFacturas(data.facturas ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(tipo); }, [tipo, load]);

  async function uploadFiles(files: File[]) {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setUploading(true);
    setUploadResults([]);
    const fd = new FormData();
    pdfs.forEach(f => fd.append("files", f));
    fd.append("tipo", tipo);
    const res = await fetch("/api/admin/facturas/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploadResults(data.results ?? []);
    setUploading(false);
    load(tipo);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }

  async function openPdf(id: string) {
    const res = await fetch(`/api/admin/facturas/${id}/signed-url`);
    const { url } = await res.json();
    if (url) window.open(url, "_blank");
  }

  async function unlink(factura: Factura) {
    await fetch(`/api/admin/facturas/${factura.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_statement_id: null }),
    });
    load(tipo);
  }

  async function linkTo(factura: Factura, statement: BankStatement) {
    await fetch(`/api/admin/facturas/${factura.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_statement_id: statement.id }),
    });
    setLinkModal(null);
    // Proponer crear regla
    setReglaModal({ factura, statement });
    load(tipo);
  }

  async function crearRegla(factura: Factura, statement: BankStatement) {
    const desc = statement.descripcion ?? "";
    const esGenerico = desc.length < 6 || /^\d+$/.test(desc) || /debito auto|cargo auto|db\s/i.test(desc);
    const importe = statement.debito ?? factura.importe ?? 0;
    const dia = statement.fecha ? parseInt(statement.fecha.split("-")[2]) : null;

    const regla: Record<string, unknown> = {
      descripcion_regla: factura.proveedor ?? factura.filename,
      tipo: factura.tipo,
      moneda: statement.moneda,
      banco: statement.banco,
      factura_id: factura.id,
      categoria_negocio: statement.tipo === "negocio" ? (statement as BankStatement & { categoria_negocio?: string }).categoria_negocio ?? null : null,
      categoria_personal: statement.tipo === "personal" ? (statement as BankStatement & { categoria_personal?: string }).categoria_personal ?? null : null,
    };

    if (esGenerico && importe > 0) {
      // Descripción genérica: usar importe ±5% + día ±3
      regla.importe_min = Math.floor(importe * 0.95);
      regla.importe_max = Math.ceil(importe * 1.05);
      if (dia) { regla.dia_mes_min = Math.max(1, dia - 3); regla.dia_mes_max = Math.min(31, dia + 3); }
    } else {
      // Descripción útil: usar keyword
      const words = desc.split(/\s+/).filter(w => w.length > 3 && !/^\d+$/.test(w));
      regla.keyword = words[0]?.toLowerCase() ?? desc.toLowerCase().slice(0, 20);
    }

    await fetch("/api/admin/reglas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regla),
    });
    setReglaModal(null);
  }

  async function deleteFactura(id: string) {
    if (!confirm("¿Eliminar esta factura?")) return;
    await fetch(`/api/admin/facturas/${id}`, { method: "DELETE" });
    load(tipo);
  }

  async function openLinkModal(factura: Factura) {
    setSearchLoading(true);
    setLinkModal({ factura, matches: [] });
    // Search by importe if available
    if (factura.importe) {
      const params = new URLSearchParams({
        importe: String(factura.importe),
        moneda: factura.moneda,
        ...(factura.fecha_factura ? { fecha: factura.fecha_factura } : {}),
      });
      const res = await fetch(`/api/admin/match-factura-search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSearchMatches(data.matches ?? []);
      }
    }
    setSearchLoading(false);
  }

  // Group by año/mes
  const grouped: Record<string, Factura[]> = {};
  for (const f of facturas) {
    const key = `${f.año}-${String(f.mes).padStart(2,"0")}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  }
  const groupKeys = Object.keys(grouped).sort().reverse();

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2E2B2A" }}>Facturas</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8C857B" }}>Comprobantes vinculados a movimientos bancarios</p>
        </div>
        {/* Tipo toggle */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #E6E1DA" }}>
          {(["negocio","personal"] as Tipo[]).map(t => (
            <button
              key={t}
              onClick={() => { setTipo(t); setUploadResults([]); }}
              className="px-4 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                background: tipo === t ? (t === "negocio" ? "#586E50" : "#946E61") : "#FCFBFA",
                color: tipo === t ? "#fff" : "#8C857B",
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className="rounded-2xl border-2 border-dashed cursor-pointer flex items-center justify-center gap-3 py-8 mb-6 transition-colors"
        style={{ borderColor: dragOver ? "#C5A059" : "#E6E1DA", background: dragOver ? "#F5F0E8" : "#FCFBFA" }}
      >
        {uploading ? (
          <div className="flex items-center gap-2" style={{ color: "#8C857B" }}>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Subiendo PDFs...</span>
          </div>
        ) : (
          <>
            <svg width="20" height="20" fill="none" stroke="#C4B5A0" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm" style={{ color: "#8C857B" }}>
              Arrastrá uno o varios PDFs · o <span style={{ color: "#C5A059" }}>elegí archivos</span>
            </span>
          </>
        )}
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={e => uploadFiles(Array.from(e.target.files ?? []))} />
      </div>

      {/* Upload results */}
      {uploadResults.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8C857B" }}>Resultado de subida</p>
          {uploadResults.map((r, i) => (
            <div key={i} className="rounded-xl px-4 py-2.5 flex items-center justify-between text-sm" style={{
              background: r.ok ? "#F0F5EE" : "#FAF0EE",
              border: `1px solid ${r.ok ? "#586E5030" : "#946E6130"}`,
            }}>
              <span className="font-medium truncate" style={{ color: "#2E2B2A" }}>{r.filename}</span>
              <span style={{ color: r.ok ? "#586E50" : r.duplicado ? "#C5A059" : "#946E61" }}>
                {r.ok
                  ? r.autoMatched ? "✓ vinculado automáticamente" : `✓ guardado${(r.matches?.length ?? 0) > 0 ? ` · ${r.matches!.length} candidato${r.matches!.length !== 1 ? "s" : ""}` : ""}`
                  : r.duplicado ? `⚠ duplicado — ${r.motivo}`
                  : `Error: ${r.error}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16" style={{ color: "#C4B5A0" }}>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      ) : facturas.length === 0 ? (
        <div className="rounded-2xl py-16 text-center" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
          <p className="text-sm" style={{ color: "#8C857B" }}>Sin facturas cargadas para {tipo}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupKeys.map(key => {
            const [y, m] = key.split("-");
            return (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8C857B" }}>
                  {MESES[parseInt(m)-1]} {y} · {grouped[key].length} factura{grouped[key].length !== 1 ? "s" : ""}
                </p>
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E6E1DA" }}>
                  {grouped[key].map((f, i) => (
                    <div
                      key={f.id}
                      className="px-4 py-3 flex items-center gap-3"
                      style={{ borderTop: i > 0 ? "1px solid #E6E1DA" : undefined, background: "#FCFBFA" }}
                    >
                      {/* PDF icon */}
                      <button onClick={() => openPdf(f.id)} title="Ver PDF" className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white">
                        <svg width="18" height="18" fill="none" stroke="#946E61" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate" style={{ color: "#2E2B2A" }}>
                            {f.proveedor ?? f.filename}
                          </p>
                          {f.fecha_factura && (
                            <span className="text-xs shrink-0" style={{ color: "#C4B5A0" }}>{f.fecha_factura}</span>
                          )}
                        </div>
                        {/* Linked movement */}
                        {f.bank_statements ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs" style={{ color: "#586E50" }}>
                              ✓ {f.bank_statements.banco} · {f.bank_statements.fecha} · {f.bank_statements.descripcion ?? ""}
                            </span>
                            <button
                              onClick={() => unlink(f)}
                              className="text-xs underline"
                              style={{ color: "#C4B5A0" }}
                            >desvincular</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openLinkModal(f)}
                            className="text-xs underline mt-0.5"
                            style={{ color: "#C5A059" }}
                          >vincular movimiento</button>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums" style={{ color: "#2E2B2A" }}>
                          {formatImporte(f.importe, f.moneda)}
                        </p>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => deleteFactura(f.id)}
                        className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white"
                        title="Eliminar"
                      >
                        <svg width="14" height="14" fill="none" stroke="#C4B5A0" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#E6E1DA" }}>
              <p className="font-semibold text-sm" style={{ color: "#2E2B2A" }}>Vincular movimiento bancario</p>
              <button onClick={() => setLinkModal(null)} style={{ color: "#C4B5A0" }}>✕</button>
            </div>
            <div className="p-5">
              <p className="text-xs mb-3" style={{ color: "#8C857B" }}>
                Factura: <strong style={{ color: "#2E2B2A" }}>{linkModal.factura.proveedor ?? linkModal.factura.filename}</strong>
                {linkModal.factura.importe && ` · ${formatImporte(linkModal.factura.importe, linkModal.factura.moneda)}`}
              </p>

              {searchLoading ? (
                <div className="flex justify-center py-8" style={{ color: "#C4B5A0" }}>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchMatches.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "#8C857B" }}>
                  Sin coincidencias automáticas. Buscá el movimiento en sin-conciliar y linkea manualmente.
                </p>
              ) : (
                <div className="space-y-2">
                  {searchMatches.map(m => (
                    <button
                      key={m.id}
                      onClick={() => linkTo(linkModal.factura, m)}
                      className="w-full rounded-xl px-4 py-3 text-left transition-colors hover:bg-white"
                      style={{ border: "1px solid #E6E1DA" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: "#2E2B2A" }}>{m.descripcion ?? "—"}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#8C857B" }}>{m.banco} · {m.fecha}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: "#946E61" }}>
                          {formatImporte(m.debito, m.moneda)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Propuesta de regla al vincular */}
      {reglaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="rounded-2xl w-full max-w-md" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "#E6E1DA" }}>
              <p className="font-semibold text-sm" style={{ color: "#2E2B2A" }}>¿Crear regla automática?</p>
            </div>
            <div className="p-5">
              <p className="text-sm mb-3" style={{ color: "#8C857B" }}>
                La próxima vez que entre un movimiento similar de <strong style={{ color: "#2E2B2A" }}>{reglaModal.statement.banco}</strong> se clasificará automáticamente como <strong style={{ color: "#2E2B2A" }}>{reglaModal.factura.proveedor ?? reglaModal.factura.filename}</strong>.
              </p>
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#F5F0E8", color: "#2E2B2A" }}>
                <p><span style={{ color: "#8C857B" }}>Descripción:</span> {reglaModal.statement.descripcion ?? "—"}</p>
                <p><span style={{ color: "#8C857B" }}>Banco:</span> {reglaModal.statement.banco}</p>
                <p><span style={{ color: "#8C857B" }}>Importe:</span> {formatImporte(reglaModal.statement.debito, reglaModal.statement.moneda)}</p>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: "#E6E1DA" }}>
              <button onClick={() => setReglaModal(null)} className="px-4 py-2 rounded-xl text-sm" style={{ color: "#8C857B" }}>
                No, gracias
              </button>
              <button
                onClick={() => crearRegla(reglaModal.factura, reglaModal.statement)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#C5A059", color: "#fff" }}
              >
                Crear regla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
