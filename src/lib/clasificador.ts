/** Auto-clasificador de transacciones por keywords. Portado de clasificador.py */

interface Regla {
  keywords: string[];
  tipo: "personal" | "negocio" | "";
  cat_negocio: string;
  cat_personal: string;
}

const REGLAS: Regla[] = [
  { keywords: ["TIENDA INGLE", "DISCO ", "DEVOTO", "SUPERMERCADO", "LA ASISTENCI", "SUPER WILDER", "URIOSTE", "PUESTO DE LA", "TATA", "HOLA CONGELA", "PANADERIA LA", "EL PUESTIN"],
    tipo: "personal", cat_negocio: "", cat_personal: "3. ALIMENTOS" },

  { keywords: ["UTE ", "ANTEL ", "OSE ", "ABITAB", "REDPAGOS", "SANEAMIENTO"],
    tipo: "personal", cat_negocio: "", cat_personal: "4. SERVICIOS HOGAR" },

  { keywords: ["ANCAP", "PETROBRAS", "SHELL", "UBE", "PEAJE", "TAXI", "ESTACION", "DISA", "AXION", "NEUMATICOS D"],
    tipo: "personal", cat_negocio: "", cat_personal: "5. TRANSPORTE" },

  { keywords: ["FARMACIA", "CLINICA", "HOSPITAL", "MEDICO", "MUTUALISTA", "DOCTOR", "LABORATORIO", "BANCO DE SEGUROS"],
    tipo: "personal", cat_negocio: "", cat_personal: "6. SALUD" },

  { keywords: ["MERPAGO", "MERCADOLIBR", "DLO*TEMU", "TEMU ", "STADIUM", "CINE", "NETFLIX", "SPOTIFY",
                "ONCE CALZADOS", "ZAPATERIA", "PAPELERIA", "EDICIONES SANTILLANA", "MC DONALD", "MCDONALD",
                "BAS BASIC", "BARRACA DON", "LOJAS RENNER", "MERPAGO*MERCADOLIBR", "PURARE",
                "PARRILLADA", "MINISO", "BURGER KING", "SBARRO", "ALQUIMIA PAS", "GELATO FACTO", "LA PASIVA", "PEKAS HELADE", "ZULE CAFE", "ARLECCHINO", "SUMO"],
    tipo: "personal", cat_negocio: "", cat_personal: "7. ENTRETENIMIENTO" },

  { keywords: ["ZARA", "H&M", "HANDY", "SUPERMERCADOS EL DOR", "MOSCA", "PAPRIKA", "ONLY BEST", "TIENDA DE DE", "ONCE CALZADO", "ULBRIKA", "EMRRE", "ZEPPELINES", "GRAFFITI", "CON HISTORIA"],
    tipo: "personal", cat_negocio: "", cat_personal: "8. INDUMENTARIA" },

  { keywords: ["OPENAI", "CHATGPT", "CANVA"],
    tipo: "personal", cat_negocio: "", cat_personal: "9. SERVICIOS DIGITALES" },

  { keywords: ["INTERESES FINANCIACION", "MULTA POR PAGO", "SEG.VIDA", "SEGURO DE VIDA",
                "DB - IMPUESTO", "COMISION PAGO RED", "CARGO ACUM. COMPRA",
                "DEV.DEBITO AUTOMATICO", "REVERSAL CGO BANCO", "INTERESES COMPENSATORIO",
                "FINANCIACION", "IVA INC", "IMPUESTO", "REDIVA", "DEB. VARIOS", "PAGOS EN REDPAGOS", "COMPRA REDPAG", "DEBITO REDPAG"],
    tipo: "personal", cat_negocio: "", cat_personal: "11. BANCO/FINANCIERO" },

  { keywords: ["GOOGLE*WORKSPACE", "GOOGLE *WORKSPACE", "SITEGROUND", "SHOPIFY", "ZUREO"],
    tipo: "negocio", cat_negocio: "Servicios contratados", cat_personal: "" },

  { keywords: ["GOOGLE*ADS", "GOOGLE ADS", "GOOGLE *ADS", "FACEBOOK*", "FACEB*", "INSTAGRAM", "FACEBK *", "GOOGLE *GOOGLE ONE"],
    tipo: "negocio", cat_negocio: "Publicidad", cat_personal: "" },

  { keywords: ["SOFLYPART", "WWW.SOFLYPART"],
    tipo: "negocio", cat_negocio: "Mercadería de reventa", cat_personal: "" },

  { keywords: ["TRANSF.ENT.OP"],
    tipo: "negocio", cat_negocio: "Venta tarjeta", cat_personal: "" },

  { keywords: ["TRASPASO", "PAGO DE TARJETA", "PAGOS", "CRE. CAMBIOS", "DEB. CAMBIOS", "DEB. CAMBIO", "DEPOSITO RPAGOS"],
    tipo: "personal", cat_negocio: "", cat_personal: "10. TRASPASO" },

  { keywords: ["SEGURO", "SEGUROS", "SURA SE"],
    tipo: "personal", cat_negocio: "", cat_personal: "12. SEGUROS" },
];

export interface Clasificacion {
  clasificado: "Si" | "No";
  tipo: string;
  categoria_negocio: string;
  categoria_personal: string;
}

export interface ReglaCustom {
  keyword: string;
  tipo: string;
  cat_negocio: string;
  cat_personal: string;
}

export function clasificar(detalle: string, customRules: ReglaCustom[] = []): Clasificacion {
  const upper = detalle.toUpperCase();

  // Custom rules (DB) take priority
  for (const r of customRules) {
    if (upper.includes(r.keyword.toUpperCase())) {
      return {
        clasificado: "Si",
        tipo: r.tipo,
        categoria_negocio: r.cat_negocio,
        categoria_personal: r.cat_personal,
      };
    }
  }

  // Static rules
  for (const regla of REGLAS) {
    for (const kw of regla.keywords) {
      if (upper.includes(kw.toUpperCase())) {
        return {
          clasificado: "Si",
          tipo: regla.tipo,
          categoria_negocio: regla.cat_negocio,
          categoria_personal: regla.cat_personal,
        };
      }
    }
  }
  return { clasificado: "No", tipo: "", categoria_negocio: "", categoria_personal: "" };
}
