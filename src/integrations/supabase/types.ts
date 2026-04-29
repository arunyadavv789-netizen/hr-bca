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
      form_questions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          options: Json | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          required: boolean
          section_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          options?: Json | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          required?: boolean
          section_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          required?: boolean
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          form_id: string
          id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          form_id: string
          id?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          form_id?: string
          id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_sections: {
        Row: {
          created_at: string
          display_order: number
          form_id: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          form_id: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          display_order?: number
          form_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_sections_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          note: string | null
          status: Database["public"]["Enums"]["form_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["form_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["form_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          date_of_joining: string | null
          department: string | null
          email: string
          full_name: string
          id: string
          job_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      response_analysis: {
        Row: {
          created_at: string
          id: string
          overall_score: number
          parameters: Json
          questions: Json
          response_id: string
          summary: string | null
          updated_at: string
          verdict: string
        }
        Insert: {
          created_at?: string
          id?: string
          overall_score: number
          parameters?: Json
          questions?: Json
          response_id: string
          summary?: string | null
          updated_at?: string
          verdict: string
        }
        Update: {
          created_at?: string
          id?: string
          overall_score?: number
          parameters?: Json
          questions?: Json
          response_id?: string
          summary?: string | null
          updated_at?: string
          verdict?: string
        }
        Relationships: []
      }
      response_answers: {
        Row: {
          answer_text: string | null
          created_at: string
          id: string
          question_id: string
          rating_value: number | null
          response_id: string
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id: string
          rating_value?: number | null
          response_id: string
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id?: string
          rating_value?: number | null
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "form_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "form_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hr: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "hr_manager" | "hr" | "employee"
      form_status: "draft" | "published" | "closed"
      question_type: "text" | "textarea" | "dropdown" | "rating"
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
    Enums: {
      app_role: ["hr_manager", "hr", "employee"],
      form_status: ["draft", "published", "closed"],
      question_type: ["text", "textarea", "dropdown", "rating"],
    },
  },
} as const
