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
      audit_logs: {
        Row: {
          acting_as_admin: boolean
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          ip: unknown
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          acting_as_admin?: boolean
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          ip?: unknown
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          acting_as_admin?: boolean
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          ip?: unknown
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color_key: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_key?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_key?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      consignment_movements: {
        Row: {
          consignment_id: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          note: string | null
          occurred_on: string
          organization_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          consignment_id: string
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          note?: string | null
          occurred_on?: string
          organization_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          consignment_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          note?: string | null
          occurred_on?: string
          organization_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "v_consignment_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      consignment_settlement_items: {
        Row: {
          consignment_id: string
          id: string
          organization_id: string
          quantity: number
          settlement_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          consignment_id: string
          id?: string
          organization_id: string
          quantity: number
          settlement_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          consignment_id?: string
          id?: string
          organization_id?: string
          quantity?: number
          settlement_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "consignment_settlement_items_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_settlement_items_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "v_consignment_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_settlement_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_settlement_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_settlement_items_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "consignment_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      consignment_settlements: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          organization_id: string
          paid_at: string | null
          settled_on: string
          supplier_id: string
          total: number
          total_quantity: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id: string
          paid_at?: string | null
          settled_on?: string
          supplier_id: string
          total?: number
          total_quantity?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          paid_at?: string | null
          settled_on?: string
          supplier_id?: string
          total?: number
          total_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "consignment_settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_settlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_settlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignment_settlements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      consignments: {
        Row: {
          consign_price: number
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          note: string | null
          organization_id: string
          outlet_id: string
          product_id: string
          started_at: string
          supplier_id: string
        }
        Insert: {
          consign_price: number
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          note?: string | null
          organization_id: string
          outlet_id: string
          product_id: string
          started_at?: string
          supplier_id: string
        }
        Update: {
          consign_price?: number
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          outlet_id?: string
          product_id?: string
          started_at?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "consignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "consignments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          last_visit_at: string | null
          name: string
          note: string | null
          organization_id: string
          phone: string | null
          total_spent: number
          updated_at: string
          visit_count: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_visit_at?: string | null
          name: string
          note?: string | null
          organization_id: string
          phone?: string | null
          total_spent?: number
          updated_at?: string
          visit_count?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_visit_at?: string | null
          name?: string
          note?: string | null
          organization_id?: string
          phone?: string | null
          total_spent?: number
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          app_version: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          last_pull_at: string | null
          last_seen_at: string | null
          last_sync_at: string | null
          name: string
          organization_id: string
          outlet_id: string
          pending_count: number
          registered_by: string | null
          user_agent: string | null
        }
        Insert: {
          app_version?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_pull_at?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          name: string
          organization_id: string
          outlet_id: string
          pending_count?: number
          registered_by?: string | null
          user_agent?: string | null
        }
        Update: {
          app_version?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_pull_at?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          outlet_id?: string
          pending_count?: number
          registered_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "devices_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          expires_at: string
          id: string
          ip: unknown
          organization_id: string
          reason: string | null
          started_at: string
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip?: unknown
          organization_id: string
          reason?: string | null
          started_at?: string
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip?: unknown
          organization_id?: string
          reason?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          permissions: Json
          phone: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          permissions?: Json
          phone?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          permissions?: Json
          phone?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      member_pins: {
        Row: {
          member_id: string
          organization_id: string
          pin_hash: string
          updated_at: string
        }
        Insert: {
          member_id: string
          organization_id: string
          pin_hash: string
          updated_at?: string
        }
        Update: {
          member_id?: string
          organization_id?: string
          pin_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_pins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          default_outlet_id: string | null
          id: string
          invited_by: string | null
          job_title: string | null
          joined_at: string
          last_active_at: string | null
          organization_id: string
          permissions: Json
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_outlet_id?: string | null
          id?: string
          invited_by?: string | null
          job_title?: string | null
          joined_at?: string
          last_active_at?: string | null
          organization_id: string
          permissions?: Json
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_outlet_id?: string | null
          id?: string
          invited_by?: string | null
          job_title?: string | null
          joined_at?: string
          last_active_at?: string | null
          organization_id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_default_outlet_id_fkey"
            columns: ["default_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_default_outlet_id_fkey"
            columns: ["default_outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          allow_negative_stock: boolean
          catalog_version: number
          city: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          email: string | null
          id: string
          joined_at: string
          legal_name: string | null
          logo_url: string | null
          low_stock_threshold: number
          name: string
          offline_mode_enabled: boolean
          phone: string | null
          plan_id: string | null
          province: string | null
          slug: string
          status: Database["public"]["Enums"]["org_status"]
          status_changed_at: string
          tax_enabled: boolean
          tax_inclusive: boolean
          tax_percent: number
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_negative_stock?: boolean
          catalog_version?: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          joined_at?: string
          legal_name?: string | null
          logo_url?: string | null
          low_stock_threshold?: number
          name: string
          offline_mode_enabled?: boolean
          phone?: string | null
          plan_id?: string | null
          province?: string | null
          slug: string
          status?: Database["public"]["Enums"]["org_status"]
          status_changed_at?: string
          tax_enabled?: boolean
          tax_inclusive?: boolean
          tax_percent?: number
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_negative_stock?: boolean
          catalog_version?: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          joined_at?: string
          legal_name?: string | null
          logo_url?: string | null
          low_stock_threshold?: number
          name?: string
          offline_mode_enabled?: boolean
          phone?: string | null
          plan_id?: string | null
          province?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["org_status"]
          status_changed_at?: string
          tax_enabled?: boolean
          tax_inclusive?: boolean
          tax_percent?: number
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      outlets: {
        Row: {
          address: string | null
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          organization_id: string
          phone: string | null
          receipt_settings: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          organization_id: string
          phone?: string | null
          receipt_settings?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          receipt_settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outlets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_devices: number | null
          max_outlets: number | null
          max_products: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_devices?: number | null
          max_outlets?: number | null
          max_products?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_devices?: number | null
          max_outlets?: number | null
          max_products?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          brand_tagline: string
          default_timezone: string
          id: boolean
          maintenance_mode: boolean
          platform_name: string
          support_email: string
          support_phone: string | null
          trial_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_tagline?: string
          default_timezone?: string
          id?: boolean
          maintenance_mode?: boolean
          platform_name?: string
          support_email?: string
          support_phone?: string | null
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_tagline?: string
          default_timezone?: string
          id?: boolean
          maintenance_mode?: boolean
          platform_name?: string
          support_email?: string
          support_phone?: string | null
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stocks: {
        Row: {
          id: string
          organization_id: string
          outlet_id: string
          product_id: string
          quantity: number
          reserved: number
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          outlet_id: string
          product_id: string
          quantity?: number
          reserved?: number
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          outlet_id?: string
          product_id?: string
          quantity?: number
          reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "product_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_stock: number
          name: string
          organization_id: string
          sell_price: number
          sku: string
          track_stock: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock?: number
          name: string
          organization_id: string
          sell_price?: number
          sku: string
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock?: number
          name?: string
          organization_id?: string
          sell_price?: number
          sku?: string
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_no: string | null
          note: string | null
          organization_id: string
          outlet_id: string
          paid_at: string | null
          payment: Database["public"]["Enums"]["purchase_payment"]
          purchased_at: string
          supplier_id: string | null
          total: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string | null
          note?: string | null
          organization_id: string
          outlet_id: string
          paid_at?: string | null
          payment?: Database["public"]["Enums"]["purchase_payment"]
          purchased_at?: string
          supplier_id?: string | null
          total?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_no?: string | null
          note?: string | null
          organization_id?: string
          outlet_id?: string
          paid_at?: string | null
          payment?: Database["public"]["Enums"]["purchase_payment"]
          purchased_at?: string
          supplier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          cash_difference: number | null
          closed_at: string | null
          closing_cash: number | null
          created_at: string
          device_id: string | null
          expected_cash: number | null
          id: string
          note: string | null
          opened_at: string
          opening_cash: number
          organization_id: string
          outlet_id: string
          status: Database["public"]["Enums"]["shift_status"]
          user_id: string
        }
        Insert: {
          cash_difference?: number | null
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          device_id?: string | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opening_cash?: number
          organization_id: string
          outlet_id: string
          status?: Database["public"]["Enums"]["shift_status"]
          user_id: string
        }
        Update: {
          cash_difference?: number | null
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          device_id?: string | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opening_cash?: number
          organization_id?: string
          outlet_id?: string
          status?: Database["public"]["Enums"]["shift_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v_sync_health"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          organization_id: string
          outlet_id: string
          product_id: string
          quantity_delta: number
          ref_id: string | null
          ref_table: string | null
          type: Database["public"]["Enums"]["stock_move_type"]
          unit_cost: number | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id: string
          outlet_id: string
          product_id: string
          quantity_delta: number
          ref_id?: string | null
          ref_table?: string | null
          type: Database["public"]["Enums"]["stock_move_type"]
          unit_cost?: number | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          outlet_id?: string
          product_id?: string
          quantity_delta?: number
          ref_id?: string | null
          ref_table?: string | null
          type?: Database["public"]["Enums"]["stock_move_type"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          balance_from: number
          balance_to: number
          id: string
          organization_id: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          balance_from: number
          balance_to: number
          id?: string
          organization_id: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Update: {
          balance_from?: number
          balance_to?: number
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          from_outlet_id: string
          id: string
          note: string | null
          organization_id: string
          to_outlet_id: string
          transferred_on: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          from_outlet_id: string
          id?: string
          note?: string | null
          organization_id: string
          to_outlet_id: string
          transferred_on?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          from_outlet_id?: string
          id?: string
          note?: string | null
          organization_id?: string
          to_outlet_id?: string
          transferred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_outlet_id_fkey"
            columns: ["from_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_outlet_id_fkey"
            columns: ["from_outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "stock_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_outlet_id_fkey"
            columns: ["to_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_outlet_id_fkey"
            columns: ["to_outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          action: Database["public"]["Enums"]["subscription_action"]
          amount: number
          created_at: string
          created_by: string | null
          from_plan_id: string | null
          id: string
          note: string | null
          organization_id: string
          period_end: string | null
          period_start: string | null
          plan_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["subscription_action"]
          amount?: number
          created_at?: string
          created_by?: string | null
          from_plan_id?: string | null
          id?: string
          note?: string | null
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["subscription_action"]
          amount?: number
          created_at?: string
          created_by?: string | null
          from_plan_id?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          note: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          note?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          note?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_batches: {
        Row: {
          accepted_count: number
          app_version: string | null
          device_id: string | null
          duplicate_count: number
          duration_ms: number | null
          id: string
          item_count: number
          oldest_client_at: string | null
          organization_id: string
          outlet_id: string | null
          received_at: string
          rejected_count: number
          submitted_by: string | null
        }
        Insert: {
          accepted_count?: number
          app_version?: string | null
          device_id?: string | null
          duplicate_count?: number
          duration_ms?: number | null
          id?: string
          item_count?: number
          oldest_client_at?: string | null
          organization_id: string
          outlet_id?: string | null
          received_at?: string
          rejected_count?: number
          submitted_by?: string | null
        }
        Update: {
          accepted_count?: number
          app_version?: string | null
          device_id?: string | null
          duplicate_count?: number
          duration_ms?: number | null
          id?: string
          item_count?: number
          oldest_client_at?: string | null
          organization_id?: string
          outlet_id?: string | null
          received_at?: string
          rejected_count?: number
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_batches_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_batches_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v_sync_health"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sync_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_batches_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_batches_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "sync_batches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_rejections: {
        Row: {
          batch_id: string | null
          client_trx_code: string | null
          client_trx_id: string | null
          created_at: string
          device_id: string | null
          id: string
          organization_id: string
          payload: Json
          reason: string | null
          reason_code: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          batch_id?: string | null
          client_trx_code?: string | null
          client_trx_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          organization_id: string
          payload: Json
          reason?: string | null
          reason_code: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          batch_id?: string | null
          client_trx_code?: string | null
          client_trx_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          reason?: string | null
          reason_code?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_rejections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "sync_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_rejections_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_rejections_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v_sync_health"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sync_rejections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_rejections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_rejections_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          created_at: string
          discount: number
          id: string
          line_no: number
          line_total: number
          organization_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          transaction_id: string
          unit: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          line_no?: number
          line_total: number
          organization_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          sku?: string | null
          transaction_id: string
          unit?: string
          unit_cost?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          line_no?: number
          line_total?: number
          organization_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          transaction_id?: string
          unit?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          organization_id: string
          reference: string | null
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          organization_id: string
          reference?: string | null
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          organization_id?: string
          reference?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          cashier_id: string
          change_amount: number
          client_created_at: string
          code: string
          cost_total: number
          created_at: string
          customer_id: string | null
          device_id: string | null
          discount_total: number
          id: string
          note: string | null
          organization_id: string
          origin: Database["public"]["Enums"]["trx_origin"]
          outlet_id: string
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          rounding: number
          shift_id: string | null
          status: Database["public"]["Enums"]["trx_status"]
          subtotal: number
          sync_lag: string | null
          synced_at: string | null
          tax_total: number
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          cashier_id: string
          change_amount?: number
          client_created_at?: string
          code: string
          cost_total?: number
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          discount_total?: number
          id?: string
          note?: string | null
          organization_id: string
          origin?: Database["public"]["Enums"]["trx_origin"]
          outlet_id: string
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          rounding?: number
          shift_id?: string | null
          status?: Database["public"]["Enums"]["trx_status"]
          subtotal?: number
          sync_lag?: string | null
          synced_at?: string | null
          tax_total?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          cashier_id?: string
          change_amount?: number
          client_created_at?: string
          code?: string
          cost_total?: number
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          discount_total?: number
          id?: string
          note?: string | null
          organization_id?: string
          origin?: Database["public"]["Enums"]["trx_origin"]
          outlet_id?: string
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          rounding?: number
          shift_id?: string | null
          status?: Database["public"]["Enums"]["trx_status"]
          subtotal?: number
          sync_lag?: string | null
          synced_at?: string | null
          tax_total?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v_sync_health"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_client_overview: {
        Row: {
          city: string | null
          id: string | null
          joined_at: string | null
          last_transaction_at: string | null
          name: string | null
          outlet_count: number | null
          plan_code: string | null
          plan_name: string | null
          product_count: number | null
          revenue_mtd: number | null
          slug: string | null
          status: Database["public"]["Enums"]["org_status"] | null
          trial_ends_at: string | null
          user_count: number | null
        }
        Relationships: []
      }
      v_client_quota: {
        Row: {
          max_devices: number | null
          max_outlets: number | null
          max_products: number | null
          max_users: number | null
          organization_id: string | null
          used_devices: number | null
          used_outlets: number | null
          used_products: number | null
          used_users: number | null
        }
        Relationships: []
      }
      v_consignment_summary: {
        Row: {
          amount_due: number | null
          consign_price: number | null
          ended_at: string | null
          id: string | null
          organization_id: string | null
          outlet_id: string | null
          product_id: string | null
          product_name: string | null
          qty_in: number | null
          qty_left: number | null
          qty_returned: number | null
          qty_settled: number | null
          qty_sold: number | null
          qty_unsettled: number | null
          sell_price: number | null
          sku: string | null
          started_at: string | null
          supplier_id: string | null
          supplier_name: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "consignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "consignments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_daily_sales: {
        Row: {
          avg_ticket: number | null
          cash_count: number | null
          cash_revenue: number | null
          cogs: number | null
          gross_profit: number | null
          offline_count: number | null
          organization_id: string | null
          outlet_id: string | null
          qris_count: number | null
          revenue: number | null
          sales_date: string | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
        ]
      }
      v_product_sales: {
        Row: {
          gross_profit: number | null
          organization_id: string | null
          outlet_id: string | null
          product_id: string | null
          product_name: string | null
          qty_sold: number | null
          revenue: number | null
          sales_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_alert"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "transactions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
        ]
      }
      v_product_stock: {
        Row: {
          barcode: string | null
          category_id: string | null
          category_name: string | null
          color_key: string | null
          cost_price: number | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          is_low_stock: boolean | null
          margin: number | null
          min_stock: number | null
          name: string | null
          organization_id: string | null
          outlet_id: string | null
          sell_price: number | null
          sku: string | null
          stock: number | null
          track_stock: boolean | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      v_shift_summary: {
        Row: {
          cash_difference: number | null
          cash_total: number | null
          cashier_name: string | null
          closed_at: string | null
          closing_cash: number | null
          device_code: string | null
          expected_cash: number | null
          id: string | null
          noncash_total: number | null
          note: string | null
          opened_at: string | null
          opening_cash: number | null
          organization_id: string | null
          outlet_id: string | null
          sales_total: number | null
          status: Database["public"]["Enums"]["shift_status"] | null
          trx_count: number | null
          user_id: string | null
          void_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_alert: {
        Row: {
          min_stock: number | null
          organization_id: string | null
          outlet_id: string | null
          outlet_name: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          severity: string | null
          sku: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stocks_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
        ]
      }
      v_sync_health: {
        Row: {
          app_version: string | null
          code: string | null
          device_id: string | null
          device_name: string | null
          last_seen_at: string | null
          last_sync_at: string | null
          offline_trx_7d: number | null
          open_rejections: number | null
          organization_id: string | null
          outlet_id: string | null
          pending_count: number | null
          since_last_sync: string | null
        }
        Insert: {
          app_version?: string | null
          code?: string | null
          device_id?: string | null
          device_name?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          offline_trx_7d?: never
          open_rejections?: never
          organization_id?: string | null
          outlet_id?: string | null
          pending_count?: number | null
          since_last_sync?: never
        }
        Update: {
          app_version?: string | null
          code?: string | null
          device_id?: string | null
          device_name?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          offline_trx_7d?: never
          open_rejections?: never
          organization_id?: string | null
          outlet_id?: string | null
          pending_count?: number | null
          since_last_sync?: never
        }
        Relationships: [
          {
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_product_stock"
            referencedColumns: ["outlet_id"]
          },
        ]
      }
    }
    Functions: {
      _apply_transaction: {
        Args: {
          p_cashier: string
          p_org: string
          p_origin: Database["public"]["Enums"]["trx_origin"]
          p_trx: Json
        }
        Returns: Json
      }
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      adjust_stock: {
        Args: {
          p_new_qty: number
          p_note?: string
          p_org: string
          p_outlet: string
          p_product: string
          p_type?: Database["public"]["Enums"]["stock_move_type"]
        }
        Returns: Json
      }
      can_manage: { Args: { p_org: string }; Returns: boolean }
      can_read_org: { Args: { p_org: string }; Returns: boolean }
      client_quotas: {
        Args: never
        Returns: {
          max_devices: number
          max_outlets: number
          max_products: number
          max_users: number
          organization_id: string
          used_devices: number
          used_outlets: number
          used_products: number
          used_users: number
        }[]
      }
      close_shift: {
        Args: { p_closing_cash: number; p_note?: string; p_shift: string }
        Returns: Json
      }
      create_outlet: { Args: { p_org: string; p_payload: Json }; Returns: Json }
      create_purchase: {
        Args: { p_org: string; p_payload: Json }
        Returns: Json
      }
      create_transaction: {
        Args: { p_org: string; p_trx: Json }
        Returns: Json
      }
      end_consignment: {
        Args: { p_consignment: string; p_org: string }
        Returns: Json
      }
      invitation_preview: { Args: { p_token: string }; Returns: Json }
      is_platform_admin: { Args: never; Returns: boolean }
      open_shift: {
        Args: {
          p_device: string
          p_opening_cash?: number
          p_org: string
          p_outlet: string
        }
        Returns: string
      }
      org_is_active: { Args: { p_org: string }; Returns: boolean }
      org_lapsed_at: { Args: { p_org: string }; Returns: string }
      org_quota: { Args: { p_key: string; p_org: string }; Returns: number }
      org_usage: { Args: { p_key: string; p_org: string }; Returns: number }
      provision_organization: {
        Args: {
          p_city: string
          p_name: string
          p_owner: string
          p_plan_code?: string
        }
        Returns: string
      }
      pull_catalog: {
        Args: { p_org: string; p_outlet: string; p_since?: string }
        Returns: Json
      }
      record_consignment_intake: {
        Args: { p_org: string; p_payload: Json }
        Returns: Json
      }
      record_consignment_return: {
        Args: { p_org: string; p_payload: Json }
        Returns: Json
      }
      register_store: {
        Args: { p_city?: string; p_name: string }
        Returns: Json
      }
      set_member_pin: {
        Args: { p_member: string; p_pin: string }
        Returns: undefined
      }
      set_primary_outlet: {
        Args: { p_org: string; p_outlet: string }
        Returns: Json
      }
      settle_consignment: {
        Args: { p_org: string; p_payload: Json }
        Returns: Json
      }
      sync_transactions: {
        Args: {
          p_app_ver?: string
          p_batch: Json
          p_device: string
          p_org: string
        }
        Returns: Json
      }
      transfer_stock: {
        Args: { p_org: string; p_payload: Json }
        Returns: Json
      }
      user_can: { Args: { p_org: string; p_perm: string }; Returns: boolean }
      user_managed_org_ids: { Args: never; Returns: string[] }
      user_org_ids: { Args: never; Returns: string[] }
      user_role_in: {
        Args: { p_org: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
      verify_member_pin: {
        Args: { p_member: string; p_pin: string }
        Returns: boolean
      }
      void_transaction: {
        Args: { p_reason: string; p_trx_id: string }
        Returns: Json
      }
    }
    Enums: {
      member_role: "owner" | "admin" | "cashier"
      member_status: "invited" | "active" | "disabled"
      org_status: "trial" | "active" | "suspended" | "inactive"
      payment_method: "cash" | "qris" | "transfer" | "card" | "other"
      purchase_payment: "paid" | "credit"
      shift_status: "open" | "closed"
      stock_move_type:
        | "initial"
        | "purchase"
        | "sale"
        | "return"
        | "adjustment"
        | "opname"
        | "transfer_in"
        | "transfer_out"
        | "sync_correction"
        | "consign_in"
        | "consign_return"
      subscription_action:
        | "subscribe"
        | "upgrade"
        | "downgrade"
        | "renew"
        | "cancel"
        | "reactivate"
      trx_origin: "online" | "offline"
      trx_status: "paid" | "void" | "refunded"
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
    Enums: {
      member_role: ["owner", "admin", "cashier"],
      member_status: ["invited", "active", "disabled"],
      org_status: ["trial", "active", "suspended", "inactive"],
      payment_method: ["cash", "qris", "transfer", "card", "other"],
      purchase_payment: ["paid", "credit"],
      shift_status: ["open", "closed"],
      stock_move_type: [
        "initial",
        "purchase",
        "sale",
        "return",
        "adjustment",
        "opname",
        "transfer_in",
        "transfer_out",
        "sync_correction",
        "consign_in",
        "consign_return",
      ],
      subscription_action: [
        "subscribe",
        "upgrade",
        "downgrade",
        "renew",
        "cancel",
        "reactivate",
      ],
      trx_origin: ["online", "offline"],
      trx_status: ["paid", "void", "refunded"],
    },
  },
} as const
