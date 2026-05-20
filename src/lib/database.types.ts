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
      agent_customers: {
        Row: {
          agent_id: string
          created_at: string | null
          customer_id: string
          id: string
          notes: string | null
          relationship_status: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          relationship_status?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          relationship_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_customers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_customers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agent_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
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
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fund_space_contributions: {
        Row: {
          amount_due: number
          amount_paid: number
          confirmed_by: string | null
          created_at: string | null
          fund_space_id: string
          id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          round_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          confirmed_by?: string | null
          created_at?: string | null
          fund_space_id: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          round_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          confirmed_by?: string | null
          created_at?: string | null
          fund_space_id?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          round_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_space_contributions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_contributions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_contributions_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_contributions_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_contributions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fund_space_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fund_space_disputes: {
        Row: {
          created_at: string | null
          fund_space_id: string | null
          id: string
          message: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          round_id: string | null
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fund_space_id?: string | null
          id?: string
          message: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round_id?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fund_space_id?: string | null
          id?: string
          message?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round_id?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_space_disputes_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_disputes_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_disputes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fund_space_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_disputes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_disputes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fund_space_members: {
        Row: {
          contribution_amount: number
          fund_space_id: string
          has_received_payout: boolean
          id: string
          joined_at: string | null
          joined_by_agent: string | null
          payout_order: number | null
          position_number: number | null
          received_round_number: number | null
          status: string
          user_id: string
        }
        Insert: {
          contribution_amount: number
          fund_space_id: string
          has_received_payout?: boolean
          id?: string
          joined_at?: string | null
          joined_by_agent?: string | null
          payout_order?: number | null
          position_number?: number | null
          received_round_number?: number | null
          status?: string
          user_id: string
        }
        Update: {
          contribution_amount?: number
          fund_space_id?: string
          has_received_payout?: boolean
          id?: string
          joined_at?: string | null
          joined_by_agent?: string | null
          payout_order?: number | null
          position_number?: number | null
          received_round_number?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_space_members_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_members_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_members_joined_by_agent_fkey"
            columns: ["joined_by_agent"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_members_joined_by_agent_fkey"
            columns: ["joined_by_agent"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fund_space_payouts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          failure_reason: string | null
          fund_space_id: string
          gross_amount: number
          id: string
          net_amount: number
          paid_at: string | null
          paid_by: string | null
          payout_method: string | null
          payout_reference: string | null
          platform_fee: number
          recipient_user_id: string
          rejection_reason: string | null
          round_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          failure_reason?: string | null
          fund_space_id: string
          gross_amount: number
          id?: string
          net_amount: number
          paid_at?: string | null
          paid_by?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          platform_fee?: number
          recipient_user_id: string
          rejection_reason?: string | null
          round_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          failure_reason?: string | null
          fund_space_id?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          paid_by?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          platform_fee?: number
          recipient_user_id?: string
          rejection_reason?: string | null
          round_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_space_payouts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_payouts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_payouts_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_payouts_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_payouts_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_payouts_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_payouts_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_payouts_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_payouts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "fund_space_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_space_penalties: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          fund_space_id: string | null
          id: string
          penalty_type: string
          resolved_at: string | null
          round_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fund_space_id?: string | null
          id?: string
          penalty_type: string
          resolved_at?: string | null
          round_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fund_space_id?: string | null
          id?: string
          penalty_type?: string
          resolved_at?: string | null
          round_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_space_penalties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_penalties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_penalties_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_penalties_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_penalties_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fund_space_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_penalties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_penalties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fund_space_plans: {
        Row: {
          contribution_amount: number
          created_at: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          member_limit: number
          min_trust_score: number
          minimum_completed_cycles: number
          name: string
          updated_at: string | null
        }
        Insert: {
          contribution_amount: number
          created_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          member_limit?: number
          min_trust_score?: number
          minimum_completed_cycles?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          contribution_amount?: number
          created_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          member_limit?: number
          min_trust_score?: number
          minimum_completed_cycles?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fund_space_rounds: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          contribution_amount: number
          contribution_deadline: string
          created_at: string | null
          expected_total_amount: number
          fund_space_id: string
          id: string
          recipient_user_id: string
          round_number: number
          status: string
          updated_at: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          contribution_amount: number
          contribution_deadline: string
          created_at?: string | null
          expected_total_amount: number
          fund_space_id: string
          id?: string
          recipient_user_id: string
          round_number: number
          status?: string
          updated_at?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          contribution_amount?: number
          contribution_deadline?: string
          created_at?: string | null
          expected_total_amount?: number
          fund_space_id?: string
          id?: string
          recipient_user_id?: string
          round_number?: number
          status?: string
          updated_at?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_space_rounds_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_rounds_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_space_rounds_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_rounds_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_rounds_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_rounds_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fund_spaces: {
        Row: {
          completed_at: string | null
          contribution_amount: number
          created_at: string | null
          created_by: string | null
          current_round_number: number
          frequency: string
          id: string
          member_limit: number
          name: string
          plan_id: string | null
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          contribution_amount: number
          created_at?: string | null
          created_by?: string | null
          current_round_number?: number
          frequency?: string
          id?: string
          member_limit?: number
          name: string
          plan_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          contribution_amount?: number
          created_at?: string | null
          created_by?: string | null
          current_round_number?: number
          frequency?: string
          id?: string
          member_limit?: number
          name?: string
          plan_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_spaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_spaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fund_spaces_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "fund_space_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          member_role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          member_role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          member_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      groups: {
        Row: {
          contribution_amount: number
          created_at: string | null
          created_by: string
          frequency: string
          id: string
          name: string
          rules_text: string | null
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          contribution_amount: number
          created_at?: string | null
          created_by: string
          frequency: string
          id?: string
          name: string
          rules_text?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          contribution_amount?: number
          created_at?: string | null
          created_by?: string
          frequency?: string
          id?: string
          name?: string
          rules_text?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          dedupe_key: string | null
          id: string
          is_read: boolean
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          access_code: string | null
          agent_id: string | null
          amount: number
          channel: string
          checkout_url: string | null
          contribution_id: string | null
          created_at: string | null
          currency: string
          customer_id: string | null
          direction: string
          failure_reason: string | null
          fee_amount: number | null
          fund_space_id: string | null
          fund_space_round_id: string | null
          id: string
          initiated_by: string | null
          internal_reference: string
          metadata: Json | null
          mobile_network: string | null
          net_amount: number | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_type: string
          payout_id: string | null
          processed_at: string | null
          provider: string
          provider_amount: number | null
          provider_reference: string | null
          provider_response: Json | null
          provider_status: string | null
          provider_transaction_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          verified_at: string | null
          wallet_id: string | null
          withdrawal_request_id: string | null
        }
        Insert: {
          access_code?: string | null
          agent_id?: string | null
          amount: number
          channel: string
          checkout_url?: string | null
          contribution_id?: string | null
          created_at?: string | null
          currency?: string
          customer_id?: string | null
          direction: string
          failure_reason?: string | null
          fee_amount?: number | null
          fund_space_id?: string | null
          fund_space_round_id?: string | null
          id?: string
          initiated_by?: string | null
          internal_reference: string
          metadata?: Json | null
          mobile_network?: string | null
          net_amount?: number | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_type: string
          payout_id?: string | null
          processed_at?: string | null
          provider: string
          provider_amount?: number | null
          provider_reference?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          provider_transaction_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          wallet_id?: string | null
          withdrawal_request_id?: string | null
        }
        Update: {
          access_code?: string | null
          agent_id?: string | null
          amount?: number
          channel?: string
          checkout_url?: string | null
          contribution_id?: string | null
          created_at?: string | null
          currency?: string
          customer_id?: string | null
          direction?: string
          failure_reason?: string | null
          fee_amount?: number | null
          fund_space_id?: string | null
          fund_space_round_id?: string | null
          id?: string
          initiated_by?: string | null
          internal_reference?: string
          metadata?: Json | null
          mobile_network?: string | null
          net_amount?: number | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_type?: string
          payout_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_amount?: number | null
          provider_reference?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          provider_transaction_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          wallet_id?: string | null
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_transactions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "fund_space_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_transactions_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_fund_space_round_id_fkey"
            columns: ["fund_space_round_id"]
            isOneToOne: false
            referencedRelation: "fund_space_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "fund_space_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string | null
          event_id: string | null
          event_type: string
          id: string
          payload: Json
          payment_transaction_id: string | null
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_reference: string | null
          signature_valid: boolean | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload?: Json
          payment_transaction_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_reference?: string | null
          signature_valid?: boolean | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_transaction_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_reference?: string | null
          signature_valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          blacklist_reason: string | null
          business_location: string | null
          business_name: string | null
          business_type: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employer_name: string | null
          full_name: string
          gender: string | null
          ghana_card: string | null
          ghana_card_verified: boolean | null
          has_received_payout_before: boolean
          id: string
          id_document_back_url: string | null
          id_document_front_url: string | null
          id_number: string | null
          id_type: string | null
          is_blacklisted: boolean
          location: string | null
          missed_payment_count: number
          momo_number: string | null
          occupation: string | null
          phone: string | null
          region: string | null
          registered_by_agent: string | null
          role: string
          selfie_url: string | null
          staff_id: string | null
          status: string
          successful_cycles_count: number
          terms_accepted: boolean
          terms_accepted_at: string | null
          trust_score: number
          updated_at: string | null
          user_category: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          blacklist_reason?: string | null
          business_location?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employer_name?: string | null
          full_name?: string
          gender?: string | null
          ghana_card?: string | null
          ghana_card_verified?: boolean | null
          has_received_payout_before?: boolean
          id: string
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          is_blacklisted?: boolean
          location?: string | null
          missed_payment_count?: number
          momo_number?: string | null
          occupation?: string | null
          phone?: string | null
          region?: string | null
          registered_by_agent?: string | null
          role?: string
          selfie_url?: string | null
          staff_id?: string | null
          status?: string
          successful_cycles_count?: number
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          trust_score?: number
          updated_at?: string | null
          user_category?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          blacklist_reason?: string | null
          business_location?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employer_name?: string | null
          full_name?: string
          gender?: string | null
          ghana_card?: string | null
          ghana_card_verified?: boolean | null
          has_received_payout_before?: boolean
          id?: string
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          is_blacklisted?: boolean
          location?: string | null
          missed_payment_count?: number
          momo_number?: string | null
          occupation?: string | null
          phone?: string | null
          region?: string | null
          registered_by_agent?: string | null
          role?: string
          selfie_url?: string | null
          staff_id?: string | null
          status?: string
          successful_cycles_count?: number
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          trust_score?: number
          updated_at?: string | null
          user_category?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_registered_by_agent_fkey"
            columns: ["registered_by_agent"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_registered_by_agent_fkey"
            columns: ["registered_by_agent"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      savings_plans: {
        Row: {
          created_at: string | null
          current_amount: number
          id: string
          name: string
          status: string
          target_amount: number | null
          type: string
          unlock_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_amount?: number
          id?: string
          name: string
          status?: string
          target_amount?: number | null
          type: string
          unlock_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_amount?: number
          id?: string
          name?: string
          status?: string
          target_amount?: number | null
          type?: string
          unlock_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      support_messages: {
        Row: {
          admin_note: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          phone: string | null
          status: string
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          phone?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          phone?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          channel: string
          contribution_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          direction: string
          fund_space_id: string | null
          fund_space_round_id: string | null
          group_id: string | null
          id: string
          metadata: Json | null
          note: string | null
          payment_reference: string | null
          payout_id: string | null
          savings_plan_id: string | null
          status: string
          type: string
          user_id: string
          wallet_id: string | null
          withdrawal_request_id: string | null
        }
        Insert: {
          amount: number
          channel: string
          contribution_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          direction: string
          fund_space_id?: string | null
          fund_space_round_id?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
          note?: string | null
          payment_reference?: string | null
          payout_id?: string | null
          savings_plan_id?: string | null
          status?: string
          type: string
          user_id: string
          wallet_id?: string | null
          withdrawal_request_id?: string | null
        }
        Update: {
          amount?: number
          channel?: string
          contribution_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          direction?: string
          fund_space_id?: string | null
          fund_space_round_id?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
          note?: string | null
          payment_reference?: string | null
          payout_id?: string | null
          savings_plan_id?: string | null
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string | null
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "fund_space_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_fund_space_round_id_fkey"
            columns: ["fund_space_round_id"]
            isOneToOne: false
            referencedRelation: "fund_space_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "fund_space_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_savings_plan_id_fkey"
            columns: ["savings_plan_id"]
            isOneToOne: false
            referencedRelation: "savings_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_withdrawal_request_fk"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          business_location: string | null
          business_name: string | null
          business_proof_url: string | null
          business_type: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          employer_name: string | null
          employment_proof_url: string | null
          full_name: string
          gender: string | null
          ghana_card_back_url: string | null
          ghana_card_front_url: string | null
          ghana_card_number: string
          id: string
          location: string | null
          momo_number: string | null
          occupation: string | null
          phone: string
          region: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          staff_id: string | null
          status: string
          submitted_by_agent: string | null
          updated_at: string | null
          user_category: string
          user_id: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_location?: string | null
          business_name?: string | null
          business_proof_url?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          employer_name?: string | null
          employment_proof_url?: string | null
          full_name: string
          gender?: string | null
          ghana_card_back_url?: string | null
          ghana_card_front_url?: string | null
          ghana_card_number: string
          id?: string
          location?: string | null
          momo_number?: string | null
          occupation?: string | null
          phone: string
          region?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          staff_id?: string | null
          status?: string
          submitted_by_agent?: string | null
          updated_at?: string | null
          user_category: string
          user_id: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_location?: string | null
          business_name?: string | null
          business_proof_url?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string
          emergency_contact_phone?: string
          employer_name?: string | null
          employment_proof_url?: string | null
          full_name?: string
          gender?: string | null
          ghana_card_back_url?: string | null
          ghana_card_front_url?: string | null
          ghana_card_number?: string
          id?: string
          location?: string | null
          momo_number?: string | null
          occupation?: string | null
          phone?: string
          region?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          staff_id?: string | null
          status?: string
          submitted_by_agent?: string | null
          updated_at?: string | null
          user_category?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "verification_requests_submitted_by_agent_fkey"
            columns: ["submitted_by_agent"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_submitted_by_agent_fkey"
            columns: ["submitted_by_agent"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_accounts: {
        Row: {
          available_balance: number
          created_at: string | null
          currency: string
          id: string
          locked_balance: number
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string | null
          currency?: string
          id?: string
          locked_balance?: number
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string | null
          currency?: string
          id?: string
          locked_balance?: number
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          created_by: string | null
          description: string
          direction: string
          id: string
          metadata: Json | null
          payment_transaction_id: string | null
          source_type: string
          transaction_id: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          created_by?: string | null
          description: string
          direction: string
          id?: string
          metadata?: Json | null
          payment_transaction_id?: string | null
          source_type: string
          transaction_id?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          created_by?: string | null
          description?: string
          direction?: string
          id?: string
          metadata?: Json | null
          payment_transaction_id?: string | null
          source_type?: string
          transaction_id?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_ledger_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_ledger_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string | null
          id: string
          momo_number: string | null
          paid_at: string | null
          paid_by: string | null
          payment_reference: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          user_id: string
          withdrawal_method: string
        }
        Insert: {
          amount: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          momo_number?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          withdrawal_method?: string
        }
        Update: {
          amount?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          momo_number?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          withdrawal_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      admin_fund_space_overview: {
        Row: {
          contribution_amount: number | null
          created_at: string | null
          current_round_number: number | null
          defaulted_members: number | null
          id: string | null
          member_count: number | null
          member_limit: number | null
          members_paid_out: number | null
          name: string | null
          start_date: string | null
          status: string | null
        }
        Relationships: []
      }
      fund_space_member_dashboard: {
        Row: {
          contribution_amount: number | null
          current_round_deadline: string | null
          current_round_number: number | null
          fund_space_id: string | null
          fund_space_name: string | null
          fund_space_status: string | null
          has_received_payout: boolean | null
          member_limit: number | null
          member_status: string | null
          membership_id: string | null
          my_payout_round: number | null
          my_payout_week_start_date: string | null
          payout_order: number | null
          position_number: number | null
          received_round_number: number | null
          start_date: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_space_members_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "admin_fund_space_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_members_fund_space_id_fkey"
            columns: ["fund_space_id"]
            isOneToOne: false
            referencedRelation: "fund_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_wallet_balances"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_wallet_balances: {
        Row: {
          available_balance: number | null
          currency: string | null
          full_name: string | null
          locked_balance: number | null
          phone: string | null
          role: string | null
          user_id: string | null
          verification_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_fund_space: { Args: { p_fund_space_id: string }; Returns: Json }
      approve_fund_space_payout: {
        Args: { p_payout_id: string }
        Returns: Json
      }
      approve_verification_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approve_withdrawal_request: {
        Args: { p_withdrawal_id: string }
        Returns: Json
      }
      check_round_ready_for_payout: {
        Args: { p_round_id: string }
        Returns: Json
      }
      confirm_fund_space_contribution: {
        Args: {
          p_amount: number
          p_contribution_id: string
          p_payment_method: string
          p_payment_reference?: string
        }
        Returns: Json
      }
      create_contributions_for_round: {
        Args: { p_fund_space_id: string; p_round_number: number }
        Returns: Json
      }
      create_deduped_notification: {
        Args: {
          p_dedupe_key?: string
          p_message: string
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      create_user_wallet_if_missing: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      current_user_role: { Args: { user_id?: string }; Returns: string }
      generate_payment_reference: {
        Args: { p_prefix?: string }
        Returns: string
      }
      get_payment_transaction_by_reference: {
        Args: { p_provider?: string; p_reference: string }
        Returns: Json
      }
      get_wallet_balance: { Args: { p_user_id?: string }; Returns: Json }
      is_admin_or_super_admin: { Args: { user_id?: string }; Returns: boolean }
      is_agent: { Args: { user_id?: string }; Returns: boolean }
      is_fund_space_member: {
        Args: { p_fund_space_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_super_admin: { Args: { user_id?: string }; Returns: boolean }
      is_verified_member: { Args: { user_id?: string }; Returns: boolean }
      join_fund_space: {
        Args: {
          p_contribution_amount: number
          p_joined_by_agent?: string
          p_user_id?: string
        }
        Returns: Json
      }
      mark_fund_space_payout_paid: {
        Args: {
          p_payout_id: string
          p_payout_method: string
          p_payout_reference?: string
        }
        Returns: Json
      }
      mark_overdue_fund_space_contributions: { Args: never; Returns: Json }
      mark_withdrawal_paid: {
        Args: { p_payment_reference?: string; p_withdrawal_id: string }
        Returns: Json
      }
      next_monday_from: { Args: { p_date?: string }; Returns: string }
      process_failed_payment_transaction: {
        Args: {
          p_failure_reason?: string
          p_payment_transaction_id: string
          p_provider_reference?: string
          p_provider_response?: Json
          p_provider_status?: string
        }
        Returns: Json
      }
      process_successful_fund_space_contribution_payment: {
        Args: {
          p_payment_transaction_id: string
          p_provider_reference?: string
          p_provider_response?: Json
          p_provider_status?: string
          p_provider_transaction_id?: string
        }
        Returns: Json
      }
      process_successful_wallet_deposit: {
        Args: {
          p_payment_transaction_id: string
          p_provider_reference?: string
          p_provider_response?: Json
          p_provider_status?: string
          p_provider_transaction_id?: string
        }
        Returns: Json
      }
      reject_fund_space_payout: {
        Args: { p_payout_id: string; p_reason: string }
        Returns: Json
      }
      reject_verification_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: Json
      }
      reject_withdrawal_request: {
        Args: { p_reason: string; p_withdrawal_id: string }
        Returns: Json
      }
      request_withdrawal: {
        Args: {
          p_amount: number
          p_bank_name?: string
          p_momo_number?: string
          p_withdrawal_method?: string
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
