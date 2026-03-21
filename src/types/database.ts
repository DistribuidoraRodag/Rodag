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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_name: string
          cost_usd: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          input_payload: Json | null
          model_used: string | null
          output_payload: Json | null
          request_id: string
          run_status: string
          started_at: string
          tokens_used: number | null
        }
        Insert: {
          agent_name: string
          cost_usd?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          model_used?: string | null
          output_payload?: Json | null
          request_id: string
          run_status?: string
          started_at?: string
          tokens_used?: number | null
        }
        Update: {
          agent_name?: string
          cost_usd?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          model_used?: string | null
          output_payload?: Json | null
          request_id?: string
          run_status?: string
          started_at?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string
          metadata: Json | null
          request_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          request_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          request_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          approved: boolean
          content_json: Json | null
          content_text: string | null
          created_at: string
          deliverable_type: string
          id: string
          image_storage_path: string | null
          image_url: string | null
          qa_feedback: string | null
          qa_score: number | null
          request_id: string
          title: string | null
          version: number
        }
        Insert: {
          approved?: boolean
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          deliverable_type: string
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          qa_feedback?: string | null
          qa_score?: number | null
          request_id: string
          title?: string | null
          version?: number
        }
        Update: {
          approved?: boolean
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          deliverable_type?: string
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          qa_feedback?: string | null
          qa_score?: number | null
          request_id?: string
          title?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          daily_request_count: number
          email: string | null
          id: string
          last_request_date: string | null
          name: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          daily_request_count?: number
          email?: string | null
          id: string
          last_request_date?: string | null
          name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          daily_request_count?: number
          email?: string | null
          id?: string
          last_request_date?: string | null
          name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_briefings: {
        Row: {
          audience: string | null
          audience_profile: string | null
          brand_context: string | null
          briefing_version: number
          created_at: string
          cta: string | null
          format: string | null
          goal: string | null
          id: string
          is_final: boolean
          mandatory_elements: Json | null
          offer: string | null
          piece_type: string | null
          product: string | null
          request_id: string
          restrictions: Json | null
          structured_brief_json: Json | null
          summary: string | null
          tone: string | null
        }
        Insert: {
          audience?: string | null
          audience_profile?: string | null
          brand_context?: string | null
          briefing_version?: number
          created_at?: string
          cta?: string | null
          format?: string | null
          goal?: string | null
          id?: string
          is_final?: boolean
          mandatory_elements?: Json | null
          offer?: string | null
          piece_type?: string | null
          product?: string | null
          request_id: string
          restrictions?: Json | null
          structured_brief_json?: Json | null
          summary?: string | null
          tone?: string | null
        }
        Update: {
          audience?: string | null
          audience_profile?: string | null
          brand_context?: string | null
          briefing_version?: number
          created_at?: string
          cta?: string | null
          format?: string | null
          goal?: string | null
          id?: string
          is_final?: boolean
          mandatory_elements?: Json | null
          offer?: string | null
          piece_type?: string | null
          product?: string | null
          request_id?: string
          restrictions?: Json | null
          structured_brief_json?: Json | null
          summary?: string | null
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_briefings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          payload: Json | null
          request_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          request_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_questions: {
        Row: {
          answer_text: string | null
          answered_at: string | null
          created_at: string
          id: string
          question_order: number
          question_text: string
          request_id: string
        }
        Insert: {
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          id?: string
          question_order: number
          question_text: string
          request_id: string
        }
        Update: {
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          id?: string
          question_order?: number
          question_text?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_questions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          created_at: string
          delivery_format: string | null
          id: string
          initial_message: string
          last_completed_step: string | null
          marketing_goal: string | null
          needs_human_review: boolean
          product_line: string | null
          request_type: string | null
          revision_count: number
          source_channel: string
          status: string
          target_audience: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_format?: string | null
          id?: string
          initial_message: string
          last_completed_step?: string | null
          marketing_goal?: string | null
          needs_human_review?: boolean
          product_line?: string | null
          request_type?: string | null
          revision_count?: number
          source_channel?: string
          status?: string
          target_audience?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_format?: string | null
          id?: string
          initial_message?: string
          last_completed_step?: string | null
          marketing_goal?: string | null
          needs_human_review?: boolean
          product_line?: string | null
          request_type?: string | null
          revision_count?: number
          source_channel?: string
          status?: string
          target_audience?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
