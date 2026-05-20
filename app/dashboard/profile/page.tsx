'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { createAuditLog, AUDIT_ACTIONS, ENTITY_TYPES } from '@/lib/audit';
import { User, Shield } from 'lucide-react';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [businessType, setBusinessType] = useState(profile?.business_type || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email: email || null,
          location: location || null,
          business_type: businessType || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await createAuditLog(
        profile.id,
        AUDIT_ACTIONS.PROFILE_UPDATED,
        ENTITY_TYPES.PROFILE,
        profile.id,
        { full_name: fullName, email }
      );

      await refreshProfile();

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <User className="h-8 w-8 text-blue-600" />
          Profile Settings
        </h1>
        <p className="text-slate-600 mt-1">Manage your account information</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            View and update your personal details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm text-slate-600">Account Role</p>
              <div className="flex items-center gap-2 mt-1">
                <Shield className="h-4 w-4 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-700">
                  {profile?.role}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-600">Account Status</p>
              <Badge className="mt-1 bg-green-100 text-green-700">
                {profile?.status}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input value={profile?.phone || ''} disabled />
            <p className="text-xs text-slate-500">
              Phone number cannot be changed
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                type="text"
                placeholder="e.g., Accra, Kumasi"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type (Optional)</Label>
              <Input
                id="businessType"
                type="text"
                placeholder="e.g., Retail, Food, Services"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Account Created</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">
            {profile?.created_at && new Date(profile.created_at).toLocaleString('en-US', {
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
