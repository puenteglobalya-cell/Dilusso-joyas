// Canonical personal categories (numbered groups from the master dictionary)
export const CATEGORIAS_PERSONAL: string[] = [
  "1. HOGAR/VIVIENDA",
  "2. TRANSPORTE",
  "3. ALIMENTOS",
  "4. ROPA",
  "5. CUIDADO PERSONAL",
  "6. CUIDADO DE SALUD",
  "7. ENTRETENIMIENTO",
  "8. REGALOS",
  "9. EDUCACION",
  "10. VACACIONES",
  "11. GASTOS DE NEGOCIOS",
  "12. CUIDADO DEPENDIENTES",
  "13. INVERSION/AHORROS",
  "14. SEGUROS",
  "15. ESPIRITUAL",
  "16. DEUDAS REPAGADAS",
  "17. SERVICIOS",
  "18. IMPUESTOS",
  "19. LECCIONES APRENDIDAS",
  "20. HONORARIOS PAGADOS",
  "A. INGRESO GANADO",
  "B. INGRESO PASIVO",
  "C. INGRESO DE CARTERA",
  "10. TRASPASO",
  "NO IDENTIFICADO",
];

// Maps any old/inconsistent category name → canonical name
export const CATEGORIA_NORMALIZAR: Record<string, string> = {
  // Servicios hogar → HOGAR/VIVIENDA
  "4. SERVICIOS HOGAR": "1. HOGAR/VIVIENDA",
  "Servicios del hogar": "1. HOGAR/VIVIENDA",
  "Alquiler vivienda": "1. HOGAR/VIVIENDA",
  // Transporte
  "5. TRANSPORTE": "2. TRANSPORTE",
  "Transporte": "2. TRANSPORTE",
  // Alimentos
  "Supermercado / provisiones": "3. ALIMENTOS",
  "Restaurantes": "3. ALIMENTOS",
  // Ropa
  "Ropa / calzado": "4. ROPA",
  // Cuidado personal
  "Peluqueria": "5. CUIDADO PERSONAL",
  // Salud
  "6. SALUD": "6. CUIDADO DE SALUD",
  "Farmacia": "6. CUIDADO DE SALUD",
  "Médicos / salud": "6. CUIDADO DE SALUD",
  "Psicólogo / terapia": "6. CUIDADO DE SALUD",
  // Entretenimiento
  "Entretenimiento": "7. ENTRETENIMIENTO",
  // Educación
  "Educación / escuela": "9. EDUCACION",
  // Dependientes
  "Cuidado de niños": "12. CUIDADO DEPENDIENTES",
  // Seguros
  "12. SEGUROS": "14. SEGUROS",
  // Servicios / banco
  "11. BANCO/FINANCIERO": "17. SERVICIOS",
  "Gasto bancario": "17. SERVICIOS",
  // Impuestos
  "Impuestos": "18. IMPUESTOS",
  // Deudas
  "Tarjeta de crédito": "16. DEUDAS REPAGADAS",
  // Gastos varios → keep as-is or map to closest
  "Gastos varios personales": "NO IDENTIFICADO",
};

// For metrics: which canonical groups map to which analysis bucket
export const GRUPOS_METRICAS: Record<string, string[]> = {
  "HOGAR": ["1. HOGAR/VIVIENDA"],
  "TRANSPORTE": ["2. TRANSPORTE"],
  "ALIMENTOS": ["3. ALIMENTOS"],
  "ROPA": ["4. ROPA", "8. INDUMENTARIA"],
  "CUIDADO PERSONAL": ["5. CUIDADO PERSONAL"],
  "SALUD": ["6. CUIDADO DE SALUD"],
  "ENTRETENIMIENTO": ["7. ENTRETENIMIENTO"],
  "VACACIONES": ["10. VACACIONES"],
  "REGALOS": ["8. REGALOS"],
  "EDUCACION": ["9. EDUCACION", "12. CUIDADO DEPENDIENTES"],
  "INVERSIONES": ["13. INVERSION/AHORROS"],
  "SEGUROS": ["14. SEGUROS"],
  "SERVICIOS": ["17. SERVICIOS", "9. SERVICIOS DIGITALES"],
  "IMPUESTOS": ["18. IMPUESTOS"],
  "DEUDAS": ["16. DEUDAS REPAGADAS"],
};

// Categories to ignore in expense totals (transfers between own accounts)
export const CATEGORIAS_IGNORAR = new Set(["10. TRASPASO", "Transferencia entre cuenta"]);
