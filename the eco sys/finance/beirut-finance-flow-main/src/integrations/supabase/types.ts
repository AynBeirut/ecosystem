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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_settings: {
        Row: {
          base_currency: string
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          is_default: boolean | null
          label: string | null
          rate: number
          to_currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          effective_date?: string
          from_currency: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          rate: number
          to_currency: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          rate?: number
          to_currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estimate_items: {
        Row: {
          created_at: string
          description: string | null
          estimate_id: string
          id: string
          name: string
          organization_id: string
          product_id: string | null
          quantity: number
          raw_cost: number | null
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimate_id: string
          id?: string
          name: string
          organization_id: string
          product_id?: string | null
          quantity?: number
          raw_cost?: number | null
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          estimate_id?: string
          id?: string
          name?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number
          raw_cost?: number | null
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          amount: number
          client_id: string | null
          client_name: string
          created_at: string
          currency: string
          date: string
          expiry_date: string | null
          id: string
          items: Json
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          date?: string
          expiry_date?: string | null
          id?: string
          items?: Json
          notes?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          date?: string
          expiry_date?: string | null
          id?: string
          items?: Json
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          expense_date: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          receipt_url: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          receipt_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          organization_id: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          organization_id: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          name: string
          organization_id: string
          product_id: string | null
          quantity: number
          raw_cost: number | null
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          name: string
          organization_id: string
          product_id?: string | null
          quantity?: number
          raw_cost?: number | null
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          name?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number
          raw_cost?: number | null
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          client_name: string
          created_at: string
          currency: string
          date: string
          discount: number | null
          id: string
          items: Json
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_reference: string | null
          payment_verified: boolean
          status: string
          tax: number | null
          template: string | null
          total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          date?: string
          discount?: number | null
          id?: string
          items?: Json
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_verified?: boolean
          status?: string
          tax?: number | null
          template?: string | null
          total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          date?: string
          discount?: number | null
          id?: string
          items?: Json
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_verified?: boolean
          status?: string
          tax?: number | null
          template?: string | null
          total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          currency: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          plan: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          plan?: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_audit_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          invoice_id: string | null
          organization_id: string | null
          payload: Json
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          invoice_id?: string | null
          organization_id?: string | null
          payload?: Json
          provider: string
          status: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          invoice_id?: string | null
          organization_id?: string | null
          payload?: Json
          provider?: string
          status?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          organization_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          organization_id: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          organization_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          components: Json | null
          created_at: string
          description: string | null
          id: string
          low_stock_alert: number | null
          name: string
          organization_id: string
          raw_price: number | null
          sale_price: number
          service_cost: number | null
          sku: string | null
          stock_quantity: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          components?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          low_stock_alert?: number | null
          name: string
          organization_id: string
          raw_price?: number | null
          sale_price?: number
          service_cost?: number | null
          sku?: string | null
          stock_quantity?: number | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          components?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          low_stock_alert?: number | null
          name?: string
          organization_id?: string
          raw_price?: number | null
          sale_price?: number
          service_cost?: number | null
          sku?: string | null
          stock_quantity?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          budget_currency: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          budget_currency?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          budget_currency?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          client_id: string | null
          client_name: string | null
          converted_invoice_id: string | null
          created_at: string
          currency: string | null
          deliverables: Json | null
          estimated_value: number | null
          id: string
          organization_id: string
          project_id: string | null
          rfp_text: string | null
          scope_summary: string | null
          status: string
          submitted_at: string | null
          technical_response: string | null
          timeline: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          currency?: string | null
          deliverables?: Json | null
          estimated_value?: number | null
          id?: string
          organization_id: string
          project_id?: string | null
          rfp_text?: string | null
          scope_summary?: string | null
          status?: string
          submitted_at?: string | null
          technical_response?: string | null
          timeline?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          currency?: string | null
          deliverables?: Json | null
          estimated_value?: number | null
          id?: string
          organization_id?: string
          project_id?: string | null
          rfp_text?: string | null
          scope_summary?: string | null
          status?: string
          submitted_at?: string | null
          technical_response?: string | null
          timeline?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      psa_audit_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          invoice_id: string | null
          organization_id: string
          status: string
          timesheet_ids: string[]
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          organization_id: string
          status: string
          timesheet_ids?: string[]
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          organization_id?: string
          status?: string
          timesheet_ids?: string[]
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          date: string
          id: string
          items: Json
          notes: string | null
          organization_id: string
          status: string
          supplier_id: string | null
          supplier_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          date?: string
          id?: string
          items?: Json
          notes?: string | null
          organization_id: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          date?: string
          id?: string
          items?: Json
          notes?: string | null
          organization_id?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          client_name: string
          created_at: string
          currency: string
          date: string
          id: string
          items: Json | null
          notes: string | null
          organization_id: string
          payment_date: string | null
          payment_method: string | null
          updated_at: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          items?: Json | null
          notes?: string | null
          organization_id: string
          payment_date?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          items?: Json | null
          notes?: string | null
          organization_id?: string
          payment_date?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_name: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          is_milestone: boolean | null
          linked_invoice_id: string | null
          milestone_label: string | null
          organization_id: string
          priority: string | null
          project_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_name?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_milestone?: boolean | null
          linked_invoice_id?: string | null
          milestone_label?: string | null
          organization_id: string
          priority?: string | null
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_name?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_milestone?: boolean | null
          linked_invoice_id?: string | null
          milestone_label?: string | null
          organization_id?: string
          priority?: string | null
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          created_at: string
          description: string | null
          hours: number
          id: string
          invoice_id: string | null
          invoiced: boolean | null
          is_billable: boolean | null
          needs_sync: boolean
          organization_id: string
          project_id: string | null
          rate: number
          rate_currency: string | null
          staff_id: string
          staff_name: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          is_billable?: boolean | null
          needs_sync?: boolean
          organization_id: string
          project_id?: string | null
          rate: number
          rate_currency?: string | null
          staff_id: string
          staff_name: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          invoice_id?: string | null
          invoiced?: boolean | null
          is_billable?: boolean | null
          needs_sync?: boolean
          organization_id?: string
          project_id?: string | null
          rate?: number
          rate_currency?: string | null
          staff_id?: string
          staff_name?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_backups: {
        Row: {
          created_at: string
          encrypted_data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_data: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_data?: Json
          id?: string
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
      bootstrap_organization: {
        Args: { _name?: string }
        Returns: {
          address: string
          currency: string
          email: string
          id: string
          logo_url: string
          name: string
          phone: string
          plan: string
          tax_id: string
        }[]
      }
      has_permission: {
        Args: { _action: string; _org_id: string }
        Returns: boolean
      }
      is_org_owner: { Args: { _org_id: string }; Returns: boolean }
      lookup_user_id_by_email: { Args: { _email: string }; Returns: string }
      org_seat_limit: { Args: { _plan: string }; Returns: number }
      user_has_org_role: {
        Args: { _org_id: string; _roles: string[] }
        Returns: boolean
      }
      user_org_ids: { Args: never; Returns: string[] }
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
