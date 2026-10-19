/**
 * Tipos gerados a partir do schema do Supabase.
 *
 * NÃO EDITE À MÃO. Ao alterar o banco, regere este arquivo.
 */
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          codigo_imovel: string | null
          created_at: string
          data_hora_fim: string
          data_hora_inicio: string
          id: string
          id_corretor: string
          id_imovel: string | null
          id_lead: string
          observacoes: string | null
          origem: string | null
          status: string
          updated_at: string
        }
        Insert: {
          codigo_imovel?: string | null
          created_at?: string
          data_hora_fim: string
          data_hora_inicio: string
          id?: string
          id_corretor: string
          id_imovel?: string | null
          id_lead: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          codigo_imovel?: string | null
          created_at?: string
          data_hora_fim?: string
          data_hora_inicio?: string
          id?: string
          id_corretor?: string
          id_imovel?: string | null
          id_lead?: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_id_corretor_fkey"
            columns: ["id_corretor"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_id_imovel_fkey"
            columns: ["id_imovel"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_id_lead_fkey"
            columns: ["id_lead"]
            isOneToOne: false
            referencedRelation: "crm_imobiliaria"
            referencedColumns: ["id"]
          },
        ]
      }
      agendas: {
        Row: {
          created_at: string
          duracao_slot: number
          id: string
          id_corretor: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duracao_slot?: number
          id?: string
          id_corretor: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duracao_slot?: number
          id?: string
          id_corretor?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendas_id_corretor_fkey"
            columns: ["id_corretor"]
            isOneToOne: true
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      agendas_horarios: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          id_agenda: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          id_agenda: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          id_agenda?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendas_horarios_id_agenda_fkey"
            columns: ["id_agenda"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          token: string
          ultimo_uso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          token: string
          ultimo_uso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          token?: string
          ultimo_uso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_uso: {
        Row: {
          id_token: string
          janela: string
          total: number
        }
        Insert: {
          id_token: string
          janela: string
          total?: number
        }
        Update: {
          id_token?: string
          janela?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_uso_id_token_fkey"
            columns: ["id_token"]
            isOneToOne: false
            referencedRelation: "api_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          cep: string | null
          cidade: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          foto_hero_url: string | null
          fuso_horario: string
          horario_funcionamento: Json | null
          id: string
          instagram: string | null
          link_google_maps: string | null
          logo_url: string | null
          nome_negocio: string
          site: string | null
          telefone: string | null
          updated_at: string
          url_site: string | null
          whatsapp: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          foto_hero_url?: string | null
          fuso_horario?: string
          horario_funcionamento?: Json | null
          id?: string
          instagram?: string | null
          link_google_maps?: string | null
          logo_url?: string | null
          nome_negocio: string
          site?: string | null
          telefone?: string | null
          updated_at?: string
          url_site?: string | null
          whatsapp?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          foto_hero_url?: string | null
          fuso_horario?: string
          horario_funcionamento?: Json | null
          id?: string
          instagram?: string | null
          link_google_maps?: string | null
          logo_url?: string | null
          nome_negocio?: string
          site?: string | null
          telefone?: string | null
          updated_at?: string
          url_site?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      corretores: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          creci: string | null
          email: string | null
          id: string
          nome: string
          sobrenome: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          cor: string
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          nome: string
          sobrenome: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          nome?: string
          sobrenome?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      crm_imobiliaria: {
        Row: {
          codigo_imovel_interesse: string | null
          created_at: string
          data_agendamento: string | null
          email: string | null
          faixa_valor_max: number | null
          faixa_valor_min: number | null
          finalidade_interesse: string | null
          follow_up_1: string | null
          follow_up_2: string | null
          id: string
          id_agendamento: string | null
          id_conta_chatwoot: string | null
          id_conversa_chatwoot: string | null
          id_lead_chatwoot: string | null
          inbox_id_chatwoot: string | null
          inicio_atendimento: string | null
          minutos_ultima_mensagem: number | null
          motivo_contato: string | null
          nome: string | null
          observacoes: string | null
          origem: string | null
          resumo_conversa: string | null
          status: string
          tipo: string
          tipo_imovel_interesse: string | null
          ultima_mensagem: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          codigo_imovel_interesse?: string | null
          created_at?: string
          data_agendamento?: string | null
          email?: string | null
          faixa_valor_max?: number | null
          faixa_valor_min?: number | null
          finalidade_interesse?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          id?: string
          id_agendamento?: string | null
          id_conta_chatwoot?: string | null
          id_conversa_chatwoot?: string | null
          id_lead_chatwoot?: string | null
          inbox_id_chatwoot?: string | null
          inicio_atendimento?: string | null
          minutos_ultima_mensagem?: number | null
          motivo_contato?: string | null
          nome?: string | null
          observacoes?: string | null
          origem?: string | null
          resumo_conversa?: string | null
          status?: string
          tipo?: string
          tipo_imovel_interesse?: string | null
          ultima_mensagem?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          codigo_imovel_interesse?: string | null
          created_at?: string
          data_agendamento?: string | null
          email?: string | null
          faixa_valor_max?: number | null
          faixa_valor_min?: number | null
          finalidade_interesse?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          id?: string
          id_agendamento?: string | null
          id_conta_chatwoot?: string | null
          id_conversa_chatwoot?: string | null
          id_lead_chatwoot?: string | null
          inbox_id_chatwoot?: string | null
          inicio_atendimento?: string | null
          minutos_ultima_mensagem?: number | null
          motivo_contato?: string | null
          nome?: string | null
          observacoes?: string | null
          origem?: string | null
          resumo_conversa?: string | null
          status?: string
          tipo?: string
          tipo_imovel_interesse?: string | null
          ultima_mensagem?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      imoveis: {
        Row: {
          aceita_pet: boolean
          area_total: number | null
          area_util: number | null
          bairro: string
          banheiros: number
          caracteristicas: Json | null
          cep: string | null
          cidade: string
          codigo: string
          complemento: string | null
          created_at: string
          descricao: string | null
          endereco: string | null
          estado: string
          finalidade: string
          id: string
          id_tipo_imovel: string
          mobiliado: boolean
          numero: string | null
          proprietario_contato: string | null
          proprietario_nome: string | null
          quartos: number
          status: string
          suites: number
          titulo: string
          total_cliques_whatsapp: number
          total_visualizacoes: number
          updated_at: string
          vagas: number
          valor_aluguel: number | null
          valor_condominio: number | null
          valor_iptu: number | null
          valor_venda: number | null
        }
        Insert: {
          aceita_pet?: boolean
          area_total?: number | null
          area_util?: number | null
          bairro: string
          banheiros?: number
          caracteristicas?: Json | null
          cep?: string | null
          cidade: string
          codigo: string
          complemento?: string | null
          created_at?: string
          descricao?: string | null
          endereco?: string | null
          estado: string
          finalidade: string
          id?: string
          id_tipo_imovel: string
          mobiliado?: boolean
          numero?: string | null
          proprietario_contato?: string | null
          proprietario_nome?: string | null
          quartos?: number
          status?: string
          suites?: number
          titulo: string
          total_cliques_whatsapp?: number
          total_visualizacoes?: number
          updated_at?: string
          vagas?: number
          valor_aluguel?: number | null
          valor_condominio?: number | null
          valor_iptu?: number | null
          valor_venda?: number | null
        }
        Update: {
          aceita_pet?: boolean
          area_total?: number | null
          area_util?: number | null
          bairro?: string
          banheiros?: number
          caracteristicas?: Json | null
          cep?: string | null
          cidade?: string
          codigo?: string
          complemento?: string | null
          created_at?: string
          descricao?: string | null
          endereco?: string | null
          estado?: string
          finalidade?: string
          id?: string
          id_tipo_imovel?: string
          mobiliado?: boolean
          numero?: string | null
          proprietario_contato?: string | null
          proprietario_nome?: string | null
          quartos?: number
          status?: string
          suites?: number
          titulo?: string
          total_cliques_whatsapp?: number
          total_visualizacoes?: number
          updated_at?: string
          vagas?: number
          valor_aluguel?: number | null
          valor_condominio?: number | null
          valor_iptu?: number | null
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_id_tipo_imovel_fkey"
            columns: ["id_tipo_imovel"]
            isOneToOne: false
            referencedRelation: "tipos_imovel"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis_fotos: {
        Row: {
          capa: boolean
          created_at: string
          id: string
          id_imovel: string
          ordem: number
          url: string
        }
        Insert: {
          capa?: boolean
          created_at?: string
          id?: string
          id_imovel: string
          ordem?: number
          url: string
        }
        Update: {
          capa?: boolean
          created_at?: string
          id?: string
          id_imovel?: string
          ordem?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_fotos_id_imovel_fkey"
            columns: ["id_imovel"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_sistema: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          id_registro: string | null
          id_usuario: string | null
          tabela: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          id_registro?: string | null
          id_usuario?: string | null
          tabela?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          id_registro?: string | null
          id_usuario?: string | null
          tabela?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_sistema_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      tipos_imovel: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          created_at: string
          email: string
          id: string
          liberado: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          liberado?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          liberado?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      visualizacoes_site: {
        Row: {
          codigo_imovel: string | null
          created_at: string
          id: string
          id_imovel: string | null
          pagina: string
          referrer: string | null
          session_id: string | null
          tipo_evento: string
          user_agent: string | null
        }
        Insert: {
          codigo_imovel?: string | null
          created_at?: string
          id?: string
          id_imovel?: string | null
          pagina: string
          referrer?: string | null
          session_id?: string | null
          tipo_evento: string
          user_agent?: string | null
        }
        Update: {
          codigo_imovel?: string | null
          created_at?: string
          id?: string
          id_imovel?: string | null
          pagina?: string
          referrer?: string | null
          session_id?: string | null
          tipo_evento?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visualizacoes_site_id_imovel_fkey"
            columns: ["id_imovel"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      info_imob_agente: {
        Row: {
          informacoes: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_api_autenticar: {
        Args: { p_janela_segundos?: number; p_limite?: number; p_token: string }
        Returns: {
          id_token: string
          nome: string
          permitido: boolean
          reinicia_em: string
          restante: number
        }[]
      }
      fn_atualizar_minutos_ultima_mensagem: { Args: never; Returns: number }
      fn_dashboard_dia_semana: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          atendimentos: number
          dia_semana: number
          visitas: number
        }[]
      }
      fn_dashboard_estoque: {
        Args: never
        Returns: {
          ambos: number
          ativos: number
          inativos: number
          locacao: number
          sem_foto: number
          venda: number
        }[]
      }
      fn_dashboard_estoque_por_tipo: {
        Args: never
        Returns: {
          tipo: string
          total: number
        }[]
      }
      fn_dashboard_indicadores: {
        Args: {
          p_fim: string
          p_fim_anterior: string
          p_inicio: string
          p_inicio_anterior: string
        }
        Returns: {
          imoveis_ativos: number
          imoveis_locacao: number
          imoveis_venda: number
          leads_novos: number
          leads_novos_anterior: number
          visitas: number
          visitas_anterior: number
          visitas_site: number
          visitas_site_anterior: number
        }[]
      }
      fn_dashboard_leads_por_status: {
        Args: never
        Returns: {
          status: string
          total: number
        }[]
      }
      fn_dashboard_paginas: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          acessos: number
          agregada: boolean
          pagina: string
        }[]
      }
      fn_dashboard_ranking_imoveis: {
        Args: {
          p_evento?: string
          p_fim: string
          p_inicio: string
          p_limite?: number
        }
        Returns: {
          bairro: string
          cidade: string
          cliques: number
          codigo: string
          conversao: number
          id_imovel: string
          titulo: string
          url_capa: string
          visualizacoes: number
        }[]
      }
      fn_dashboard_serie_diaria: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          atendimentos: number
          dia: string
          leads: number
          visitas: number
        }[]
      }
      fn_dashboard_tem_dados: {
        Args: never
        Returns: {
          tem_imoveis: boolean
          tem_leads: boolean
          tem_trafego: boolean
          tem_visitas: boolean
        }[]
      }
      fn_fuso_horario: { Args: never; Returns: string }
      fn_fuso_painel: { Args: never; Returns: string }
      fn_hora_legivel: { Args: { bruto: string }; Returns: string }
      fn_horario_funcionamento_legivel: {
        Args: { bruto: Json }
        Returns: string
      }
      fn_log_categoria: { Args: { p_acao: string }; Returns: string }
      fn_logs_filtros: {
        Args: never
        Returns: {
          categorias: string[]
          tabelas: string[]
          usuarios: Json
        }[]
      }
      fn_logs_listar: {
        Args: {
          p_busca?: string
          p_categoria?: string
          p_deslocamento?: number
          p_fim?: string
          p_inicio?: string
          p_limite?: number
          p_tabela?: string
          p_usuario?: string
        }
        Returns: {
          acao: string
          categoria: string
          created_at: string
          dados_anteriores: Json
          dados_novos: Json
          id: string
          id_registro: string
          id_usuario: string
          tabela: string
          total: number
          usuario_email: string
          usuario_nome: string
        }[]
      }
      fn_telefone_legivel: { Args: { bruto: string }; Returns: string }
      fn_url_absoluta: { Args: { bruto: string }; Returns: string }
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
