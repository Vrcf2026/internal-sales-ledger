export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caixa_diario: {
        Row: {
          aberto_em: string | null
          data: string
          estado: string | null
          fechado_em: string | null
          id: string
          saldo_final: number | null
          saldo_inicial: number
          utilizador_abertura_id: string
          utilizador_fecho_id: string | null
        }
        Insert: {
          aberto_em?: string | null
          data?: string
          estado?: string | null
          fechado_em?: string | null
          id?: string
          saldo_final?: number | null
          saldo_inicial?: number
          utilizador_abertura_id: string
          utilizador_fecho_id?: string | null
        }
        Update: {
          aberto_em?: string | null
          data?: string
          estado?: string | null
          fechado_em?: string | null
          id?: string
          saldo_final?: number | null
          saldo_inicial?: number
          utilizador_abertura_id?: string
          utilizador_fecho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_diario_utilizador_abertura_id_fkey"
            columns: ["utilizador_abertura_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_diario_utilizador_fecho_id_fkey"
            columns: ["utilizador_fecho_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          preco: number
          tipo: string
          unidade: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          preco?: number
          tipo: string
          unidade?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          preco?: number
          tipo?: string
          unidade?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          nif: string | null
          nome: string | null
          telefone: string | null
        }
        Insert: {
          id?: string
          nif?: string | null
          nome?: string | null
          telefone?: string | null
        }
        Update: {
          id?: string
          nif?: string | null
          nome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      registo_itens: {
        Row: {
          catalogo_id: string | null
          descricao: string
          id: string
          preco_unitario: number
          quantidade: number
          registo_id: string | null
          subtotal: number | null
        }
        Insert: {
          catalogo_id?: string | null
          descricao: string
          id?: string
          preco_unitario?: number
          quantidade?: number
          registo_id?: string | null
          subtotal?: number | null
        }
        Update: {
          catalogo_id?: string | null
          descricao?: string
          id?: string
          preco_unitario?: number
          quantidade?: number
          registo_id?: string | null
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registo_itens_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registo_itens_registo_id_fkey"
            columns: ["registo_id"]
            isOneToOne: false
            referencedRelation: "registos"
            referencedColumns: ["id"]
          },
        ]
      }
      registos: {
        Row: {
          caixa_diario_id: string
          cliente_id: string | null
          created_at: string | null
          data: string
          descricao: string | null
          id: string
          metodo_pagamento: string
          numero: number
          total: number
          utilizador_id: string
        }
        Insert: {
          caixa_diario_id: string
          cliente_id?: string | null
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          metodo_pagamento: string
          numero?: number
          total?: number
          utilizador_id: string
        }
        Update: {
          caixa_diario_id?: string
          cliente_id?: string | null
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          metodo_pagamento?: string
          numero?: number
          total?: number
          utilizador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registos_caixa_diario_id_fkey"
            columns: ["caixa_diario_id"]
            isOneToOne: false
            referencedRelation: "caixa_diario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_utilizador_id_fkey"
            columns: ["utilizador_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
        ]
      }
      saidas_caixa: {
        Row: {
          caixa_diario_id: string
          criado_em: string | null
          descricao: string
          id: string
          tipo: string
          utilizador_id: string
          valor: number
        }
        Insert: {
          caixa_diario_id: string
          criado_em?: string | null
          descricao: string
          id?: string
          tipo: string
          utilizador_id: string
          valor: number
        }
        Update: {
          caixa_diario_id?: string
          criado_em?: string | null
          descricao?: string
          id?: string
          tipo?: string
          utilizador_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saidas_caixa_caixa_diario_id_fkey"
            columns: ["caixa_diario_id"]
            isOneToOne: false
            referencedRelation: "caixa_diario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saidas_caixa_utilizador_id_fkey"
            columns: ["utilizador_id"]
            isOneToOne: false
            referencedRelation: "utilizadores"
            referencedColumns: ["id"]
          },
        ]
      }
      utilizadores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          papel: string
          password_hash: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          papel?: string
          password_hash: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          papel?: string
          password_hash?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_password: {
        Args: { p_id: string; p_password: string }
        Returns: undefined
      }
      verify_password: {
        Args: { p_nome: string; p_password: string }
        Returns: {
          ativo: boolean
          id: string
          nome: string
          papel: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
