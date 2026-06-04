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
      admin_earnings: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          source: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      admin_withdrawals: {
        Row: {
          account_number: string
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          processed_at: string | null
          status: string
        }
        Insert: {
          account_number?: string
          amount: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          account_number?: string
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          auto_blocked: boolean
          blocked_at: string
          id: string
          ip_address: string
          is_active: boolean
          reason: string
          unblocked_at: string | null
          unblocked_by: string | null
          violation_count: number
        }
        Insert: {
          auto_blocked?: boolean
          blocked_at?: string
          id?: string
          ip_address: string
          is_active?: boolean
          reason?: string
          unblocked_at?: string | null
          unblocked_by?: string | null
          violation_count?: number
        }
        Update: {
          auto_blocked?: boolean
          blocked_at?: string
          id?: string
          ip_address?: string
          is_active?: boolean
          reason?: string
          unblocked_at?: string | null
          unblocked_by?: string | null
          violation_count?: number
        }
        Relationships: []
      }
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
          reply_to_id: string | null
          token_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          is_pinned?: boolean
          message: string
          reply_to_id?: string | null
          token_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          is_pinned?: boolean
          message?: string
          reply_to_id?: string | null
          token_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
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
      coin_gifts: {
        Row: {
          amount: number
          created_at: string
          gift_type: string
          id: string
          message: string
          sender_user_id: string | null
          sender_username: string
        }
        Insert: {
          amount?: number
          created_at?: string
          gift_type?: string
          id?: string
          message?: string
          sender_user_id?: string | null
          sender_username: string
        }
        Update: {
          amount?: number
          created_at?: string
          gift_type?: string
          id?: string
          message?: string
          sender_user_id?: string | null
          sender_username?: string
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
          phone: string
          price: number
          short_id: string
          status: string
          user_id: string
        }
        Insert: {
          coin_amount: number
          created_at?: string
          id?: string
          package_id: string
          payment_proof_url?: string
          phone?: string
          price: number
          short_id?: string
          status?: string
          user_id: string
        }
        Update: {
          coin_amount?: number
          created_at?: string
          id?: string
          package_id?: string
          payment_proof_url?: string
          phone?: string
          price?: number
          short_id?: string
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
      ip_visit_log: {
        Row: {
          first_seen_at: string
          id: string
          ip_address: string
          last_seen_at: string
          path: string | null
          user_agent: string | null
          visit_count: number
        }
        Insert: {
          first_seen_at?: string
          id?: string
          ip_address: string
          last_seen_at?: string
          path?: string | null
          user_agent?: string | null
          visit_count?: number
        }
        Update: {
          first_seen_at?: string
          id?: string
          ip_address?: string
          last_seen_at?: string
          path?: string | null
          user_agent?: string | null
          visit_count?: number
        }
        Relationships: []
      }
      jkt48_lyrics: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string | null
          contributor_name: string | null
          contributor_user_id: string | null
          created_at: string
          external_title: string | null
          id: string
          is_link_only: boolean
          song_id: string
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          contributor_name?: string | null
          contributor_user_id?: string | null
          created_at?: string
          external_title?: string | null
          id?: string
          is_link_only?: boolean
          song_id: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          contributor_name?: string | null
          contributor_user_id?: string | null
          created_at?: string
          external_title?: string | null
          id?: string
          is_link_only?: boolean
          song_id?: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jkt48_lyrics_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "jkt48_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      jkt48_setlists: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      jkt48_songs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          setlist_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          setlist_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          setlist_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jkt48_songs_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "jkt48_setlists"
            referencedColumns: ["id"]
          },
        ]
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
      live_polls: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          is_active: boolean
          options: Json
          question: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          photo_url?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string
          sort_order?: number
          updated_at?: string
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
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      pakasir_orders: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          order_id: string
          phone: string
          qr_string: string
          show_id: string
          status: string
          token_code: string | null
          token_id: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          order_id: string
          phone: string
          qr_string?: string
          show_id: string
          status?: string
          token_code?: string | null
          token_id?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          phone?: string
          qr_string?: string
          show_id?: string
          status?: string
          token_code?: string | null
          token_id?: string | null
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          created_at: string
          id: string
          identifier: string
          phone: string
          processed_at: string | null
          short_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier?: string
          phone?: string
          processed_at?: string | null
          short_id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          phone?: string
          processed_at?: string | null
          short_id?: string
          status?: string
          user_id?: string
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
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "live_polls"
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
      rate_limit_violations: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_address: string
          violation_key: string
        }
        Insert: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address: string
          violation_key?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string
          violation_key?: string
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
      referral_claims: {
        Row: {
          claimer_user_id: string
          created_at: string
          id: string
          referral_id: string
        }
        Insert: {
          claimer_user_id: string
          created_at?: string
          id?: string
          referral_id: string
        }
        Update: {
          claimer_user_id?: string
          created_at?: string
          id?: string
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_claims_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          reward_coins: number
          user_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          reward_coins?: number
          user_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          reward_coins?: number
          user_id?: string
          uses?: number
        }
        Relationships: []
      }
      reseller_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string
          metadata: Json
          reseller_id: string
          target_token_id: string | null
          user_agent: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string
          metadata?: Json
          reseller_id: string
          target_token_id?: string | null
          user_agent?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string
          metadata?: Json
          reseller_id?: string
          target_token_id?: string | null
          user_agent?: string
        }
        Relationships: []
      }
      reseller_phones: {
        Row: {
          created_at: string
          id: string
          label: string
          phone: string
          reseller_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          phone: string
          reseller_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          phone?: string
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_phones_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_quota_logs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string
          reseller_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          reseller_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          reseller_id?: string
        }
        Relationships: []
      }
      resellers: {
        Row: {
          bot_enabled: boolean
          commission_rate: number
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string
          prefix: string
          token_quota: number
          total_tokens_created: number
          updated_at: string
          user_id: string
          username: string
          whatsapp: string
        }
        Insert: {
          bot_enabled?: boolean
          commission_rate?: number
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string
          prefix?: string
          token_quota?: number
          total_tokens_created?: number
          updated_at?: string
          user_id: string
          username: string
          whatsapp?: string
        }
        Update: {
          bot_enabled?: boolean
          commission_rate?: number
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string
          prefix?: string
          token_quota?: number
          total_tokens_created?: number
          updated_at?: string
          user_id?: string
          username?: string
          whatsapp?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          ip_address: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
        }
        Relationships: []
      }
      self_password_resets: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          phone: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          phone?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
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
          access_password: string
          background_image_url: string | null
          category: string
          category_member: string
          coin_price: number
          created_at: string
          group_link: string
          id: string
          is_active: boolean
          is_order_closed: boolean
          is_replay: boolean
          is_subscription: boolean
          lineup: string
          max_subscribers: number
          price: string
          qris_image_url: string | null
          replay_coin_price: number
          replay_embed_type: string
          replay_embed_url: string
          schedule_date: string
          schedule_time: string
          sort_order: number
          subscription_benefits: string
          title: string
        }
        Insert: {
          access_password?: string
          background_image_url?: string | null
          category?: string
          category_member?: string
          coin_price?: number
          created_at?: string
          group_link?: string
          id?: string
          is_active?: boolean
          is_order_closed?: boolean
          is_replay?: boolean
          is_subscription?: boolean
          lineup?: string
          max_subscribers?: number
          price?: string
          qris_image_url?: string | null
          replay_coin_price?: number
          replay_embed_type?: string
          replay_embed_url?: string
          schedule_date?: string
          schedule_time?: string
          sort_order?: number
          subscription_benefits?: string
          title: string
        }
        Update: {
          access_password?: string
          background_image_url?: string | null
          category?: string
          category_member?: string
          coin_price?: number
          created_at?: string
          group_link?: string
          id?: string
          is_active?: boolean
          is_order_closed?: boolean
          is_replay?: boolean
          is_subscription?: boolean
          lineup?: string
          max_subscribers?: number
          price?: string
          qris_image_url?: string | null
          replay_coin_price?: number
          replay_embed_type?: string
          replay_embed_url?: string
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
          payment_method: string
          payment_proof_url: string
          phone: string
          short_id: string
          show_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          payment_method?: string
          payment_proof_url?: string
          phone?: string
          short_id?: string
          show_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          payment_method?: string
          payment_proof_url?: string
          phone?: string
          short_id?: string
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
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          processed: boolean
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          processed?: boolean
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          processed?: boolean
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
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
          buyer_user_id: string | null
          code: string
          created_at: string
          created_by_reseller_id: string | null
          duration_type: string
          expires_at: string
          id: string
          is_public: boolean
          locked_fingerprint: string | null
          max_devices: number
          replay_expires_at: string | null
          replay_password: string | null
          show_id: string | null
          status: string
        }
        Insert: {
          buyer_user_id?: string | null
          code: string
          created_at?: string
          created_by_reseller_id?: string | null
          duration_type: string
          expires_at: string
          id?: string
          is_public?: boolean
          locked_fingerprint?: string | null
          max_devices?: number
          replay_expires_at?: string | null
          replay_password?: string | null
          show_id?: string | null
          status?: string
        }
        Update: {
          buyer_user_id?: string | null
          code?: string
          created_at?: string
          created_by_reseller_id?: string | null
          duration_type?: string
          expires_at?: string
          id?: string
          is_public?: boolean
          locked_fingerprint?: string | null
          max_devices?: number
          replay_expires_at?: string | null
          replay_password?: string | null
          show_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
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
      viewer_presence: {
        Row: {
          last_seen_at: string
          viewer_key: string
        }
        Insert: {
          last_seen_at?: string
          viewer_key: string
        }
        Update: {
          last_seen_at?: string
          viewer_key?: string
        }
        Relationships: []
      }
      watch_parties: {
        Row: {
          created_at: string
          host_token_code: string | null
          host_username: string
          id: string
          is_active: boolean
          is_playing: boolean | null
          playback_position: number | null
          playlist_index: number | null
          room_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          host_token_code?: string | null
          host_username: string
          id?: string
          is_active?: boolean
          is_playing?: boolean | null
          playback_position?: number | null
          playlist_index?: number | null
          room_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          host_token_code?: string | null
          host_username?: string
          id?: string
          is_active?: boolean
          is_playing?: boolean | null
          playback_position?: number | null
          playlist_index?: number | null
          room_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      watch_party_members: {
        Row: {
          id: string
          joined_at: string
          party_id: string
          username: string
        }
        Insert: {
          id?: string
          joined_at?: string
          party_id: string
          username: string
        }
        Update: {
          id?: string
          joined_at?: string
          party_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_coins: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: Json
      }
      admin_reset_chat: { Args: never; Returns: Json }
      admin_topup_reseller_quota: {
        Args: { _amount: number; _reason: string; _reseller_id: string }
        Returns: Json
      }
      bot_create_token: {
        Args: {
          _actor_phone: string
          _duration_type: string
          _is_admin?: boolean
          _max_devices?: number
          _show_id?: string
        }
        Returns: Json
      }
      check_ip_banned: { Args: { _ip: string }; Returns: Json }
      check_rate_limit: {
        Args: { _key: string; _max_requests: number; _window_seconds: number }
        Returns: boolean
      }
      claim_referral: { Args: { _code: string }; Returns: Json }
      cleanup_old_otp_codes: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      cleanup_self_password_resets: { Args: never; Returns: undefined }
      cleanup_viewer_presence: { Args: never; Returns: undefined }
      complete_pakasir_order: {
        Args: { _amount: number; _order_id: string }
        Returns: Json
      }
      confirm_coin_order: { Args: { _order_id: string }; Returns: Json }
      create_pakasir_order: {
        Args: {
          _amount: number
          _email: string
          _phone: string
          _show_id: string
        }
        Returns: Json
      }
      create_token_session: {
        Args: { _fingerprint: string; _token_code: string; _user_agent: string }
        Returns: Json
      }
      expire_old_coin_orders: { Args: never; Returns: undefined }
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
      get_my_active_show_tokens: { Args: never; Returns: Json }
      get_my_password_reset_status: { Args: never; Returns: Json }
      get_or_create_referral_code: { Args: never; Returns: Json }
      get_order_count: { Args: { _show_id: string }; Returns: number }
      get_pakasir_order_status: { Args: { _order_id: string }; Returns: Json }
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
          access_password: string
          background_image_url: string | null
          category: string
          category_member: string
          coin_price: number
          created_at: string
          group_link: string
          id: string
          is_active: boolean
          is_order_closed: boolean
          is_replay: boolean
          is_subscription: boolean
          lineup: string
          max_subscribers: number
          price: string
          qris_image_url: string | null
          replay_coin_price: number
          replay_embed_type: string
          replay_embed_url: string
          schedule_date: string
          schedule_time: string
          sort_order: number
          subscription_benefits: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "shows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_purchased_show_passwords: { Args: never; Returns: Json }
      get_replay_access: { Args: { _token_code: string }; Returns: Json }
      get_viewer_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_auth_user: {
        Args: { _email: string; _id: string; _username: string }
        Returns: undefined
      }
      log_ip_visit: {
        Args: { _ip: string; _path: string; _ua: string }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          _description: string
          _ip?: string
          _severity?: string
          _type: string
        }
        Returns: undefined
      }
      lookup_reseller_by_phone: { Args: { _phone: string }; Returns: Json }
      moderator_create_token: {
        Args: {
          _code: string
          _duration_type: string
          _expires_at: string
          _max_devices: number
        }
        Returns: Json
      }
      obfuscate_url: { Args: { _url: string }; Returns: string }
      parse_show_datetime: {
        Args: { _date: string; _time: string }
        Returns: string
      }
      redeem_coins_for_membership: {
        Args: { _email: string; _phone: string; _show_id: string }
        Returns: Json
      }
      redeem_coins_for_replay: { Args: { _show_id: string }; Returns: Json }
      redeem_coins_for_token: { Args: { _show_id: string }; Returns: Json }
      release_token_session: {
        Args: { _fingerprint: string; _token_code: string }
        Returns: undefined
      }
      request_password_reset:
        | { Args: { _identifier: string }; Returns: Json }
        | {
            Args: { _identifier: string; _new_password?: string }
            Returns: Json
          }
      reseller_create_token: {
        Args: {
          _code: string
          _duration_type: string
          _expires_at: string
          _max_devices: number
        }
        Returns: Json
      }
      reseller_get_my_stats: { Args: never; Returns: Json }
      reseller_log_action: {
        Args: { _action: string; _metadata?: Json }
        Returns: undefined
      }
      reset_chat_daily: { Args: never; Returns: undefined }
      self_consume_password_reset: {
        Args: { _token_hash: string }
        Returns: Json
      }
      self_request_password_reset: {
        Args: { _identifier: string; _token_hash: string }
        Returns: Json
      }
      self_reset_token_session: {
        Args: { _fingerprint: string; _token_code: string }
        Returns: Json
      }
      send_coin_gift: {
        Args: { _amount: number; _gift_type: string; _message: string }
        Returns: Json
      }
      set_pakasir_qr: {
        Args: { _expires_at: string; _order_id: string; _qr_string: string }
        Returns: Json
      }
      submit_lyric_contribution: {
        Args: {
          _content: string
          _is_link_only: boolean
          _setlist_id: string
          _source_url: string
          _title: string
        }
        Returns: Json
      }
      validate_token: { Args: { _code: string }; Returns: Json }
      viewer_heartbeat: { Args: { _key: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "reseller"
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
      app_role: ["admin", "moderator", "user", "reseller"],
    },
  },
} as const
