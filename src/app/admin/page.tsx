"use client";
import { Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderUp, Grid3x3, Copy, Wrench, FileCheck2, Tag, Gem, Gauge } from "lucide-react";

import { BulkUploadCard } from "@/components/admin/BulkUploadCard";
import { SingleUploadCard } from "@/components/admin/SingleUploadCard";
import { CoveragePanel } from "@/components/admin/CoveragePanel";
import { DuplicadosPanel } from "@/components/admin/DuplicadosPanel";
import { ChequesPanel } from "@/components/admin/ChequesPanel";
import { TcPanel, TransferPanel, AplicarReglasPanel, ExcelPanel } from "@/components/admin/HerramientasPanels";
import { CategoriasPanel } from "@/components/admin/CategoriasPanel";
import { ProductosPanel } from "@/components/admin/ProductosPanel";
import { IndicadoresPanel } from "@/components/admin/CockpitPanel";

type TabId = "importar" | "cobertura" | "duplicados" | "cheques" | "herramientas" | "categorias" | "productos" | "indicadores";

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "importar",     label: "Importar",     icon: <FolderUp className="w-4 h-4" /> },
  { id: "cobertura",    label: "Cobertura",    icon: <Grid3x3 className="w-4 h-4" /> },
  { id: "duplicados",   label: "Duplicados",   icon: <Copy className="w-4 h-4" /> },
  { id: "cheques",      label: "Cheques",      icon: <FileCheck2 className="w-4 h-4" /> },
  { id: "herramientas", label: "Herramientas", icon: <Wrench className="w-4 h-4" /> },
  { id: "categorias",   label: "Categorías",   icon: <Tag className="w-4 h-4" /> },
  { id: "productos",    label: "Productos",    icon: <Gem className="w-4 h-4" /> },
  { id: "indicadores",  label: "Indicadores",  icon: <Gauge className="w-4 h-4" /> },
];

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  );
}

function isTabId(v: string | null): v is TabId {
  return !!v && TABS.some(t => t.id === v);
}

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTabState] = useState<TabId>(isTabId(initialTab) ? initialTab : "importar");
  const [coverageKey, setCoverageKey] = useState(1);

  function setTab(id: TabId) {
    setTabState(id);
    router.replace(`/admin?tab=${id}`, { scroll: false });
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm text-muted mt-1">Importaciones, validaciones y herramientas de mantenimiento.</p>
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
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
        <a
          href="/admin/reconciliar"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 border-transparent text-muted hover:text-ink"
        >
          <Wrench className="w-4 h-4" />Reconciliar
        </a>
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
      {tab === "categorias" && <CategoriasPanel />}
      {tab === "productos" && <ProductosPanel />}
      {tab === "indicadores" && <IndicadoresPanel />}
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
