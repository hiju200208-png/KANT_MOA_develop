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
    PostgrestVersion: "14.18"
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
      addresses: {
        Row: {
          address1: string
          address2: string | null
          created_at: string
          id: number
          is_default: boolean
          label: string | null
          postal_code: string
          recipient_name: string
          recipient_phone: string
          user_id: string
        }
        Insert: {
          address1: string
          address2?: string | null
          created_at?: string
          id?: never
          is_default?: boolean
          label?: string | null
          postal_code: string
          recipient_name: string
          recipient_phone: string
          user_id: string
        }
        Update: {
          address1?: string
          address2?: string | null
          created_at?: string
          id?: never
          is_default?: boolean
          label?: string | null
          postal_code?: string
          recipient_name?: string
          recipient_phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_members: {
        Row: {
          artist_id: number
          birthday: string | null
          color: string | null
          description: string | null
          id: number
          image_path: string | null
          mascot: string | null
          mbti: string | null
          name: string
          name_en: string
          position: string | null
          sort_order: number
          tags: string[]
        }
        Insert: {
          artist_id: number
          birthday?: string | null
          color?: string | null
          description?: string | null
          id?: never
          image_path?: string | null
          mascot?: string | null
          mbti?: string | null
          name: string
          name_en: string
          position?: string | null
          sort_order?: number
          tags?: string[]
        }
        Update: {
          artist_id?: number
          birthday?: string | null
          color?: string | null
          description?: string | null
          id?: never
          image_path?: string | null
          mascot?: string | null
          mbti?: string | null
          name?: string
          name_en?: string
          position?: string | null
          sort_order?: number
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "artist_members_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          created_at: string
          hero_image_path: string | null
          id: number
          logo_path: string | null
          name: string
          name_ko: string
          slug: string
          sort_order: number
          theme_color: string | null
        }
        Insert: {
          created_at?: string
          hero_image_path?: string | null
          id?: never
          logo_path?: string | null
          name: string
          name_ko: string
          slug: string
          sort_order?: number
          theme_color?: string | null
        }
        Update: {
          created_at?: string
          hero_image_path?: string | null
          id?: never
          logo_path?: string | null
          name?: string
          name_ko?: string
          slug?: string
          sort_order?: number
          theme_color?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: number
          quantity: number
          user_id: string
          variant_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          quantity: number
          user_id: string
          variant_id: number
        }
        Update: {
          created_at?: string
          id?: never
          quantity?: number
          user_id?: string
          variant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: number
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: never
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: number
          option_name: string
          order_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id: number
        }
        Insert: {
          id?: never
          option_name: string
          order_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id: number
        }
        Update: {
          id?: never
          option_name?: string
          order_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          variant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          cancelled_at: string | null
          created_at: string
          id: string
          paid_at: string | null
          recipient_name: string
          recipient_phone: string
          status: string
          total_price: number
          user_id: string
        }
        Insert: {
          address: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          recipient_name: string
          recipient_phone: string
          status?: string
          total_price: number
          user_id: string
        }
        Update: {
          address?: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          recipient_name?: string
          recipient_phone?: string
          status?: string
          total_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: number
          image_path: string
          product_id: number
          sort_order: number
        }
        Insert: {
          id?: never
          image_path: string
          product_id: number
          sort_order?: number
        }
        Update: {
          id?: never
          image_path?: string
          product_id?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          extra_price: number
          id: number
          max_per_user: number | null
          option_name: string
          product_id: number
          sort_order: number
          stock: number
        }
        Insert: {
          extra_price?: number
          id?: never
          max_per_user?: number | null
          option_name?: string
          product_id: number
          sort_order?: number
          stock?: number
        }
        Update: {
          extra_price?: number
          id?: never
          max_per_user?: number | null
          option_name?: string
          product_id?: number
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          artist_id: number
          category_id: number
          created_at: string
          description: string | null
          id: number
          name: string
          price: number
          status: string
          thumbnail_path: string | null
        }
        Insert: {
          artist_id: number
          category_id: number
          created_at?: string
          description?: string | null
          id?: never
          name: string
          price: number
          status?: string
          thumbnail_path?: string | null
        }
        Update: {
          artist_id?: number
          category_id?: number
          created_at?: string
          description?: string | null
          id?: never
          name?: string
          price?: number
          status?: string
          thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          id: string
          nickname: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      create_order: {
        Args: {
          p_address: string
          p_recipient_name: string
          p_recipient_phone: string
        }
        Returns: string
      }
      merge_cart: { Args: { p_items: Json }; Returns: undefined }
      pay_order: { Args: { p_order_id: string }; Returns: undefined }
      set_default_address: {
        Args: { p_address_id: number }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
