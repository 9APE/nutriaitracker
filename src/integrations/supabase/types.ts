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
      ai_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          input: Json | null
          kind: string
          output: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          kind: string
          output?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          kind?: string
          output?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          active_job_id: string | null
          citations: Json | null
          content: string
          created_at: string
          id: string
          kind: string | null
          meal_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          active_job_id?: string | null
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          kind?: string | null
          meal_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          active_job_id?: string | null
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          kind?: string | null
          meal_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_layout: {
        Row: {
          layout: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          layout: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          layout?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          id: string
          member_id: string
          name: string | null
          profile: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          name?: string | null
          profile?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          name?: string | null
          profile?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          calories: number
          carbs: number
          extended: Json | null
          fat: number
          protein: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          extended?: Json | null
          fat?: number
          protein?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          extended?: Json | null
          fat?: number
          protein?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grocery_lists: {
        Row: {
          items: Json
          updated_at: string
          user_id: string
          week_key: string
        }
        Insert: {
          items?: Json
          updated_at?: string
          user_id: string
          week_key: string
        }
        Update: {
          items?: Json
          updated_at?: string
          user_id?: string
          week_key?: string
        }
        Relationships: []
      }
      meal_favorites: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          fat: number
          id: string
          last_used_at: string | null
          meal_name: string
          micros: Json | null
          protein: number
          type: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          last_used_at?: string | null
          meal_name: string
          micros?: Json | null
          protein?: number
          type: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          last_used_at?: string | null
          meal_name?: string
          micros?: Json | null
          protein?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          plan: Json
          updated_at: string
          user_id: string
          week_key: string
        }
        Insert: {
          plan?: Json
          updated_at?: string
          user_id: string
          week_key: string
        }
        Update: {
          plan?: Json
          updated_at?: string
          user_id?: string
          week_key?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          date: string
          fat: number
          id: string
          meal_name: string
          micros: Json | null
          protein: number
          type: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          id?: string
          meal_name: string
          micros?: Json | null
          protein?: number
          type: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          id?: string
          meal_name?: string
          micros?: Json | null
          protein?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          calendar_token: string | null
          created_at: string
          display_name: string | null
          height_cm: number | null
          id: string
          updated_at: string
          user_profile_json: Json | null
          user_warnings_json: Json | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          calendar_token?: string | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id: string
          updated_at?: string
          user_profile_json?: Json | null
          user_warnings_json?: Json | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          calendar_token?: string | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id?: string
          updated_at?: string
          user_profile_json?: Json | null
          user_warnings_json?: Json | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          recipe: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_state: {
        Row: {
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
