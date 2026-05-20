export type UserRole = 'USER' | 'GROUP_ADMIN' | 'AGENT' | 'SUPER_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type SavingsPlanType = 'PERSONAL' | 'BUSINESS' | 'LOCKED';
export type SavingsPlanStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type GroupStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED';
export type GroupFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type MemberRole = 'MEMBER' | 'GROUP_ADMIN';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'FEE_ADJUSTMENT';
export type TransactionChannel = 'USER_ENTRY' | 'AGENT_ENTRY' | 'MOMO';
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  location: string | null;
  business_type: string | null;
  ghana_card: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface SavingsPlan {
  id: string;
  user_id: string;
  type: SavingsPlanType;
  name: string;
  target_amount: number | null;
  unlock_date: string | null;
  status: SavingsPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  created_by: string;
  name: string;
  contribution_amount: number;
  frequency: GroupFrequency;
  start_date: string;
  rules_text: string | null;
  status: GroupStatus;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  member_role: MemberRole;
  joined_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  group_id: string | null;
  savings_plan_id: string | null;
  type: TransactionType;
  amount: number;
  channel: TransactionChannel;
  created_by: string;
  note: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  momo_number: string;
  status: WithdrawalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      savings_plans: {
        Row: SavingsPlan;
        Insert: Omit<SavingsPlan, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SavingsPlan, 'id' | 'created_at' | 'updated_at'>>;
      };
      groups: {
        Row: Group;
        Insert: Omit<Group, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Group, 'id' | 'created_at' | 'updated_at'>>;
      };
      group_members: {
        Row: GroupMember;
        Insert: Omit<GroupMember, 'id' | 'joined_at'>;
        Update: Partial<Omit<GroupMember, 'id' | 'joined_at'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at'>;
        Update: never;
      };
      withdrawal_requests: {
        Row: WithdrawalRequest;
        Insert: Omit<WithdrawalRequest, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<WithdrawalRequest, 'id' | 'created_at' | 'updated_at'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: never;
      };
    };
  };
}
