"use client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function ExportButton() {
  const sp = useSearchParams();

  function handleExport() {
    const params = new URLSearchParams(sp.toString());
    params.set("format", "csv");
    window.open(`/api/transactions/export?${params.toString()}`);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="w-4 h-4 mr-2" />
      Exportar CSV
    </Button>
  );
}
