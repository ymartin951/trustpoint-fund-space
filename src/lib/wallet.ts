import { supabase } from './supabase/client';

export const WITHDRAWAL_FEE_PERCENTAGE = 0.01;

export async function calculateWalletBalance(userId: string): Promise<number> {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId);

  if (error || !transactions) {
    return 0;
  }

  let balance = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'DEPOSIT') {
      balance += Number(transaction.amount);
    } else if (transaction.type === 'WITHDRAWAL' || transaction.type === 'FEE_ADJUSTMENT') {
      balance -= Number(transaction.amount);
    }
  }

  return balance;
}

export async function getPendingWithdrawals(userId: string): Promise<number> {
  const { data: withdrawals, error } = await supabase
    .from('withdrawal_requests')
    .select('amount')
    .eq('user_id', userId)
    .in('status', ['PENDING', 'APPROVED']);

  if (error || !withdrawals) {
    return 0;
  }

  return withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
}

export async function getAvailableBalance(userId: string): Promise<number> {
  const balance = await calculateWalletBalance(userId);
  const pending = await getPendingWithdrawals(userId);
  return Math.max(0, balance - pending);
}

export function calculateWithdrawalFee(amount: number): number {
  return amount * WITHDRAWAL_FEE_PERCENTAGE;
}

export function calculateNetWithdrawal(amount: number): number {
  return amount - calculateWithdrawalFee(amount);
}

export async function getUserTransactions(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      created_by_profile:profiles!transactions_created_by_fkey(full_name),
      group:groups(name),
      savings_plan:savings_plans(name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { data, error };
}

export async function getSavingsPlanBalance(planId: string): Promise<number> {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('savings_plan_id', planId);

  if (error || !transactions) {
    return 0;
  }

  let balance = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'DEPOSIT') {
      balance += Number(transaction.amount);
    }
  }

  return balance;
}

export async function getGroupBalance(groupId: string): Promise<number> {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('group_id', groupId);

  if (error || !transactions) {
    return 0;
  }

  let balance = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'DEPOSIT') {
      balance += Number(transaction.amount);
    }
  }

  return balance;
}
