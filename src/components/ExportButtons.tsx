"use client";
import { FileSpreadsheet, Printer } from "lucide-react";

interface Props {
  params?: Record<string, string | number | undefined>;
  filename?: string;
  className?: string;
}

export function ExportButtons({ params = {}, className = "" }: Props) {
  function buildXlsxUrl() {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
    return `/api/export/xlsx?${sp.toString()}`;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className={`flex gap-2 ${className} print:hidden`}>
      <a
        href={buildXlsxUrl()}
        download
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg text-ink hover:bg-surface transition-colors"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-olive" />
        Excel
      </a>
      <button
        onClick={handlePrint}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg text-ink hover:bg-surface transition-colors"
      >
        <Printer className="w-3.5 h-3.5 text-muted" />
        PDF
      </button>
    </div>
  );
}
