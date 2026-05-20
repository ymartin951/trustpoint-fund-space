'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { createAuditLog, AUDIT_ACTIONS, ENTITY_TYPES } from '@/lib/audit';
import { PiggyBank } from 'lucide-react';

export default function CreateSavingsPlanPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<'PERSONAL' | 'BUSINESS' | 'LOCKED'>('PERSONAL');
  const [targetAmount, setTargetAmount] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (type === 'LOCKED' && !unlockDate) {
      toast({
        title: 'Error',
        description: 'Locked savings require an unlock date',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('savings_plans')
        .insert({
          user_id: profile.id,
          name,
          type,
          target_amount: targetAmount ? parseFloat(targetAmount) : null,
          unlock_date: type === 'LOCKED' && unlockDate ? unlockDate : null,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (error) throw error;

      await createAuditLog(
        profile.id,
        AUDIT_ACTIONS.SAVINGS_PLAN_CREATED,
        ENTITY_TYPES.SAVINGS_PLAN,
        data.id,
        { name, type, target_amount: targetAmount }
      );

      toast({
        title: 'Success',
        description: 'Savings plan created successfully',
      });

      router.push('/dashboard/savings');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create savings plan',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <PiggyBank className="h-8 w-8 text-blue-600" />
          Create Savings Plan
        </h1>
        <p className="text-slate-600 mt-1">Set up a new savings goal</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
          <CardDescription>
            Choose the type of savings plan and set your goals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., Emergency Fund, Business Expansion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Plan Type *</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL">
                    Personal - For personal savings goals
                  </SelectItem>
                  <SelectItem value="BUSINESS">
                    Business - For business savings and investments
                  </SelectItem>
                  <SelectItem value="LOCKED">
                    Locked - Cannot withdraw until unlock date
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {type === 'LOCKED'
                  ? 'Locked savings cannot be withdrawn until the unlock date'
                  : 'You can withdraw from this plan anytime'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAmount">Target Amount (Optional)</Label>
              <Input
                id="targetAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="1000.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Set a savings target to track your progress
              </p>
            </div>

            {type === 'LOCKED' && (
              <div className="space-y-2">
                <Label htmlFor="unlockDate">Unlock Date *</Label>
                <Input
                  id="unlockDate"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={unlockDate}
                  onChange={(e) => setUnlockDate(e.target.value)}
                  required={type === 'LOCKED'}
                />
                <p className="text-xs text-slate-500">
                  You won't be able to withdraw until this date
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create Plan'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
