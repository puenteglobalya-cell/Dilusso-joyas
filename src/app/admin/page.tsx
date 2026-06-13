"use client";
import { useState, type ReactNode } from "react";
import { FolderUp, Grid3x3, Copy, Wrench, FileCheck2 } from "lucide-react";

import { BulkUploadCard } from "@/components/admin/BulkUploadCard";
import { SingleUploadCard } from "@/components/admin/SingleUploadCard";
import { CoveragePanel } from "@/components/admin/CoveragePanel";
import { DuplicadosPanel } from "@/components/admin/DuplicadosPanel";
import { ChequesPanel } from "@/components/admin/ChequesPanel";
import { TcPanel, TransferPanel, AplicarReglasPanel, ExcelPanel } from "@/components/admin/HerramientasPanels";

type TabId = "importar" | "cobertura" | "duplicados" | "cheques" | "herramientas" | "reconciliar";

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "importar",     label: "Importar",     icon: <FolderUp className="w-4 h-4" /> },
  { id: "cobertura",    label: "Cobertura",    icon: <Grid3x3 className="w-4 h-4" /> },
  { id: "duplicados",   label: "Duplicados",   icon: <Copy className="w-4 h-4" /> },
  { id: "cheques",      label: "Cheques",      icon: <FileCheck2 className="w-4 h-4" /> },
  { id: "reconciliar",  label: "Reconciliar",  icon: <Wrench className="w-4 h-4" /> },
  { id: "herramientas", label: "Herramientas", icon: <Wrench className="w-4 h-4" /> },
];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("importar");
  const [coverageKey, setCoverageKey] = useState(1);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm text-gray-500 mt-1">Importaciones, validaciones y herramientas de mantenimiento.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.id
                ? "border-brand text-brand bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "importar" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <BulkUploadCard onImportDone={() => setCoverageKey(k => k + 1)} />
          <SingleUploadCard />
        </div>
      )}
      {tab === "cobertura" && <CoveragePanel key={coverageKey} />}
      {tab === "duplicados" && <DuplicadosPanel />}
      {tab === "cheques" && <ChequesPanel />}
      {tab === "reconciliar" && (
        <div className="text-center py-8">
          <p className="text-slate-600 mb-4">La herramienta de reconciliación está en su propia página.</p>
          <a href="/admin/reconciliar" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90">
            Ir a Reconciliar Excel →
          </a>
        </div>
      )}
      {tab === "herramientas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TcPanel />
          <TransferPanel />
          <AplicarReglasPanel />
          <ExcelPanel />
        </div>
      )}
    </div>
  );
}
