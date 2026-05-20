'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Settings, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';

export default function AuthSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-8 w-8 text-blue-600" />
          Authentication Settings
        </h1>
        <p className="text-slate-600 mt-1">Configure authentication methods for TrustPoint</p>
      </div>

      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertCircle className="h-5 w-5 text-yellow-600" />
        <AlertDescription className="text-yellow-900">
          <p className="font-semibold mb-2">Action Required: Phone OTP Configuration</p>
          <p className="text-sm">
            Phone OTP authentication is currently unavailable. To enable it, you must configure an SMS provider in your Supabase project.
          </p>
        </AlertDescription>
      </Alert>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Authentication Methods Status</CardTitle>
          <CardDescription>
            Current status of available authentication methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Email/Password Authentication</p>
                <p className="text-sm text-slate-600 mt-1">
                  Working correctly. Users can sign up and log in with email and password.
                </p>
                <Badge className="mt-2 bg-green-600">Active</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Phone OTP Authentication</p>
                <p className="text-sm text-slate-600 mt-1">
                  Currently unavailable. Requires SMS provider configuration in Supabase.
                </p>
                <Badge className="mt-2 bg-red-600">Inactive</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Enabling Phone OTP Authentication</CardTitle>
          <CardDescription>
            Follow these steps to enable SMS-based phone authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm">1</span>
              Choose an SMS Provider
            </h3>
            <p className="text-slate-600 ml-8 mb-2">
              Supabase supports the following SMS providers:
            </p>
            <ul className="list-disc list-inside ml-8 text-slate-600 space-y-1">
              <li><strong>Twilio</strong> (Recommended) - Popular and reliable</li>
              <li><strong>MessageBird</strong> - Good international coverage</li>
              <li><strong>Textlocal</strong> - For specific regions</li>
              <li><strong>Vonage</strong> - Enterprise-grade service</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm">2</span>
              Create an Account with Your SMS Provider
            </h3>
            <p className="text-slate-600 ml-8">
              Sign up for an account with your chosen provider. Most offer free trial credits to get started.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm">3</span>
              Get Your API Credentials
            </h3>
            <p className="text-slate-600 ml-8 mb-2">
              From your SMS provider dashboard, obtain:
            </p>
            <ul className="list-disc list-inside ml-8 text-slate-600 space-y-1">
              <li>Account SID or API Key</li>
              <li>Auth Token or API Secret</li>
              <li>Sender Phone Number or Sender ID</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm">4</span>
              Configure Supabase
            </h3>
            <div className="ml-8 space-y-3">
              <p className="text-slate-600">
                Go to your Supabase project dashboard:
              </p>
              <ol className="list-decimal list-inside text-slate-600 space-y-2">
                <li>Navigate to <strong>Authentication → Providers</strong></li>
                <li>Find <strong>Phone</strong> in the providers list</li>
                <li>Toggle it to <strong>Enabled</strong></li>
                <li>Select your SMS provider from the dropdown</li>
                <li>Enter your API credentials</li>
                <li>Configure your sender phone number/ID</li>
                <li>Save the configuration</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm">5</span>
              Test the Configuration
            </h3>
            <p className="text-slate-600 ml-8">
              After configuration, test phone OTP by attempting to sign up with a phone number. You should receive an SMS with a verification code.
            </p>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-5 w-5 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <p className="font-semibold mb-2">SMS Provider Costs</p>
              <p className="text-sm">
                SMS providers charge per message sent. Typical costs range from $0.01 to $0.05 per SMS.
                Make sure to monitor your usage and set up billing alerts to avoid unexpected charges.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Current Workaround</CardTitle>
          <CardDescription>
            Temporary solution while Phone OTP is being configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-slate-600">
              Until Phone OTP is configured, users can:
            </p>
            <ul className="list-disc list-inside text-slate-600 space-y-2 ml-2">
              <li>Sign up using email and password</li>
              <li>Optionally provide their phone number in the profile for contact purposes</li>
              <li>Use email for password resets and account recovery</li>
            </ul>
            <Alert className="bg-slate-50 border-slate-200 mt-4">
              <Info className="h-5 w-5 text-slate-600" />
              <AlertDescription className="text-slate-700 text-sm">
                Users will see a friendly message indicating that Phone OTP is temporarily unavailable
                and are directed to use email authentication instead.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-slate-600">
            <li>
              <a
                href="https://supabase.com/docs/guides/auth/phone-login"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Supabase Phone Authentication Documentation →
              </a>
            </li>
            <li>
              <a
                href="https://www.twilio.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Twilio (SMS Provider) →
              </a>
            </li>
            <li>
              <a
                href="https://messagebird.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                MessageBird (SMS Provider) →
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
