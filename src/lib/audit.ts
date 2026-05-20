import { supabase } from './supabase/client';

export async function createAuditLog(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any> = {}
) {
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });

  if (error) {
    console.error('Failed to create audit log:', error);
  }
}

export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  DEPOSIT_CREATED: 'DEPOSIT_CREATED',
  WITHDRAWAL_REQUESTED: 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_APPROVED: 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED',
  WITHDRAWAL_PAID: 'WITHDRAWAL_PAID',
  SAVINGS_PLAN_CREATED: 'SAVINGS_PLAN_CREATED',
  SAVINGS_PLAN_UPDATED: 'SAVINGS_PLAN_UPDATED',
  GROUP_CREATED: 'GROUP_CREATED',
  GROUP_UPDATED: 'GROUP_UPDATED',
  GROUP_MEMBER_ADDED: 'GROUP_MEMBER_ADDED',
  GROUP_MEMBER_REMOVED: 'GROUP_MEMBER_REMOVED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_ACTIVATED: 'USER_ACTIVATED',
} as const;

export const ENTITY_TYPES = {
  USER: 'USER',
  PROFILE: 'PROFILE',
  TRANSACTION: 'TRANSACTION',
  WITHDRAWAL_REQUEST: 'WITHDRAWAL_REQUEST',
  SAVINGS_PLAN: 'SAVINGS_PLAN',
  GROUP: 'GROUP',
  GROUP_MEMBER: 'GROUP_MEMBER',
} as const;
