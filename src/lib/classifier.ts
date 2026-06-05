import type { ParsedTransaction } from "./parsers";
import type { VendorDictionary } from "./database.types";

export interface ClassifiedTransaction extends ParsedTransaction {
  tipo: "negocio" | "personal" | null;
  categoria: string | null;
  clasificado: boolean;
  tc: number | null;
  importe_uyu: number | null;
  mes: number;
  año: number;
}

export function classifyTransactions(
  transactions: ParsedTransaction[],
  dictionary: VendorDictionary[],
  currentTC: number
): { classified: ClassifiedTransaction[]; unclassified: ClassifiedTransaction[] } {
  const classified: ClassifiedTransaction[] = [];
  const unclassified: ClassifiedTransaction[] = [];

  for (const tx of transactions) {
    const fechaDate = new Date(tx.fecha);
    const mes = fechaDate.getMonth() + 1;
    const año = fechaDate.getFullYear();
    const tc = tx.moneda === "USD" ? currentTC : null;
    const importe_uyu = tx.moneda === "USD" ? tx.importe_origen * currentTC : tx.importe_origen;

    const match = findDictionaryMatch(tx.detalle, tx.banco, dictionary);

    const result: ClassifiedTransaction = {
      ...tx,
      mes,
      año,
      tc,
      importe_uyu,
      tipo: match?.tipo ?? null,
      categoria: match?.categoria ?? null,
      clasificado: !!match,
    };

    if (match) {
      classified.push(result);
    } else {
      unclassified.push(result);
    }
  }

  return { classified, unclassified };
}

function findDictionaryMatch(
  detalle: string,
  banco: string,
  dictionary: VendorDictionary[]
): VendorDictionary | null {
  const detalleNorm = detalle.toLowerCase();
  // Score-based match: prefer exact bank + keyword match
  let best: { entry: VendorDictionary; score: number } | null = null;

  for (const entry of dictionary) {
    const keyword = entry.keyword.toLowerCase();
    if (!detalleNorm.includes(keyword)) continue;
    const bancosMatch = !entry.banco || entry.banco.toLowerCase() === banco.toLowerCase();
    const score = (bancosMatch ? 10 : 0) + keyword.length;
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  return best?.entry ?? null;
}
