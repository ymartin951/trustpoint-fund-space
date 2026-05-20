'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PiggyBank, Plus, Calendar, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getSavingsPlanBalance } from '@/lib/wallet';
import { format } from 'date-fns';

export default function SavingsPlansPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadPlans();
    }
  }, [profile]);

  const loadPlans = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('savings_plans')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const plansData = data || [];
      setPlans(plansData);

      const balancePromises = plansData.map((plan) =>
        getSavingsPlanBalance(plan.id)
      );
      const balanceResults = await Promise.all(balancePromises);

      const balanceMap: Record<string, number> = {};
      plansData.forEach((plan, index) => {
        balanceMap[plan.id] = balanceResults[index];
      });
      setBalances(balanceMap);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `GH₵ ${amount.toFixed(2)}`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PERSONAL':
        return 'bg-blue-100 text-blue-700';
      case 'BUSINESS':
        return 'bg-green-100 text-green-700';
      case 'LOCKED':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-700';
      case 'COMPLETED':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Savings Plans</h1>
          <p className="text-slate-600 mt-1">Manage your savings goals</p>
        </div>
        <Link href="/dashboard/savings/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Plan
          </Button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <Card className="border-none shadow-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <PiggyBank className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Savings Plans Yet
              </h3>
              <p className="text-slate-600 mb-6">
                Create your first savings plan to start reaching your financial goals
              </p>
              <Link href="/dashboard/savings/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Plan
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const balance = balances[plan.id] || 0;
            const progress = plan.target_amount
              ? (balance / Number(plan.target_amount)) * 100
              : 0;

            return (
              <Card key={plan.id} className="border-none shadow-lg hover:shadow-xl transition">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{plan.name}</CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        <Badge className={getTypeColor(plan.type)}>
                          {plan.type}
                        </Badge>
                        <Badge className={getStatusColor(plan.status)}>
                          {plan.status}
                        </Badge>
                      </div>
                    </div>
                    <PiggyBank className="h-8 w-8 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Current Balance</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(balance)}
                      </p>
                    </div>

                    {plan.target_amount && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            Target
                          </p>
                          <p className="text-sm font-medium">
                            {formatCurrency(Number(plan.target_amount))}
                          </p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {progress.toFixed(1)}% achieved
                        </p>
                      </div>
                    )}

                    {plan.unlock_date && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="h-4 w-4" />
                        <span>Unlocks: {format(new Date(plan.unlock_date), 'PP')}</span>
                      </div>
                    )}

                    <p className="text-xs text-slate-500">
                      Created {format(new Date(plan.created_at), 'PP')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
