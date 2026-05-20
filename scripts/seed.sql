/*
  TrustPoint Demo Data Seed Script

  This script creates demo users with different roles for testing:
  - 1 Super Admin
  - 1 Agent
  - 1 Group Admin
  - 2 Regular Users

  IMPORTANT: Run this after users have been created in Supabase Auth.
  You need to manually create auth users first, then update the UUIDs below.
*/

-- Demo User Profiles
-- Replace these UUIDs with actual auth user IDs from your Supabase project

-- Super Admin Profile
INSERT INTO profiles (id, full_name, phone, email, role, location, status) VALUES
('00000000-0000-0000-0000-000000000001', 'Admin User', '+233501234567', 'admin@trustpointgh.com', 'SUPER_ADMIN', 'Greater Accra', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Agent Profile
INSERT INTO profiles (id, full_name, phone, email, role, location, status) VALUES
('00000000-0000-0000-0000-000000000002', 'Agent John', '+233502345678', 'agent@trustpointgh.com', 'AGENT', 'Greater Accra', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Regular Users
INSERT INTO profiles (id, full_name, phone, email, role, location, business_type, status) VALUES
('00000000-0000-0000-0000-000000000003', 'Kwame Mensah', '+233503456789', 'kwame@example.com', 'USER', 'Ashanti', 'Retail', 'ACTIVE'),
('00000000-0000-0000-0000-000000000004', 'Ama Adjei', '+233504567890', 'ama@example.com', 'USER', 'Greater Accra', NULL, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Group Admin
INSERT INTO profiles (id, full_name, phone, email, role, location, business_type, status) VALUES
('00000000-0000-0000-0000-000000000005', 'Kofi Asante', '+233505678901', 'kofi@example.com', 'GROUP_ADMIN', 'Greater Accra', 'Food Services', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Demo Savings Plans
INSERT INTO savings_plans (user_id, type, name, target_amount, status) VALUES
('00000000-0000-0000-0000-000000000003', 'PERSONAL', 'Emergency Fund', 5000.00, 'ACTIVE'),
('00000000-0000-0000-0000-000000000003', 'BUSINESS', 'Shop Expansion', 10000.00, 'ACTIVE'),
('00000000-0000-0000-0000-000000000004', 'PERSONAL', 'School Fees', 3000.00, 'ACTIVE'),
('00000000-0000-0000-0000-000000000005', 'LOCKED', 'Land Purchase', 15000.00, 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Demo Group
INSERT INTO groups (created_by, name, contribution_amount, frequency, start_date, rules_text, status) VALUES
('00000000-0000-0000-0000-000000000005', 'Family Savings Circle', 100.00, 'WEEKLY', '2026-01-01', 'Late payment penalty: GH₵5. Contributions every Friday.', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Get the group ID for members (this assumes only one group exists for simplicity)
DO $$
DECLARE
  group_id_var UUID;
BEGIN
  SELECT id INTO group_id_var FROM groups WHERE name = 'Family Savings Circle' LIMIT 1;

  IF group_id_var IS NOT NULL THEN
    -- Add Group Members
    INSERT INTO group_members (group_id, user_id, member_role) VALUES
    (group_id_var, '00000000-0000-0000-0000-000000000005', 'GROUP_ADMIN'),
    (group_id_var, '00000000-0000-0000-0000-000000000003', 'MEMBER'),
    (group_id_var, '00000000-0000-0000-0000-000000000004', 'MEMBER')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Demo Transactions (Deposits)
INSERT INTO transactions (user_id, type, amount, channel, created_by, note) VALUES
('00000000-0000-0000-0000-000000000003', 'DEPOSIT', 500.00, 'USER_ENTRY', '00000000-0000-0000-0000-000000000003', 'Initial deposit'),
('00000000-0000-0000-0000-000000000003', 'DEPOSIT', 200.00, 'AGENT_ENTRY', '00000000-0000-0000-0000-000000000002', 'Cash deposit at Accra Mall'),
('00000000-0000-0000-0000-000000000004', 'DEPOSIT', 300.00, 'USER_ENTRY', '00000000-0000-0000-0000-000000000004', 'MoMo transfer'),
('00000000-0000-0000-0000-000000000004', 'DEPOSIT', 150.00, 'USER_ENTRY', '00000000-0000-0000-0000-000000000004', 'Savings contribution'),
('00000000-0000-0000-0000-000000000005', 'DEPOSIT', 1000.00, 'USER_ENTRY', '00000000-0000-0000-0000-000000000005', 'Business proceeds')
ON CONFLICT DO NOTHING;

-- Demo Withdrawal Request
INSERT INTO withdrawal_requests (user_id, amount, momo_number, status) VALUES
('00000000-0000-0000-0000-000000000003', 100.00, '0503456789', 'PENDING')
ON CONFLICT DO NOTHING;

-- Audit Logs for demo actions
INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES
('00000000-0000-0000-0000-000000000003', 'USER_REGISTERED', 'PROFILE', '00000000-0000-0000-0000-000000000003', '{"phone": "+233503456789"}'),
('00000000-0000-0000-0000-000000000004', 'USER_REGISTERED', 'PROFILE', '00000000-0000-0000-0000-000000000004', '{"phone": "+233504567890"}'),
('00000000-0000-0000-0000-000000000005', 'USER_REGISTERED', 'PROFILE', '00000000-0000-0000-0000-000000000005', '{"phone": "+233505678901"}')
ON CONFLICT DO NOTHING;
