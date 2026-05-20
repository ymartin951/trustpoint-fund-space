import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Phone, Mail, Clock, MessageCircle } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Wallet className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-slate-900">TrustPoint</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Sign Up</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Help & Support
            </h1>
            <p className="text-lg text-slate-600">
              We're here to help you save better. Get in touch with us anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Phone Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Call us directly for immediate assistance
                </p>
                <a href="tel:0542554675" className="text-lg font-semibold text-blue-600 hover:text-blue-700">
                  0542554675
                </a>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>WhatsApp</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Chat with us on WhatsApp for quick support
                </p>
                <a
                  href="https://wa.me/233542554675"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-green-600 hover:text-green-700"
                >
                  Chat on WhatsApp
                </a>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                  <Mail className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Email Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Send us an email and we'll respond within 24 hours
                </p>
                <a
                  href="mailto:support@trustpointgh.com"
                  className="text-lg font-semibold text-purple-600 hover:text-purple-700 break-all"
                >
                  support@trustpointgh.com
                </a>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center mb-2">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle>Support Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Our team is available during these hours
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  Monday - Saturday
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  8:00 AM - 6:00 PM
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  How do I create an account?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Click on "Sign Up" and follow the simple registration process. You'll need your phone number
                  to receive an OTP code for verification.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  How do I make a deposit?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  You can make deposits by visiting any of our trusted agents with cash, or record your own
                  deposits through mobile money transfers. All deposits are tracked in your wallet in real-time.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  How do withdrawals work?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Submit a withdrawal request from your dashboard. Our team will review and approve it within
                  24 hours. Once approved, funds will be sent to your mobile money account. A small fee applies.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  What are group savings (susu)?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Group savings allow you to create or join savings groups where members contribute fixed amounts
                  regularly (daily, weekly, or monthly). It's a traditional way to save together with accountability.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  Is my money safe with TrustPoint?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Yes! We use bank-level security with encrypted data storage, audit trails for all transactions,
                  and role-based access controls. Your money and information are protected at all times.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  What is locked savings?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Locked savings is a savings plan where you set an unlock date. Your savings in this plan cannot
                  be withdrawn until the unlock date, helping you achieve long-term financial goals.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  How much are the withdrawal fees?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  We charge a small 1% fee on withdrawals to cover processing and mobile money transfer costs.
                  The fee is clearly shown before you confirm any withdrawal request.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                  Can I have multiple savings plans?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Yes! You can create multiple savings plans for different purposes - personal savings, business
                  savings, or locked savings with different goals and timelines.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-12 text-center">
            <p className="text-slate-600 mb-6">
              Still have questions? We're here to help!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:0542554675">
                <Button size="lg" className="w-full sm:w-auto">
                  <Phone className="mr-2 h-5 w-5" />
                  Call Us Now
                </Button>
              </a>
              <a href="https://wa.me/233542554675" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  WhatsApp Chat
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-300 py-12 mt-16">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Wallet className="h-6 w-6 text-blue-400" />
            <span className="text-lg font-bold text-white">TrustPoint</span>
          </div>
          <p className="text-sm">
            &copy; {new Date().getFullYear()} TrustPoint Ghana. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
