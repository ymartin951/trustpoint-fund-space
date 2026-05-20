'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { createAuditLog, AUDIT_ACTIONS, ENTITY_TYPES } from '@/lib/audit';
import { Users } from 'lucide-react';

export default function CreateGroupPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [startDate, setStartDate] = useState('');
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid contribution amount',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          created_by: profile.id,
          name,
          contribution_amount: amount,
          frequency,
          start_date: startDate,
          rules_text: rules || null,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: profile.id,
          member_role: 'GROUP_ADMIN',
        });

      if (memberError) throw memberError;

      await createAuditLog(
        profile.id,
        AUDIT_ACTIONS.GROUP_CREATED,
        ENTITY_TYPES.GROUP,
        groupData.id,
        { name, contribution_amount: amount, frequency }
      );

      toast({
        title: 'Success',
        description: 'Group created successfully',
      });

      router.push(`/dashboard/groups/${groupData.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create group',
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
          <Users className="h-8 w-8 text-blue-600" />
          Create Savings Group
        </h1>
        <p className="text-slate-600 mt-1">Set up a new group savings (susu)</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Group Details</CardTitle>
          <CardDescription>
            Set up your group's contribution schedule and rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., Family Susu, Friends Savings Circle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contributionAmount">Contribution Amount (GH₵) *</Label>
                <Input
                  id="contributionAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="50.00"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                When should contributions begin?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rules">Group Rules (Optional)</Label>
              <Textarea
                id="rules"
                placeholder="e.g., Late payment penalty: GH₵5, Maximum members: 20"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-slate-500">
                Set clear rules for the group
              </p>
            </div>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create Group'}
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
