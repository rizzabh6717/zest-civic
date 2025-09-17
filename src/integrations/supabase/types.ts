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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      grievances: {
        Row: {
          ai_classification: Json | null
          blockchain_tx_hash: string | null
          category: string | null
          citizen_id: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          location: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_classification?: Json | null
          blockchain_tx_hash?: string | null
          category?: string | null
          citizen_id: string
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          location?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_classification?: Json | null
          blockchain_tx_hash?: string | null
          category?: string | null
          citizen_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          location?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          reputation_score: number | null
          updated_at: string
          user_id: string
          user_type: string
          verified: boolean | null
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          reputation_score?: number | null
          updated_at?: string
          user_id: string
          user_type: string
          verified?: boolean | null
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          reputation_score?: number | null
          updated_at?: string
          user_id?: string
          user_type?: string
          verified?: boolean | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          assigned_at: string
          bid_id: string
          completed_at: string | null
          escrow_amount: number | null
          grievance_id: string
          id: string
          proof_image_url: string | null
          verification_status: string | null
          worker_id: string
        }
        Insert: {
          assigned_at?: string
          bid_id: string
          completed_at?: string | null
          escrow_amount?: number | null
          grievance_id: string
          id?: string
          proof_image_url?: string | null
          verification_status?: string | null
          worker_id: string
        }
        Update: {
          assigned_at?: string
          bid_id?: string
          completed_at?: string | null
          escrow_amount?: number | null
          grievance_id?: string
          id?: string
          proof_image_url?: string | null
          verification_status?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "worker_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_grievance_id_fkey"
            columns: ["grievance_id"]
            isOneToOne: false
            referencedRelation: "grievances"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_bids: {
        Row: {
          bid_amount: number
          created_at: string
          grievance_id: string
          id: string
          proposal: string | null
          status: string | null
          worker_id: string
        }
        Insert: {
          bid_amount: number
          created_at?: string
          grievance_id: string
          id?: string
          proposal?: string | null
          status?: string | null
          worker_id: string
        }
        Update: {
          bid_amount?: number
          created_at?: string
          grievance_id?: string
          id?: string
          proposal?: string | null
          status?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_bids_grievance_id_fkey"
            columns: ["grievance_id"]
            isOneToOne: false
            referencedRelation: "grievances"
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
  public: {
    Enums: {},
  },
} as const
