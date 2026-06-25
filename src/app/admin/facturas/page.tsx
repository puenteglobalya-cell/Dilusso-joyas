"use client";

import { useState, useRef } from "react";
import { formatUYU } from "@/lib/utils";

interface ExtractedInvoice {
  proveedor: string | null;
  fecha: string | null;
  importe: number | null;
  moneda: "UYU" | "USD";
  rawText: string;
}

interface BankRow {
  id: string;
  banco: string;
  fecha: string;
  descripcion: string | null;
  debito: number | null;
  moneda: string;
  tipo: string | null;
  categoria_negocio: string | null;
  categoria_personal: string | null;
  clasificado: string | null;
}

interface Result {
  extracted: ExtractedInvoice;
  matches: BankRow[];
  error?: string;
}

export default function FacturasPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Solo se aceptan archivos PDF");
      return;
    }
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/match-factura", { method: "POST", body: fd });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#2E2B2A" }}>Matcheo de facturas</h1>
      <p className="text-sm mb-8" style={{ color: "#8C857B" }}>Subí un PDF de factura y buscamos el movimiento bancario correspondiente</p>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className="rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-16 mb-8 transition-colors"
        style={{
          borderColor: dragOver ? "#C5A059" : "#E6E1DA",
          background: dragOver ? "#F5F0E8" : "#FCFBFA",
        }}
      >
        <svg width="40" height="40" fill="none" stroke="#C4B5A0" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="text-sm font-medium" style={{ color: "#2E2B2A" }}>Arrastrá el PDF acá o hacé click</p>
        <p className="text-xs mt-1" style={{ color: "#8C857B" }}>Solo archivos PDF</p>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={onFileChange} />
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center" style={{ color: "#8C857B" }}>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Procesando PDF...</span>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Datos extraídos */}
          <div className="rounded-2xl p-5" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#8C857B" }}>Datos extraídos del PDF</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "#8C857B" }}>Proveedor</p>
                <p className="text-sm font-medium" style={{ color: "#2E2B2A" }}>{result.extracted.proveedor ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#8C857B" }}>Fecha</p>
                <p className="text-sm font-medium" style={{ color: "#2E2B2A" }}>{result.extracted.fecha ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#8C857B" }}>Importe</p>
                <p className="text-sm font-semibold" style={{ color: result.extracted.importe ? "#586E50" : "#946E61" }}>
                  {result.extracted.importe
                    ? `${result.extracted.moneda} ${result.extracted.importe.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`
                    : "No encontrado"}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#8C857B" }}>Moneda</p>
                <p className="text-sm font-medium" style={{ color: "#2E2B2A" }}>{result.extracted.moneda}</p>
              </div>
            </div>
            {result.error && (
              <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ background: "#FAF0EE", color: "#946E61" }}>
                {result.error}
              </p>
            )}
          </div>

          {/* Movimientos encontrados */}
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: "#2E2B2A" }}>
              {result.matches.length > 0
                ? `${result.matches.length} movimiento${result.matches.length !== 1 ? "s" : ""} posible${result.matches.length !== 1 ? "s" : ""}`
                : "Sin coincidencias en el banco"}
            </p>

            {result.matches.length === 0 && (
              <div className="rounded-xl py-10 text-center" style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}>
                <p className="text-sm" style={{ color: "#8C857B" }}>
                  No se encontraron movimientos con importe similar en ±10 días.
                </p>
                <p className="text-xs mt-1" style={{ color: "#C4B5A0" }}>
                  Verificá que el extracto esté cargado o ajustá la fecha.
                </p>
              </div>
            )}

            {result.matches.map(m => (
              <div
                key={m.id}
                className="rounded-xl px-4 py-3 mb-2 flex items-center justify-between gap-4"
                style={{ background: "#FCFBFA", border: "1px solid #E6E1DA" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium" style={{ color: "#8C857B" }}>{m.banco}</span>
                    <span className="text-xs" style={{ color: "#C4B5A0" }}>{m.fecha}</span>
                    {m.clasificado === "Si" && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#586E5020", color: "#586E50" }}>clasificado</span>
                    )}
                  </div>
                  <p className="text-sm truncate font-medium" style={{ color: "#2E2B2A" }}>{m.descripcion ?? "—"}</p>
                  {(m.categoria_negocio || m.categoria_personal) && (
                    <p className="text-xs mt-0.5" style={{ color: "#C4B5A0" }}>
                      {m.categoria_negocio ?? m.categoria_personal}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums" style={{ color: "#946E61" }}>
                    {m.moneda === "USD"
                      ? `USD ${(m.debito ?? 0).toLocaleString("es-UY", { minimumFractionDigits: 2 })}`
                      : formatUYU(m.debito ?? 0)}
                  </p>
                  <p className="text-xs" style={{ color: "#C4B5A0" }}>{m.tipo ?? ""}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Raw text toggle */}
          <details className="text-xs" style={{ color: "#8C857B" }}>
            <summary className="cursor-pointer hover:underline">Ver texto extraído del PDF</summary>
            <pre className="mt-2 p-3 rounded-xl overflow-auto max-h-48 whitespace-pre-wrap text-xs" style={{ background: "#F5F0E8", color: "#2E2B2A" }}>
              {result.extracted.rawText}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
