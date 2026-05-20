'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Upload,
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
    'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition',
    'placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100',
    error ? 'border-red-300' : 'border-slate-200',
  ].join(' ');
}

function labelClass() {
  return 'mb-2 block text-sm font-semibold text-slate-700';
}

function sectionTitleClass() {
  return 'flex items-center gap-2 text-lg font-extrabold text-slate-950';
}

function fileBoxClass(hasFile: boolean, hasError?: boolean) {
  return [
    'relative flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition',
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
    <div>
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
            <CheckCircle2 size={28} className="mb-2 text-emerald-600" />
            <p className="break-all text-sm font-bold text-emerald-800">
              {file.name}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Click to change image
            </p>
          </>
        ) : (
          <>
            <ImagePlus size={28} className="mb-2 text-slate-500" />
            <p className="text-sm font-bold text-slate-800">{description}</p>
            <p className="mt-1 text-xs text-slate-500">
              JPG, PNG, or WEBP. Maximum 5MB.
            </p>
          </>
        )}
      </label>

      {error && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600">
          <AlertCircle size={14} />
          {error}
        </p>
      )}
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

    /*
      The verification_requests table currently uses ghana_card_number.
      We submit the selected ID number into both id_number and ghana_card_number
      so the backend can store it correctly even when the user selects Passport,
      Voter ID, Driver License, or another ID.
    */
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-slate-600">
            Loading verification page...
          </p>
        </div>
      </main>
    );
  }

  if (hasSubmittedVerification) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600">
            <ShieldCheck size={32} />
          </div>

          <h1 className="mt-6 text-3xl font-extrabold text-slate-950">
            Verification under review
          </h1>

          <p className="mt-4 text-slate-600">
            Your verification has been submitted. Admin must approve your account
            before you can join a Fund Space group.
          </p>

          {successMessage && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-left">
            <p className="text-sm font-semibold text-slate-700">
              What happens next?
            </p>

            <ul className="mt-3 space-y-3 text-sm text-slate-600">
              <li>• Admin checks your identity and uploaded documents.</li>
              <li>• Admin reviews your ID front, ID back, and selfie photo.</li>
              <li>• If approved, your account becomes verified.</li>
              <li>• You can then choose a weekly Fund Space plan.</li>
            </ul>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-8 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            type="button"
          >
            Refresh Status
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Wallet size={24} />
            </div>

            <div>
              <h1 className="text-xl font-bold leading-none text-slate-950">
                TrustPoint
              </h1>
              <p className="text-sm font-medium text-emerald-600">
                Fund Space
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/auth/login');
            }}
            className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck size={16} />
            Strict verification required
          </div>

          <h1 className="text-3xl font-extrabold text-slate-950 sm:text-4xl">
            Complete your TrustPoint verification
          </h1>

          <p className="mt-4 text-slate-600">
            To protect every member, upload your selected ID document and a
            clear selfie/passport photo. Admin must approve your account before
            you can join a Fund Space group.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className={sectionTitleClass()}>Personal Information</h2>

                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
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
                    <p className="mt-2 text-xs font-semibold text-red-600">
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
                    <p className="mt-2 text-xs font-semibold text-red-600">
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
                    placeholder="Greater Accra, Ashanti, etc."
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
                    placeholder="Accra, Kumasi, etc."
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
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className={sectionTitleClass()}>ID Verification</h2>

                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
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
                    <p className="mt-2 text-xs font-semibold text-red-600">
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
                    <p className="mt-2 text-xs font-semibold text-red-600">
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
              <h2 className={sectionTitleClass()}>Work or Business Details</h2>

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
                    <p className="mt-2 text-xs font-semibold text-red-600">
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
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      {validation.business_location}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className={sectionTitleClass()}>
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
                    <p className="mt-2 text-xs font-semibold text-red-600">
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
                    <p className="mt-2 text-xs font-semibold text-red-600">
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
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting Verification...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Submit Verification
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <aside className="h-fit rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={24} />
            </div>

            <h2 className="mt-5 text-xl font-extrabold text-slate-950">
              Why verification is required
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              TrustPoint Fund Space handles real contribution money. Strict
              verification protects members from fake accounts and default.
            </p>

            <div className="mt-6 space-y-4">
              <InfoItem text="Only verified users can join groups." />
              <InfoItem text="Admin must review your uploaded ID documents." />
              <InfoItem text="Your selfie helps confirm that the ID belongs to you." />
              <InfoItem text="Payouts require admin approval." />
              <InfoItem text="Defaulters can be suspended or blacklisted." />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function InfoItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 text-sm text-slate-600">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <span>{text}</span>
    </div>
  );
}