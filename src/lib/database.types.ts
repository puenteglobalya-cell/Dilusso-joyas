export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          upload_id: string | null;
          banco: string;
          fecha: string;
          mes: number | null;
          año: number | null;
          detalle: string | null;
          movimiento: "salida" | "ingreso" | null;
          clasificado: boolean;
          tipo: "negocio" | "personal" | null;
          categoria: string | null;
          moneda: string;
          tc: number | null;
          importe_origen: number | null;
          importe_uyu: number | null;
          comentario: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["transactions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
      settlements: {
        Row: {
          id: string;
          desde: string;
          hasta: string;
          año: number | null;
          mes: number | null;
          fecha_control: string | null;
          facturado: number | null;
          retiro_reserva: number | null;
          efectivo: number | null;
          tarjeta: number | null;
          fadaval: number | null;
          gastos: number | null;
          adelanto_sueldos: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["settlements"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["settlements"]["Insert"]>;
      };
      exchange_rates: {
        Row: {
          id: string;
          date: string;
          rate: number;
          source: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["exchange_rates"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["exchange_rates"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          type: "negocio" | "personal";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      vendor_dictionary: {
        Row: {
          id: string;
          keyword: string;
          categoria: string | null;
          tipo: "negocio" | "personal" | null;
          banco: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["vendor_dictionary"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["vendor_dictionary"]["Insert"]>;
      };
      uploads_log: {
        Row: {
          id: string;
          banco: string;
          filename: string;
          period_start: string | null;
          period_end: string | null;
          rows_total: number | null;
          rows_classified: number | null;
          rows_unclassified: number | null;
          uploaded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["uploads_log"]["Row"], "id" | "uploaded_at">;
        Update: Partial<Database["public"]["Tables"]["uploads_log"]["Insert"]>;
      };
      transaction_comments: {
        Row: {
          id: string;
          transaction_id: string;
          author: "contador" | "cliente";
          body: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["transaction_comments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["transaction_comments"]["Insert"]>;
      };
    };
  };
}

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Settlement = Database["public"]["Tables"]["settlements"]["Row"];
export type ExchangeRate = Database["public"]["Tables"]["exchange_rates"]["Row"];
export type VendorDictionary = Database["public"]["Tables"]["vendor_dictionary"]["Row"];
export type UploadsLog = Database["public"]["Tables"]["uploads_log"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type TransactionComment = Database["public"]["Tables"]["transaction_comments"]["Row"];
