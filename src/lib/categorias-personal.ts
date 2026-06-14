// Canonical personal categories — "cuentas madre" del diccionario
export const CATEGORIAS_PERSONAL: string[] = [
  // Gastos
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
  "G. CAPRICHOS",         // vivienda propia, auto, lujos
  // Ingresos
  "A. INGRESO GANADO",
  "B. INGRESO PASIVO",
  "C. INGRESO DE CARTERA",
  // Otros
  "F. ACTIVOS",
  "J. PASIVOS",
  "10. TRASPASO",
  "NO IDENTIFICADO",
];

// Maps any old/legacy category name → canonical "cuenta madre"
export const CATEGORIA_NORMALIZAR: Record<string, string> = {
  // Hogar
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
  // Inversiones
  "INVERSIÓN": "13. INVERSION/AHORROS",
  "Compra USDT": "13. INVERSION/AHORROS",
  // Traspasos (ignorar)
  "Transferencia entre cuenta": "10. TRASPASO",
  // Varios
  "Gastos varios personales": "NO IDENTIFICADO",
};

// Agrupación para métricas y análisis
export const GRUPOS_METRICAS: Record<string, string[]> = {
  "HOGAR": ["1. HOGAR/VIVIENDA"],
  "TRANSPORTE": ["2. TRANSPORTE"],
  "ALIMENTOS": ["3. ALIMENTOS"],
  "ROPA": ["4. ROPA"],
  "CUIDADO PERSONAL": ["5. CUIDADO PERSONAL"],
  "SALUD": ["6. CUIDADO DE SALUD"],
  "ENTRETENIMIENTO": ["7. ENTRETENIMIENTO"],
  "REGALOS": ["8. REGALOS"],
  "EDUCACION": ["9. EDUCACION", "12. CUIDADO DEPENDIENTES"],
  "VACACIONES": ["10. VACACIONES"],
  "INVERSIONES": ["13. INVERSION/AHORROS"],
  "SEGUROS": ["14. SEGUROS"],
  "SERVICIOS": ["17. SERVICIOS"],
  "IMPUESTOS": ["18. IMPUESTOS"],
  "DEUDAS": ["16. DEUDAS REPAGADAS"],
  "CAPRICHOS": ["G. CAPRICHOS"],
};

// Categories to ignore in expense totals (transfers between own accounts)
export const CATEGORIAS_IGNORAR = new Set(["10. TRASPASO", "Transferencia entre cuenta"]);
