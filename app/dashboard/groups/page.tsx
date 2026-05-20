'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { getGroupBalance } from '@/lib/wallet';
import { format } from 'date-fns';

export default function GroupsPage() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadGroups();
    }
  }, [profile]);

  const loadGroups = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('*, groups(*)')
        .eq('user_id', profile.id);

      if (error) throw error;

      const groupsData = (data || []).map((m: any) => ({
        ...m.groups,
        member_role: m.member_role,
      }));

      setGroups(groupsData);

      const balancePromises = groupsData.map((g: any) => getGroupBalance(g.id));
      const balanceResults = await Promise.all(balancePromises);

      const balanceMap: Record<string, number> = {};
      groupsData.forEach((g: any, index: number) => {
        balanceMap[g.id] = balanceResults[index];
      });
      setBalances(balanceMap);

      const countPromises = groupsData.map((g: any) =>
        supabase
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', g.id)
      );
      const countResults = await Promise.all(countPromises);

      const countMap: Record<string, number> = {};
      groupsData.forEach((g: any, index: number) => {
        countMap[g.id] = countResults[index].count || 0;
      });
      setMemberCounts(countMap);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `GH₵ ${amount.toFixed(2)}`;
  };

  const getFrequencyLabel = (frequency: string) => {
    return frequency.charAt(0) + frequency.slice(1).toLowerCase();
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
          <h1 className="text-3xl font-bold text-slate-900">My Groups</h1>
          <p className="text-slate-600 mt-1">Manage your savings groups</p>
        </div>
        <Link href="/dashboard/groups/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </Link>
      </div>

      {groups.length === 0 ? (
        <Card className="border-none shadow-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Groups Yet
              </h3>
              <p className="text-slate-600 mb-6">
                Create or join a savings group to start saving together
              </p>
              <Link href="/dashboard/groups/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Group
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link key={group.id} href={`/dashboard/groups/${group.id}`}>
              <Card className="border-none shadow-lg hover:shadow-xl transition cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{group.name}</CardTitle>
                      {group.member_role === 'GROUP_ADMIN' && (
                        <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                      )}
                    </div>
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Contribution</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(Number(group.contribution_amount))}
                      </p>
                      <p className="text-sm text-slate-600">
                        per {getFrequencyLabel(group.frequency)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-600 mb-1">Total Collected</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(balances[group.id] || 0)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Users className="h-4 w-4" />
                        <span>{memberCounts[group.id] || 0} members</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(group.start_date), 'PP')}</span>
                      </div>
                    </div>

                    {group.status !== 'ACTIVE' && (
                      <Badge className="bg-slate-100 text-slate-700">{group.status}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
