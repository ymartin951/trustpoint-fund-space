'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  Home,
  ImagePlus,
  Loader2,
  LogOut,
  ShieldCheck,
  Smartphone,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type VerificationRequestRow =
  Database['public']['Tables']['verification_requests']['Row'];

type UserRole = ProfileRow['role'];
type AccountStatus = ProfileRow['status'];
type UserCategory = ProfileRow['user_category'];
type VerificationStatus = ProfileRow['verification_status'];
type VerificationRequestStatus = VerificationRequestRow['status'];

type Gender = 'MALE' | 'FEMALE' | 'OTHER';

type IdType =
  | 'GHANA_CARD'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'DRIVER_LICENSE'
  | 'NATIONAL_ID'
  | 'OTHER';

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  status: AccountStatus;
  verification_status: VerificationStatus;
  user_category: UserCategory;
};

type ExistingVerificationRequest = {
  id: string;
  status: VerificationRequestStatus;
};

type FormState = {
  full_name: string;
  phone: string;
  email: string;
  user_category: UserCategory;

  country: string;
  region: string;
  city: string;
  location: string;

  date_of_birth: string;
  gender: Gender;

  id_type: IdType | '';
  id_number: string;

  occupation: string;
  employer_name: string;
  staff_id: string;

  business_name: string;
  business_type: string;
  business_location: string;

  emergency_contact_name: string;
  emergency_contact_phone: string;

  momo_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
};

const initialForm: FormState = {
  full_name: '',
  phone: '',
  email: '',
  user_category: 'INDIVIDUAL',

  country: 'Ghana',
  region: '',
  city: '',
  location: '',

  date_of_birth: '',
  gender: 'MALE',

  id_type: '',
  id_number: '',

  occupation: '',
  employer_name: '',
  staff_id: '',

  business_name: '',
  business_type: '',
  business_location: '',

  emergency_contact_name: '',
  emergency_contact_phone: '',

  momo_number: '',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
};

const userCategories: { label: string; value: UserCategory }[] = [
  { label: 'Individual', value: 'INDIVIDUAL' },
  { label: 'Government Worker', value: 'GOVERNMENT_WORKER' },
  { label: 'Teacher', value: 'TEACHER' },
  { label: 'Nurse', value: 'NURSE' },
  { label: 'Business Owner', value: 'BUSINESS_OWNER' },
  { label: 'Market Woman', value: 'MARKET_WOMAN' },
  { label: 'Trader', value: 'TRADER' },
  { label: 'Student', value: 'STUDENT' },
  { label: 'Other', value: 'OTHER' },
];

const idTypes: { label: string; value: IdType }[] = [
  { label: 'Ghana Card', value: 'GHANA_CARD' },
  { label: 'Passport', value: 'PASSPORT' },
  { label: 'Voter ID', value: 'VOTER_ID' },
  { label: 'Driver License', value: 'DRIVER_LICENSE' },
  { label: 'National ID', value: 'NATIONAL_ID' },
  { label: 'Other ID', value: 'OTHER' },
];

const validRoles: UserRole[] = ['USER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'];

const validAccountStatuses: AccountStatus[] = [
  'ACTIVE',
  'SUSPENDED',
  'BLACKLISTED',
  'DELETED',
];

const validVerificationStatuses: VerificationStatus[] = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
];

const validVerificationRequestStatuses: VerificationRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

function inputClass(error?: boolean) {
  return [
    'min-h-12 w-full rounded-2xl border bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition',
    'placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100',
    error ? 'border-red-300 bg-red-50' : 'border-slate-200',
  ].join(' ');
}

function labelClass() {
  return 'mb-2 block text-sm font-black text-slate-700';
}

function sectionTitleClass() {
  return 'flex items-center gap-2 break-words text-xl font-black text-slate-950';
}

function fileBoxClass(hasFile: boolean, hasError?: boolean) {
  return [
    'relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition',
    hasError
      ? 'border-red-300 bg-red-50'
      : hasFile
        ? 'border-emerald-300 bg-emerald-50'
        : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50',
  ].join(' ');
}

function validateImageFile(file: File | null) {
  if (!file) return 'This image is required.';

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    return 'Only JPG, PNG, or WEBP images are allowed.';
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    return 'Image must not be more than 5MB.';
  }

  return '';
}

function normalizeUserRole(value: string | null | undefined): UserRole {
  if (value && validRoles.includes(value as UserRole)) {
    return value as UserRole;
  }

  return 'USER';
}

function normalizeAccountStatus(
  value: string | null | undefined
): AccountStatus {
  if (value && validAccountStatuses.includes(value as AccountStatus)) {
    return value as AccountStatus;
  }

  return 'ACTIVE';
}

function normalizeVerificationStatus(
  value: string | null | undefined
): VerificationStatus {
  if (
    value &&
    validVerificationStatuses.includes(value as VerificationStatus)
  ) {
    return value as VerificationStatus;
  }

  return 'UNVERIFIED';
}

function normalizeVerificationRequestStatus(
  value: string | null | undefined
): VerificationRequestStatus {
  if (
    value &&
    validVerificationRequestStatuses.includes(
      value as VerificationRequestStatus
    )
  ) {
    return value as VerificationRequestStatus;
  }

  return 'PENDING';
}

function normalizeUserCategory(value: string | null | undefined): UserCategory {
  const validValues = userCategories.map((item) => item.value);

  if (value && validValues.includes(value as UserCategory)) {
    return value as UserCategory;
  }

  return 'INDIVIDUAL';
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function FileUploadBox({
  label,
  description,
  file,
  error,
  onChange,
}: {
  label: string;
  description: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass()}>{label}</label>

      <label className={fileBoxClass(Boolean(file), Boolean(error))}>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0] || null;
            onChange(selectedFile);
          }}
        />

        {file ? (
          <>
            <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-600" />
            <p className="max-w-full break-words text-sm font-black text-emerald-800 [overflow-wrap:anywhere]">
              {file.name}
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Click to change image
            </p>
          </>
        ) : (
          <>
            <ImagePlus className="mb-3 h-8 w-8 text-slate-500" />
            <p className="break-words text-sm font-black text-slate-800">
              {description}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              JPG, PNG, or WEBP. Maximum 5MB.
            </p>
          </>
        )}
      </label>

      {error && (
        <p className="mt-2 flex items-start gap-1 break-words text-xs font-bold text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function InfoItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 text-sm font-semibold leading-6 text-slate-600">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <span className="break-words">{text}</span>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
      <p className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-sm font-black text-emerald-900">
        {number}
      </p>
      <h3 className="mt-4 break-words text-sm font-black text-white">
        {title}
      </h3>
      <p className="mt-2 break-words text-xs font-semibold leading-5 text-emerald-50/75">
        {description}
      </p>
    </div>
  );
}

function SideCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="break-words text-lg font-black text-slate-950">
            {title}
          </h2>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [existingVerificationRequest, setExistingVerificationRequest] =
    useState<ExistingVerificationRequest | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);

  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validation = useMemo(() => {
    const needsEmployer = ['GOVERNMENT_WORKER', 'TEACHER', 'NURSE'].includes(
      form.user_category
    );

    const needsBusinessLocation = [
      'BUSINESS_OWNER',
      'MARKET_WOMAN',
      'TRADER',
    ].includes(form.user_category);

    return {
      full_name: !form.full_name.trim() ? 'Please enter your full name.' : '',
      phone: !form.phone.trim() ? 'Please enter your phone number.' : '',
      id_type: !form.id_type ? 'Please select the ID type you are using.' : '',
      id_number: !form.id_number.trim()
        ? 'Please enter the selected ID number.'
        : '',
      employer_name:
        needsEmployer && !form.employer_name.trim()
          ? 'Please enter your employer or institution name.'
          : '',
      business_location:
        needsBusinessLocation && !form.business_location.trim()
          ? 'Please enter your business location.'
          : '',
      emergency_contact_name: !form.emergency_contact_name.trim()
        ? 'Please enter your emergency contact name.'
        : '',
      emergency_contact_phone: !form.emergency_contact_phone.trim()
        ? 'Please enter your emergency contact phone number.'
        : '',
      id_document_front: validateImageFile(idFrontFile),
      id_document_back: validateImageFile(idBackFile),
      selfie: validateImageFile(selfieFile),
    };
  }, [form, idFrontFile, idBackFile, selfieFile]);

  const hasRequiredError = Object.values(validation).some(Boolean);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  const buildFormData = () => {
    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });

    formData.append('ghana_card_number', form.id_number.trim());

    if (idFrontFile) {
      formData.append('id_document_front', idFrontFile);
    }

    if (idBackFile) {
      formData.append('id_document_back', idBackFile);
    }

    if (selfieFile) {
      formData.append('selfie', selfieFile);
    }

    return formData;
  };

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        setErrorMessage('');

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);

          if (mounted) {
            setErrorMessage(sessionError.message);
          }

          return;
        }

        if (!session?.user) {
          router.push('/auth/login');
          return;
        }

        const user = session.user;

        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id, full_name, phone, email, role, status, verification_status, user_category'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error('Profile load error:', error);
          setErrorMessage(error.message);
          return;
        }

        if (!data) {
          setErrorMessage(
            'Your profile was not found. Please contact TrustPoint support.'
          );
          return;
        }

        const normalizedRole = normalizeUserRole(data.role);
        const normalizedStatus = normalizeAccountStatus(data.status);
        const normalizedVerificationStatus = normalizeVerificationStatus(
          data.verification_status
        );
        const normalizedCategory = normalizeUserCategory(data.user_category);

        if (normalizedStatus !== 'ACTIVE') {
          setErrorMessage(
            'Your account is not active. Please contact TrustPoint support.'
          );
          return;
        }

        if (normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'ADMIN') {
          router.push('/admin');
          return;
        }

        if (normalizedRole === 'AGENT') {
          router.push('/agent');
          return;
        }

        if (normalizedVerificationStatus === 'VERIFIED') {
          router.push('/dashboard');
          return;
        }

        const { data: requestData, error: requestError } = await supabase
          .from('verification_requests')
          .select('id, status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (requestError) {
          console.warn(
            'Verification request lookup warning:',
            requestError.message
          );
        }

        const loadedProfile: Profile = {
          id: data.id,
          full_name: data.full_name,
          phone: data.phone,
          email: data.email,
          role: normalizedRole,
          status: normalizedStatus,
          verification_status: normalizedVerificationStatus,
          user_category: normalizedCategory,
        };

        setProfile(loadedProfile);

        if (requestData) {
          setExistingVerificationRequest({
            id: requestData.id,
            status: normalizeVerificationRequestStatus(requestData.status),
          });
        } else {
          setExistingVerificationRequest(null);
        }

        setForm((previous) => ({
          ...previous,
          full_name: data.full_name || '',
          phone: data.phone || '',
          email: data.email || user.email || '',
          user_category: normalizedCategory,
        }));
      } catch (error) {
        console.error('Verification page error:', error);

        if (mounted) {
          setErrorMessage(
            'Something went wrong while loading your verification page.'
          );
        }
      } finally {
        if (mounted) {
          setLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!profile) {
      setErrorMessage('Profile not found. Please login again.');
      return;
    }

    if (hasRequiredError) {
      const firstError = Object.values(validation).find(Boolean);

      setErrorMessage(
        firstError ||
          'Please complete all required fields before submitting verification.'
      );

      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch('/api/dashboard/verification', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: buildFormData(),
      });

      const responseText = await response.text();

      let result: {
        success?: boolean;
        message?: string;
      } = {};

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        result = {};
      }

      if (!response.ok || !result.success) {
        if (response.status === 405) {
          throw new Error(
            'The verification API route does not allow POST requests. Make sure app/api/dashboard/verification/route.ts exists and exports POST.'
          );
        }

        if (response.status === 404) {
          throw new Error(
            'The verification API route was not found. Please check app/api/dashboard/verification/route.ts.'
          );
        }

        throw new Error(
          result.message ||
            'Failed to submit verification. Please check the details and try again.'
        );
      }

      setSuccessMessage(
        result.message ||
          'Verification submitted successfully. Admin will review your account before you can join a Fund Space group.'
      );

      setProfile({
        ...profile,
        verification_status: 'PENDING',
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        user_category: form.user_category,
      });

      setExistingVerificationRequest({
        id: existingVerificationRequest?.id || 'submitted',
        status: 'PENDING',
      });

      setIdFrontFile(null);
      setIdBackFile(null);
      setSelfieFile(null);
    } catch (error) {
      console.error('Submit verification error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  const hasSubmittedVerification =
    profile?.verification_status === 'PENDING' &&
    existingVerificationRequest?.status === 'PENDING';

  if (loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" />
          <p className="mt-4 text-sm font-black text-slate-600">
            Loading verification page...
          </p>
        </div>
      </main>
    );
  }

  if (hasSubmittedVerification) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <HelpCircle className="h-4 w-4" />
                Support
              </Link>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-800"
              >
                <Clock className="h-4 w-4" />
                Refresh Status
              </button>
            </div>
          </div>

          <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
            <div className="p-6 text-center md:p-10">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-emerald-800">
                <ShieldCheck className="h-10 w-10" />
              </div>

              <p className="mt-6 inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                Verification submitted
              </p>

              <h1 className="mt-5 break-words text-3xl font-black tracking-tight md:text-5xl">
                Your verification is under review
              </h1>

              <p className="mx-auto mt-4 max-w-2xl break-words text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                Admin must approve your identity documents before you can join
                an active Fund Space group.
              </p>
            </div>
          </section>

          {successMessage && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
              {successMessage}
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <SideCard
              icon={<Clock className="h-5 w-5" />}
              title="What happens next?"
            >
              <div className="space-y-3">
                <InfoItem text="Admin checks your identity and uploaded documents." />
                <InfoItem text="Admin reviews your ID front, ID back, and selfie photo." />
                <InfoItem text="If approved, your account becomes verified." />
                <InfoItem text="You can then choose a weekly Fund Space plan." />
              </div>
            </SideCard>

            <SideCard
              icon={<HelpCircle className="h-5 w-5" />}
              title="Need help?"
            >
              <p className="text-sm font-semibold leading-6 text-slate-600">
                If your verification takes too long or you uploaded the wrong
                document, contact TrustPoint support for assistance.
              </p>

              <Link
                href="/support"
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
              >
                Contact Support
                <ArrowRight className="h-4 w-4" />
              </Link>
            </SideCard>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <Wallet className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-black leading-none text-slate-950">
                TrustPoint
              </h1>
              <p className="truncate text-xs font-bold text-emerald-700">
                Fund Space Verification
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>

            <Link
              href="/support"
              className="hidden min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 sm:inline-flex"
            >
              <HelpCircle className="h-4 w-4" />
              Support
            </Link>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/auth/login');
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-sm">
          <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                <ShieldCheck className="h-4 w-4" />
                Strict verification required
              </p>

              <h1 className="mt-5 break-words text-3xl font-black tracking-tight md:text-5xl">
                Complete your TrustPoint verification
              </h1>

              <p className="mt-4 max-w-3xl break-words text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                To protect every Fund Space member, upload your selected ID
                document, personal details, emergency contact, and a clear
                selfie. Admin must approve your account before you can join an
                active Fund Space group.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StepCard
                number="1"
                title="Submit your details"
                description="Fill in your identity, contact, work, and emergency details."
              />

              <StepCard
                number="2"
                title="Upload documents"
                description="Upload ID front, ID back, and selfie photo for review."
              />

              <StepCard
                number="3"
                title="Wait for approval"
                description="Admin reviews your verification before you join Fund Space."
              />
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="break-words [overflow-wrap:anywhere]">
              {errorMessage}
            </span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="break-words [overflow-wrap:anywhere]">
              {successMessage}
            </span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className={sectionTitleClass()}>
                  <BadgeCheck className="h-5 w-5 text-emerald-700" />
                  Personal Information
                </h2>

                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                  Required
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass()}>Full Name *</label>
                  <input
                    value={form.full_name}
                    onChange={(event) =>
                      updateField('full_name', event.target.value)
                    }
                    className={inputClass(Boolean(validation.full_name))}
                    placeholder="Enter your full name"
                  />
                  {validation.full_name && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.full_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass()}>Phone Number *</label>
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateField('phone', event.target.value)
                    }
                    className={inputClass(Boolean(validation.phone))}
                    placeholder="0240000000"
                  />
                  {validation.phone && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass()}>Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField('email', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className={labelClass()}>User Category</label>
                  <select
                    value={form.user_category}
                    onChange={(event) =>
                      updateField(
                        'user_category',
                        event.target.value as UserCategory
                      )
                    }
                    className={inputClass()}
                  >
                    {userCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass()}>Country</label>
                  <input
                    value={form.country}
                    onChange={(event) =>
                      updateField('country', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Ghana"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Region</label>
                  <input
                    value={form.region}
                    onChange={(event) =>
                      updateField('region', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Greater Accra, Ashanti, Bono..."
                  />
                </div>

                <div>
                  <label className={labelClass()}>City/Town</label>
                  <input
                    value={form.city}
                    onChange={(event) =>
                      updateField('city', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Accra, Kumasi, Sunyani..."
                  />
                </div>

                <div>
                  <label className={labelClass()}>Exact Location</label>
                  <input
                    value={form.location}
                    onChange={(event) =>
                      updateField('location', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Your area/community"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Date of Birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) =>
                      updateField('date_of_birth', event.target.value)
                    }
                    className={inputClass()}
                  />
                </div>

                <div>
                  <label className={labelClass()}>Gender</label>
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      updateField('gender', event.target.value as Gender)
                    }
                    className={inputClass()}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className={sectionTitleClass()}>
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  ID Verification
                </h2>

                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                  Required
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass()}>ID Type *</label>
                  <select
                    value={form.id_type}
                    onChange={(event) =>
                      updateField('id_type', event.target.value as IdType)
                    }
                    className={inputClass(Boolean(validation.id_type))}
                  >
                    <option value="">Select ID type</option>
                    {idTypes.map((idType) => (
                      <option key={idType.value} value={idType.value}>
                        {idType.label}
                      </option>
                    ))}
                  </select>
                  {validation.id_type && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.id_type}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass()}>Selected ID Number *</label>
                  <input
                    value={form.id_number}
                    onChange={(event) =>
                      updateField('id_number', event.target.value)
                    }
                    className={inputClass(Boolean(validation.id_number))}
                    placeholder="Enter the selected ID number"
                  />
                  {validation.id_number && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.id_number}
                    </p>
                  )}
                </div>

                <FileUploadBox
                  label="ID Front Image *"
                  description="Upload front picture of selected ID"
                  file={idFrontFile}
                  error={validation.id_document_front}
                  onChange={setIdFrontFile}
                />

                <FileUploadBox
                  label="ID Back Image *"
                  description="Upload back picture of selected ID"
                  file={idBackFile}
                  error={validation.id_document_back}
                  onChange={setIdBackFile}
                />

                <div className="md:col-span-2">
                  <FileUploadBox
                    label="Selfie / Passport Photo *"
                    description="Upload a clear selfie or passport photo"
                    file={selfieFile}
                    error={validation.selfie}
                    onChange={setSelfieFile}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className={sectionTitleClass()}>
                <Users className="h-5 w-5 text-emerald-700" />
                Work or Business Details
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass()}>Occupation</label>
                  <input
                    value={form.occupation}
                    onChange={(event) =>
                      updateField('occupation', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Teacher, Nurse, Trader..."
                  />
                </div>

                <div>
                  <label className={labelClass()}>
                    Employer / Institution Name
                  </label>
                  <input
                    value={form.employer_name}
                    onChange={(event) =>
                      updateField('employer_name', event.target.value)
                    }
                    className={inputClass(Boolean(validation.employer_name))}
                    placeholder="School, hospital, office..."
                  />
                  {validation.employer_name && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.employer_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass()}>Staff ID</label>
                  <input
                    value={form.staff_id}
                    onChange={(event) =>
                      updateField('staff_id', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Business Name</label>
                  <input
                    value={form.business_name}
                    onChange={(event) =>
                      updateField('business_name', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Business Type</label>
                  <input
                    value={form.business_type}
                    onChange={(event) =>
                      updateField('business_type', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Food, clothes, provisions..."
                  />
                </div>

                <div>
                  <label className={labelClass()}>Business Location</label>
                  <input
                    value={form.business_location}
                    onChange={(event) =>
                      updateField('business_location', event.target.value)
                    }
                    className={inputClass(
                      Boolean(validation.business_location)
                    )}
                    placeholder="Market name or business area"
                  />
                  {validation.business_location && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.business_location}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className={sectionTitleClass()}>
                <Smartphone className="h-5 w-5 text-emerald-700" />
                Emergency and Payment Details
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass()}>
                    Emergency Contact Name *
                  </label>
                  <input
                    value={form.emergency_contact_name}
                    onChange={(event) =>
                      updateField(
                        'emergency_contact_name',
                        event.target.value
                      )
                    }
                    className={inputClass(
                      Boolean(validation.emergency_contact_name)
                    )}
                    placeholder="Name of trusted contact"
                  />
                  {validation.emergency_contact_name && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.emergency_contact_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass()}>
                    Emergency Contact Phone *
                  </label>
                  <input
                    value={form.emergency_contact_phone}
                    onChange={(event) =>
                      updateField(
                        'emergency_contact_phone',
                        event.target.value
                      )
                    }
                    className={inputClass(
                      Boolean(validation.emergency_contact_phone)
                    )}
                    placeholder="Contact phone number"
                  />
                  {validation.emergency_contact_phone && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      {validation.emergency_contact_phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass()}>MoMo Number</label>
                  <input
                    value={form.momo_number}
                    onChange={(event) =>
                      updateField('momo_number', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Number for payout"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Bank Name</label>
                  <input
                    value={form.bank_name}
                    onChange={(event) =>
                      updateField('bank_name', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Bank Account Name</label>
                  <input
                    value={form.bank_account_name}
                    onChange={(event) =>
                      updateField('bank_account_name', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Bank Account Number</label>
                  <input
                    value={form.bank_account_number}
                    onChange={(event) =>
                      updateField('bank_account_number', event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </section>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting Verification...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Submit Verification
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <aside className="space-y-5">
            <SideCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Why verification is required"
            >
              <p className="text-sm font-semibold leading-6 text-slate-600">
                TrustPoint Fund Space handles real contribution money. Strict
                verification protects members from fake accounts, wrong identity
                records, and contribution default.
              </p>

              <div className="mt-5 space-y-4">
                <InfoItem text="Only verified users can join Fund Space groups." />
                <InfoItem text="Admin must review your uploaded ID documents." />
                <InfoItem text="Your selfie helps confirm that the ID belongs to you." />
                <InfoItem text="Payouts require admin approval and proper records." />
                <InfoItem text="Defaulters can be suspended or blacklisted." />
              </div>
            </SideCard>

            <SideCard
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Verification checklist"
            >
              <div className="space-y-4">
                <InfoItem text="Use your real full name and active phone number." />
                <InfoItem text="Upload clear images, not blurred screenshots." />
                <InfoItem text="Make sure your ID number matches the selected ID." />
                <InfoItem text="Provide an emergency contact who can be reached." />
                <InfoItem text="Add your MoMo number for future payout records." />
              </div>
            </SideCard>

            <SideCard
              icon={<HelpCircle className="h-5 w-5" />}
              title="Need help?"
            >
              <p className="text-sm font-semibold leading-6 text-slate-600">
                If you are unable to upload your ID or your verification was
                rejected, contact support for help.
              </p>

              <Link
                href="/support"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Contact Support
                <ArrowRight className="h-4 w-4" />
              </Link>
            </SideCard>
          </aside>
        </div>
      </section>
    </main>
  );
}