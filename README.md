# TrustPoint Digital Platform

A mobile-first web application for individuals and businesses to save money, track contributions, and manage savings groups (susu-style) with admin oversight and agent-assisted deposits.

## Features

### User Features
- **Personal Wallet**: Track savings with real-time balance updates
- **Savings Plans**: Create personal, business, or locked savings plans with targets
- **Group Savings (Susu)**: Join or create savings groups with contribution schedules
- **Deposits**: Self-record deposits or have agents record cash deposits
- **Withdrawals**: Request withdrawals to mobile money accounts
- **Transaction History**: View and filter all transactions
- **Profile Management**: Update personal information and settings

### Agent Features
- **User Search**: Find users by phone number
- **Deposit Recording**: Record cash deposits on behalf of users
- **Transaction History**: View agent-recorded deposits

### Admin Features
- **Dashboard**: Platform KPIs (users, deposits, withdrawals, groups)
- **User Management**: View and manage all users
- **Group Management**: Oversee all savings groups
- **Transaction Monitoring**: View all platform transactions
- **Withdrawal Approvals**: Approve, reject, or mark withdrawals as paid
- **Audit Logs**: Complete audit trail of all sensitive operations

## Tech Stack

- **Frontend**: Next.js 13 (App Router), TypeScript, TailwindCSS
- **UI Components**: shadcn/ui + Radix UI
- **Backend**: Next.js API Routes (API-first architecture)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth (Phone OTP + Email/Password)
- **Hosting**: Vercel (frontend) + Supabase (backend/database)

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Vercel account (optional, for deployment)

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd trustpoint-platform
npm install
```

### 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project credentials from Settings → API
3. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

4. Add your Supabase credentials to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set Up Database

Run the migration to create all tables:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/create_trustpoint_schema.sql`
4. Paste and run the SQL

### 4. Seed Demo Data (Optional)

To add demo users and data:

1. First, create test auth users in Supabase Auth
2. Update the UUIDs in `scripts/seed.sql` with actual auth user IDs
3. Run the seed script in Supabase SQL Editor

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## User Roles

The platform supports four user roles:

1. **USER** (Default)
   - Create savings plans
   - Join groups
   - Deposit and withdraw money
   - View transactions

2. **GROUP_ADMIN**
   - All USER permissions
   - Create and manage groups
   - Add/remove group members
   - View group payment status

3. **AGENT**
   - Record deposits for users (cash collection)
   - Cannot withdraw on behalf of users
   - View agent transaction history

4. **SUPER_ADMIN** (TrustPoint Staff)
   - Full platform oversight
   - Approve withdrawals
   - Manage users and groups
   - View audit logs
   - Suspend accounts

## Authentication

### Email/Password (Primary)
- Users sign up with their email and password
- Create profile with name, phone (optional), location, business type
- Secure password-based authentication via Supabase Auth
- Password reset via email

### Phone OTP (Optional - Requires Configuration)
- Phone OTP is available but requires SMS provider setup
- Supabase supports Twilio, MessageBird, Textlocal, and Vonage
- Without SMS provider configuration, users will see a friendly message directing them to use email signup
- See the Admin → Auth Settings page for detailed setup instructions

**Note**: The platform gracefully handles the absence of SMS provider configuration by:
- Showing clear information messages on login/signup pages
- Using email as the primary authentication method
- Storing phone numbers in profiles for contact purposes
- Providing admin documentation on how to enable Phone OTP

## Database Schema

### Core Tables

- **profiles**: User accounts with roles
- **savings_plans**: Personal, business, and locked savings
- **groups**: Group savings with contribution schedules
- **group_members**: Group membership and roles
- **transactions**: All deposits, withdrawals, and fees
- **withdrawal_requests**: Withdrawal approval workflow
- **audit_logs**: Complete audit trail

All tables have Row Level Security (RLS) enabled with role-based policies.

## Business Logic

### Wallet Balance
Calculated as: `SUM(deposits) - SUM(withdrawals) - SUM(fees)`

Balances are derived from transactions, not stored directly.

### Withdrawals
1. User requests withdrawal
2. Request status: PENDING
3. Admin reviews and approves/rejects
4. If approved, admin marks as PAID
5. System creates withdrawal transaction and fee adjustment
6. Fee: 1% of withdrawal amount

### Groups
- Fixed contribution amounts
- Frequencies: DAILY, WEEKLY, MONTHLY
- Members pay into group
- Group admin manages members and contributions

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

```bash
# Or use Vercel CLI
npm install -g vercel
vercel
```

### Database (Supabase)
Already hosted - just ensure migrations are run.

## Project Structure

```
├── app/                      # Next.js App Router pages
│   ├── (public)/            # Public pages (landing, support)
│   ├── auth/                # Authentication pages
│   ├── dashboard/           # User dashboard and features
│   ├── agent/               # Agent-specific pages
│   ├── admin/               # Admin management pages
│   └── api/                 # API routes (if needed)
├── components/              # Reusable UI components
│   ├── ui/                  # shadcn/ui components
│   ├── DashboardLayout.tsx  # Main dashboard layout
│   └── ProtectedRoute.tsx   # Route protection wrapper
├── contexts/                # React contexts
│   └── AuthContext.tsx      # Authentication state management
├── lib/                     # Utility functions and libraries
│   ├── supabase/            # Supabase client and types
│   ├── wallet.ts            # Wallet calculations
│   └── audit.ts             # Audit logging
└── scripts/                 # Database scripts
    └── seed.sql             # Demo data seed script
```

## Security Features

- Row Level Security (RLS) on all database tables
- Role-based access control
- Audit logging for sensitive operations
- Input validation and sanitization
- Secure password handling via Supabase Auth
- No secrets exposed in client code

## Support

- **Phone**: 0542554675
- **Email**: support@trustpointgh.com
- **Hours**: Monday - Saturday, 8:00 AM - 6:00 PM GMT

## Demo Credentials

After seeding the database, you can use these demo accounts:

- **Admin**: admin@trustpointgh.com
- **Agent**: agent@trustpointgh.com
- **User**: kwame@example.com

Note: You'll need to create actual auth users in Supabase first.

## Building for Production

```bash
npm run build
npm run start
```

## Type Checking

```bash
npm run typecheck
```

## Troubleshooting

### Phone OTP Not Working

If users see "unsupported phone provider" or Phone OTP is not working:

1. **Expected Behavior**: This is normal if SMS provider is not configured
2. **User Impact**: Users see a friendly message and can use email signup instead
3. **To Enable Phone OTP**:
   - Log in as admin
   - Navigate to Admin → Auth Settings
   - Follow the step-by-step guide to configure an SMS provider in Supabase
4. **Quick Fix**: Users can sign up with email and optionally add their phone number in the profile

### Users Can't Sign Up

- Ensure Supabase credentials are correctly set in `.env.local`
- Check that the database migration has been run
- Verify email authentication is enabled in Supabase (Settings → Authentication → Email)

### Build Errors

- Run `npm install` to ensure all dependencies are installed
- Clear Next.js cache: `rm -rf .next`
- Check Node.js version (requires 18+)

## Future Enhancements

- Mobile app (React Native) using same API
- SMS notifications for deposits/withdrawals
- Integration with mobile money APIs
- Advanced analytics and reporting
- Scheduled/recurring deposits
- Interest calculations
- Export transactions to CSV/PDF

## License

Proprietary - TrustPoint Ghana

## Contributing

This is a private project. Contact admin@trustpointgh.com for inquiries.
