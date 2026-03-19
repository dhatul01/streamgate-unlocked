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
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_at: string
          id: string
          reason: string | null
          token_id: string | null
        }
        Insert: {
          blocked_at?: string
          id?: string
          reason?: string | null
          token_id?: string | null
        }
        Update: {
          blocked_at?: string
          id?: string
          reason?: string | null
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          is_pinned: boolean
          message: string
          token_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          is_pinned?: boolean
          message: string
          token_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          is_pinned?: boolean
          message?: string
          token_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_moderators: {
        Row: {
          appointed_by: string | null
          created_at: string
          id: string
          username: string
        }
        Insert: {
          appointed_by?: string | null
          created_at?: string
          id?: string
          username: string
        }
        Update: {
          appointed_by?: string | null
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      coin_balances: {
        Row: {
          balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_orders: {
        Row: {
          coin_amount: number
          created_at: string
          id: string
          package_id: string
          payment_proof_url: string
          price: number
          status: string
          user_id: string
        }
        Insert: {
          coin_amount: number
          created_at?: string
          id?: string
          package_id: string
          payment_proof_url?: string
          price: number
          status?: string
          user_id: string
        }
        Update: {
          coin_amount?: number
          created_at?: string
          id?: string
          package_id?: string
          payment_proof_url?: string
          price?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "coin_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_packages: {
        Row: {
          coin_amount: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          qris_image_url: string | null
          sort_order: number
        }
        Insert: {
          coin_amount: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          qris_image_url?: string | null
          sort_order?: number
        }
        Update: {
          coin_amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          qris_image_url?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      landing_descriptions: {
        Row: {
          content: string
          created_at: string
          icon: string
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          text_align: string
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          text_align?: string
          title?: string
        }
        Update: {
          content?: string
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          text_align?: string
          title?: string
        }
        Relationships: []
      }
      moderator_playlists: {
        Row: {
          created_at: string
          id: string
          label: string
          moderator_id: string
          sort_order: number
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          moderator_id: string
          sort_order?: number
          type?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          moderator_id?: string
          sort_order?: number
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_playlists_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "moderators"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_token_logs: {
        Row: {
          created_at: string
          id: string
          moderator_id: string
          token_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moderator_id: string
          token_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moderator_id?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_token_logs_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "moderators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_token_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      moderators: {
        Row: {
          background_color: string
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          site_name: string
          user_id: string
          username: string
        }
        Insert: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          site_name?: string
          user_id: string
          username: string
        }
        Update: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          site_name?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          stream_id: string | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          stream_id?: string | null
          type: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          stream_id?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username?: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          key: string
          request_count: number
          window_start: string
        }
        Insert: {
          key: string
          request_count?: number
          window_start?: string
        }
        Update: {
          key?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      session_resets: {
        Row: {
          fingerprint: string
          id: string
          reset_at: string
          token_code: string
        }
        Insert: {
          fingerprint: string
          id?: string
          reset_at?: string
          token_code: string
        }
        Update: {
          fingerprint?: string
          id?: string
          reset_at?: string
          token_code?: string
        }
        Relationships: []
      }
      shows: {
        Row: {
          background_image_url: string | null
          category: string
          category_member: string
          coin_price: number
          created_at: string
          group_link: string
          id: string
          is_active: boolean
          is_order_closed: boolean
          is_subscription: boolean
          lineup: string
          max_subscribers: number
          price: string
          qris_image_url: string | null
          schedule_date: string
          schedule_time: string
          sort_order: number
          subscription_benefits: string
          title: string
        }
        Insert: {
          background_image_url?: string | null
          category?: string
          category_member?: string
          coin_price?: number
          created_at?: string
          group_link?: string
          id?: string
          is_active?: boolean
          is_order_closed?: boolean
          is_subscription?: boolean
          lineup?: string
          max_subscribers?: number
          price?: string
          qris_image_url?: string | null
          schedule_date?: string
          schedule_time?: string
          sort_order?: number
          subscription_benefits?: string
          title: string
        }
        Update: {
          background_image_url?: string | null
          category?: string
          category_member?: string
          coin_price?: number
          created_at?: string
          group_link?: string
          id?: string
          is_active?: boolean
          is_order_closed?: boolean
          is_subscription?: boolean
          lineup?: string
          max_subscribers?: number
          price?: string
          qris_image_url?: string | null
          schedule_date?: string
          schedule_time?: string
          sort_order?: number
          subscription_benefits?: string
          title?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      streams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_live: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_live?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_live?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_orders: {
        Row: {
          created_at: string
          email: string
          id: string
          payment_proof_url: string
          phone: string
          show_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          payment_proof_url?: string
          phone?: string
          show_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          payment_proof_url?: string
          phone?: string
          show_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_orders_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      token_sessions: {
        Row: {
          connected_at: string
          fingerprint: string
          id: string
          token_id: string
          user_agent: string | null
        }
        Insert: {
          connected_at?: string
          fingerprint: string
          id?: string
          token_id: string
          user_agent?: string | null
        }
        Update: {
          connected_at?: string
          fingerprint?: string
          id?: string
          token_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_sessions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          code: string
          created_at: string
          duration_type: string
          expires_at: string
          id: string
          is_public: boolean
          max_devices: number
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_type: string
          expires_at: string
          id?: string
          is_public?: boolean
          max_devices?: number
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_type?: string
          expires_at?: string
          id?: string
          is_public?: boolean
          max_devices?: number
          status?: string
        }
        Relationships: []
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
      check_rate_limit: {
        Args: { _key: string; _max_requests: number; _window_seconds: number }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      confirm_coin_order: { Args: { _order_id: string }; Returns: Json }
      create_token_session: {
        Args: { _fingerprint: string; _token_code: string; _user_agent: string }
        Returns: Json
      }
      get_confirmed_order_count: { Args: { _show_id: string }; Returns: number }
      get_moderator_playlists: {
        Args: { _moderator_username: string }
        Returns: {
          created_at: string
          id: string
          label: string
          moderator_id: string
          sort_order: number
          type: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "moderator_playlists"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_order_count: { Args: { _show_id: string }; Returns: number }
      get_playlists_for_channel: {
        Args: { _moderator_username: string }
        Returns: {
          created_at: string
          id: string
          label: string
          sort_order: number
          stream_id: string | null
          type: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "playlists"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_playlists_for_token: {
        Args: { _token_code: string }
        Returns: {
          created_at: string
          id: string
          label: string
          sort_order: number
          stream_id: string | null
          type: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "playlists"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_shows: {
        Args: never
        Returns: {
          background_image_url: string
          category: string
          category_member: string
          created_at: string
          group_link: string
          id: string
          is_active: boolean
          is_order_closed: boolean
          is_subscription: boolean
          lineup: string
          max_subscribers: number
          price: string
          qris_image_url: string
          schedule_date: string
          schedule_time: string
          sort_order: number
          subscription_benefits: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      moderator_create_token: {
        Args: {
          _code: string
          _duration_type: string
          _expires_at: string
          _max_devices: number
        }
        Returns: Json
      }
      redeem_coins_for_token: { Args: { _show_id: string }; Returns: Json }
      release_token_session: {
        Args: { _fingerprint: string; _token_code: string }
        Returns: undefined
      }
      self_reset_token_session: {
        Args: { _fingerprint: string; _token_code: string }
        Returns: Json
      }
      validate_token: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
