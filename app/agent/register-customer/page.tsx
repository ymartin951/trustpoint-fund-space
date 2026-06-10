'use client';

import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CheckCircle2,
  FileImage,
  IdCard,
  ImagePlus,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UploadCloud,
  UserPlus,
  UserRound,
  WalletCards,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type UserCategory =
  | 'INDIVIDUAL'
  | 'GOVERNMENT_WORKER'
  | 'TEACHER'
  | 'NURSE'
  | 'BUSINESS_OWNER'
  | 'MARKET_WOMAN'
  | 'TRADER'
  | 'STUDENT'
  | 'OTHER';

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | '';

type IdType =
  | 'GHANA_CARD'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'DRIVER_LICENSE'
  | 'NATIONAL_ID'
  | 'OTHER'
  | '';

type FormState = {
  full_name: string;
  phone: string;
  email: string;
  country: string;
  region: string;
  city: string;
  location: string;
  gender: Gender;
  date_of_birth: string;
  user_category: UserCategory;
  occupation: string;
  employer_name: string;
  staff_id: string;
  business_name: string;
  business_type: string;
  business_location: string;
  id_type: IdType;
  id_number: string;
  ghana_card: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  momo_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  notes: string;
};

type CreateCustomerResponse = {
  success: boolean;
  message?: string;
  customer?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    verification_status: string | null;
  };
};

const CUSTOMER_FORM_STORAGE_KEY = 'trustpoint_agent_register_customer_form';

const initialForm: FormState = {
  full_name: '',
  phone: '',
  email: '',
  country: 'Ghana',
  region: '',
  city: '',
  location: '',
  gender: '',
  date_of_birth: '',
  user_category: 'OTHER',
  occupation: '',
  employer_name: '',
  staff_id: '',
  business_name: '',
  business_type: '',
  business_location: '',
  id_type: '',
  id_number: '',
  ghana_card: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  momo_number: '',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  notes: '',
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

const genderOptions: { label: string; value: Gender }[] = [
  { label: 'Select gender', value: '' },
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];

const idTypes: { label: string; value: IdType }[] = [
  { label: 'Select ID type', value: '' },
  { label: 'Ghana Card', value: 'GHANA_CARD' },
  { label: 'Passport', value: 'PASSPORT' },
  { label: 'Voter ID', value: 'VOTER_ID' },
  { label: 'Driver License', value: 'DRIVER_LICENSE' },
  { label: 'National ID', value: 'NATIONAL_ID' },
  { label: 'Other ID', value: 'OTHER' },
];

function normalize(value: string | null | undefined) {
  return String(value || '').trim();
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not set';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validateImageFile(file: File | null) {
  if (!file) return 'This image is required.';

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    return 'Only JPG, PNG, or WEBP images are allowed.';
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    return 'Image must not be bigger than 5MB.';
  }

  return null;
}

function inputClass(hasError?: boolean) {
  return [
    'min-h-12 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition',
    'placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50',
    hasError ? 'border-red-300 bg-red-50' : 'border-slate-200',
  ].join(' ');
}

function textAreaClass(hasError?: boolean) {
  return [
    'w-full rounded-2xl border bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 outline-none transition',
    'placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50',
    hasError ? 'border-red-300 bg-red-50' : 'border-slate-200',
  ].join(' ');
}

export default function AgentRegisterCustomerPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  const [form, setForm] = useState<FormState>(initialForm);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOMER_FORM_STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormState>;
        setForm({ ...initialForm, ...parsed });
      }
    } catch {
      window.localStorage.removeItem(CUSTOMER_FORM_STORAGE_KEY);
    } finally {
      setRestoring(false);
    }
  }, []);

  useEffect(() => {
    if (restoring || submitting || successMessage) return;

    window.localStorage.setItem(CUSTOMER_FORM_STORAGE_KEY, JSON.stringify(form));
  }, [form, restoring, submitting, successMessage]);

  const requiredErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!normalize(form.full_name)) {
      errors.full_name = 'Customer full name is required.';
    }

    if (!normalize(form.phone)) {
      errors.phone = 'Customer phone number is required.';
    }

    if (!normalize(form.country)) {
      errors.country = 'Country is required.';
    }

    if (!normalize(form.region)) {
      errors.region = 'Region is required.';
    }

    if (!normalize(form.city) && !normalize(form.location)) {
      errors.location = 'Enter customer city or location.';
    }

    if (!form.id_type) {
      errors.id_type = 'Select the customer ID type.';
    }

    if (!normalize(form.id_number)) {
      errors.id_number = 'Enter the selected ID number.';
    }

    const frontError = validateImageFile(idFrontFile);
    const backError = validateImageFile(idBackFile);
    const selfieError = validateImageFile(selfieFile);

    if (frontError) errors.id_document_front = frontError;
    if (backError) errors.id_document_back = backError;
    if (selfieError) errors.selfie = selfieError;

    return errors;
  }, [form, idBackFile, idFrontFile, selfieFile]);

  const completion = useMemo(() => {
    const checks = [
      normalize(form.full_name),
      normalize(form.phone),
      normalize(form.country),
      normalize(form.region),
      normalize(form.city) || normalize(form.location),
      form.gender,
      form.user_category,
      normalize(form.occupation) ||
        normalize(form.business_name) ||
        normalize(form.business_type),
      form.id_type,
      normalize(form.id_number),
      idFrontFile,
      idBackFile,
      selfieFile,
      normalize(form.momo_number),
      normalize(form.emergency_contact_name),
      normalize(form.emergency_contact_phone),
    ];

    const done = checks.filter(Boolean).length;

    return Math.round((done / checks.length) * 100);
  }, [form, idBackFile, idFrontFile, selfieFile]);

  const canSubmit = Object.keys(requiredErrors).length === 0 && !submitting;

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return session.access_token;
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function markTouched(name: string) {
    setTouched((previous) => ({
      ...previous,
      [name]: true,
    }));
  }

  function showError(name: string) {
    return touched[name] ? requiredErrors[name] : '';
  }

  function resetForm() {
    setForm(initialForm);
    setIdFrontFile(null);
    setIdBackFile(null);
    setSelfieFile(null);
    setTouched({});
    setCreatedCustomerId(null);
    setSuccessMessage('');
    setErrorMessage('');
    window.localStorage.removeItem(CUSTOMER_FORM_STORAGE_KEY);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');
      setCreatedCustomerId(null);

      const allTouched: Record<string, boolean> = {};
      Object.keys(requiredErrors).forEach((key) => {
        allTouched[key] = true;
      });
      setTouched((previous) => ({ ...previous, ...allTouched }));

      if (Object.keys(requiredErrors).length > 0) {
        throw new Error('Please complete all required customer and KYC details.');
      }

      const token = await getAccessToken();

      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, String(value || '').trim());
      });

      if (idFrontFile) {
        formData.append('id_document_front', idFrontFile);
      }

      if (idBackFile) {
        formData.append('id_document_back', idBackFile);
      }

      if (selfieFile) {
        formData.append('selfie', selfieFile);
      }

      const response = await fetch('/api/agent/customers/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = (await response.json().catch(() => null)) as
        | CreateCustomerResponse
        | null;

      if (!response.ok || !result?.success) {
        if (response.status === 405) {
          throw new Error(
            'The customer registration API route does not allow POST requests. Please check app/api/agent/customers/create/route.ts.'
          );
        }

        if (response.status === 404) {
          throw new Error(
            'The customer registration API route was not found. Please check app/api/agent/customers/create/route.ts.'
          );
        }

        throw new Error(result?.message || 'Unable to register customer.');
      }

      const customerId = result.customer?.id || null;

      setCreatedCustomerId(customerId);
      setSuccessMessage(
        result.message ||
          'Customer registered successfully. The customer is now pending admin verification.'
      );

      window.localStorage.removeItem(CUSTOMER_FORM_STORAGE_KEY);

      if (customerId) {
        setTimeout(() => {
          router.push(`/agent/customers/${customerId}`);
        }, 1200);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while registering customer.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || restoring) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-700" />
            <h1 className="text-lg font-black text-slate-900">
              Preparing customer registration...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while TrustPoint opens the agent registration form.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/agent"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agent Control Center
          </Link>

          <button
            type="button"
            onClick={resetForm}
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Clear Form
          </button>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-5 text-white shadow-sm md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-center">
            <div className="min-w-0">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black">
                <UserPlus className="h-4 w-4" />
                Agent Customer Registration
              </p>

              <h1 className="break-words text-2xl font-black md:text-4xl">
                Register a customer for TrustPoint Fund Space
              </h1>

              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-emerald-50 md:text-base">
                Capture the customer’s identity, contact details, location,
                work/business information, payment details, emergency contact,
                and KYC documents. After registration, the customer will be
                created with a pending verification request.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <HeroStat label="Agent" value={profile?.full_name || 'Active Agent'} />
                <HeroStat label="KYC" value="Required" />
                <HeroStat label="Status" value="Pending Review" />
                <HeroStat label="Next Step" value="Open Profile" />
              </div>
            </div>

            <div className="rounded-3xl bg-white/15 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/20 p-3">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-black">Trust Shield Readiness</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-emerald-50">
                    Complete the information below to support verification and
                    future Fund Space transparency.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-black">
                  <span>Form completion</span>
                  <span>{completion}%</span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <AlertBox type="error">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="break-words">{errorMessage}</p>

              {errorMessage.toLowerCase().includes('session') && (
                <Link
                  href="/auth/login"
                  className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-red-700 shadow-sm"
                >
                  Go to login
                </Link>
              )}
            </div>
          </AlertBox>
        )}

        {successMessage && (
          <AlertBox type="success">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="break-words">{successMessage}</p>

              {createdCustomerId && (
                <Link
                  href={`/agent/customers/${createdCustomerId}`}
                  className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-emerald-700 shadow-sm"
                >
                  Open customer profile
                </Link>
              )}
            </div>
          </AlertBox>
        )}

        <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <FormSection
              icon={<UserRound className="h-5 w-5" />}
              title="Personal Information"
              description="Enter the customer’s basic identity information."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Full Name"
                  required
                  error={showError('full_name')}
                  value={form.full_name}
                  onBlur={() => markTouched('full_name')}
                  onChange={(value) => updateField('full_name', value)}
                  placeholder="Enter customer full name"
                />

                <InputField
                  label="Phone Number"
                  required
                  error={showError('phone')}
                  value={form.phone}
                  onBlur={() => markTouched('phone')}
                  onChange={(value) => updateField('phone', value)}
                  placeholder="Example: 0542224630"
                />

                <InputField
                  label="Email Address"
                  value={form.email}
                  onChange={(value) => updateField('email', value)}
                  placeholder="Optional"
                  type="email"
                />

                <SelectField
                  label="Gender"
                  value={form.gender}
                  onChange={(value) => updateField('gender', value as Gender)}
                  options={genderOptions}
                />

                <InputField
                  label="Date of Birth"
                  value={form.date_of_birth}
                  onChange={(value) => updateField('date_of_birth', value)}
                  type="date"
                />

                <SelectField
                  label="Customer Category"
                  value={form.user_category}
                  onChange={(value) =>
                    updateField('user_category', value as UserCategory)
                  }
                  options={userCategories}
                />
              </div>
            </FormSection>

            <FormSection
              icon={<MapPin className="h-5 w-5" />}
              title="Location Details"
              description="This helps TrustPoint verify and locate customers when needed."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Country"
                  required
                  error={showError('country')}
                  value={form.country}
                  onBlur={() => markTouched('country')}
                  onChange={(value) => updateField('country', value)}
                />

                <InputField
                  label="Region"
                  required
                  error={showError('region')}
                  value={form.region}
                  onBlur={() => markTouched('region')}
                  onChange={(value) => updateField('region', value)}
                  placeholder="Example: Greater Accra"
                />

                <InputField
                  label="City / Town"
                  value={form.city}
                  onChange={(value) => updateField('city', value)}
                  placeholder="Example: Accra"
                />

                <InputField
                  label="Specific Location"
                  required
                  error={showError('location')}
                  value={form.location}
                  onBlur={() => markTouched('location')}
                  onChange={(value) => updateField('location', value)}
                  placeholder="Area, landmark, shop location, or house area"
                />
              </div>
            </FormSection>

            <FormSection
              icon={<BriefcaseBusiness className="h-5 w-5" />}
              title="Work / Business Details"
              description="Useful for customer profiling, trust review, and Fund Space eligibility."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Occupation"
                  value={form.occupation}
                  onChange={(value) => updateField('occupation', value)}
                  placeholder="Example: Trader, Teacher, Nurse"
                />

                <InputField
                  label="Employer Name"
                  value={form.employer_name}
                  onChange={(value) => updateField('employer_name', value)}
                  placeholder="Optional"
                />

                <InputField
                  label="Staff ID"
                  value={form.staff_id}
                  onChange={(value) => updateField('staff_id', value)}
                  placeholder="Optional"
                />

                <InputField
                  label="Business Name"
                  value={form.business_name}
                  onChange={(value) => updateField('business_name', value)}
                  placeholder="Optional"
                />

                <InputField
                  label="Business Type"
                  value={form.business_type}
                  onChange={(value) => updateField('business_type', value)}
                  placeholder="Example: Provision shop, clothing, food"
                />

                <InputField
                  label="Business Location"
                  value={form.business_location}
                  onChange={(value) => updateField('business_location', value)}
                  placeholder="Optional"
                />
              </div>
            </FormSection>

            <FormSection
              icon={<IdCard className="h-5 w-5" />}
              title="KYC / Identification"
              description="Upload clear front ID, back ID, and customer selfie for verification."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="ID Type"
                  required
                  error={showError('id_type')}
                  value={form.id_type}
                  onBlur={() => markTouched('id_type')}
                  onChange={(value) => updateField('id_type', value as IdType)}
                  options={idTypes}
                />

                <InputField
                  label="ID Number"
                  required
                  error={showError('id_number')}
                  value={form.id_number}
                  onBlur={() => markTouched('id_number')}
                  onChange={(value) => updateField('id_number', value)}
                  placeholder="Enter selected ID number"
                />

                <InputField
                  label="Ghana Card Number"
                  value={form.ghana_card}
                  onChange={(value) => updateField('ghana_card', value)}
                  placeholder="Optional, if different from ID number"
                />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <FileUploadBox
                  label="Front of ID"
                  required
                  file={idFrontFile}
                  error={showError('id_document_front')}
                  onBlur={() => markTouched('id_document_front')}
                  onChange={setIdFrontFile}
                />

                <FileUploadBox
                  label="Back of ID"
                  required
                  file={idBackFile}
                  error={showError('id_document_back')}
                  onBlur={() => markTouched('id_document_back')}
                  onChange={setIdBackFile}
                />

                <FileUploadBox
                  label="Customer Selfie"
                  required
                  file={selfieFile}
                  error={showError('selfie')}
                  onBlur={() => markTouched('selfie')}
                  onChange={setSelfieFile}
                />
              </div>
            </FormSection>

            <FormSection
              icon={<WalletCards className="h-5 w-5" />}
              title="Payment Details"
              description="MoMo is important for contribution confirmation and future payouts."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="MoMo Number"
                  value={form.momo_number}
                  onChange={(value) => updateField('momo_number', value)}
                  placeholder="Customer MoMo number"
                />

                <InputField
                  label="Bank Name"
                  value={form.bank_name}
                  onChange={(value) => updateField('bank_name', value)}
                  placeholder="Optional"
                />

                <InputField
                  label="Bank Account Name"
                  value={form.bank_account_name}
                  onChange={(value) => updateField('bank_account_name', value)}
                  placeholder="Optional"
                />

                <InputField
                  label="Bank Account Number"
                  value={form.bank_account_number}
                  onChange={(value) => updateField('bank_account_number', value)}
                  placeholder="Optional"
                />
              </div>
            </FormSection>

            <FormSection
              icon={<Phone className="h-5 w-5" />}
              title="Emergency Contact & Notes"
              description="Useful when TrustPoint needs to follow up on customer issues."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Emergency Contact Name"
                  value={form.emergency_contact_name}
                  onChange={(value) =>
                    updateField('emergency_contact_name', value)
                  }
                  placeholder="Optional"
                />

                <InputField
                  label="Emergency Contact Phone"
                  value={form.emergency_contact_phone}
                  onChange={(value) =>
                    updateField('emergency_contact_phone', value)
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Agent Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={5}
                  placeholder="Write any important note about this customer..."
                  className={textAreaClass()}
                />
              </div>
            </FormSection>
          </div>

          <aside className="space-y-5">
            <div className="sticky top-5 space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-base font-black text-slate-900">
                      Registration Checklist
                    </h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                      Complete the required details before submitting.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <ChecklistItem
                    done={Boolean(normalize(form.full_name) && normalize(form.phone))}
                    label="Customer identity and phone"
                  />
                  <ChecklistItem
                    done={Boolean(normalize(form.country) && normalize(form.region))}
                    label="Location details"
                  />
                  <ChecklistItem
                    done={Boolean(form.id_type && normalize(form.id_number))}
                    label="ID type and ID number"
                  />
                  <ChecklistItem done={Boolean(idFrontFile)} label="Front ID uploaded" />
                  <ChecklistItem done={Boolean(idBackFile)} label="Back ID uploaded" />
                  <ChecklistItem done={Boolean(selfieFile)} label="Selfie uploaded" />
                  <ChecklistItem
                    done={Boolean(normalize(form.momo_number))}
                    label="MoMo number added"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Register Customer
                </button>

                {!canSubmit && (
                  <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
                    Required fields and KYC images must be completed before
                    submission.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />

                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-amber-900">
                      Agent Responsibility
                    </h2>

                    <p className="mt-2 break-words text-sm font-semibold leading-6 text-amber-700">
                      Register only real customers. Wrong information can affect
                      verification, Trust Shield, Fund Space payments, payouts,
                      and disputes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black text-slate-900">
                  After Registration
                </h2>

                <div className="mt-4 space-y-3">
                  <MiniInfo
                    icon={<ShieldCheck className="h-4 w-4" />}
                    label="Verification"
                    value="Customer will wait for admin review"
                  />
                  <MiniInfo
                    icon={<UserRound className="h-4 w-4" />}
                    label="Profile"
                    value="You can open the customer profile"
                  />
                  <MiniInfo
                    icon={<WalletCards className="h-4 w-4" />}
                    label="Fund Space"
                    value="Add customer after eligibility check"
                  />
                  <MiniInfo
                    icon={<Banknote className="h-4 w-4" />}
                    label="Payment"
                    value="Collect weekly payment after joining"
                  />
                </div>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}

function AlertBox({
  type,
  children,
}: {
  type: 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 text-sm font-bold ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">{children}</div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
      <p className="break-words text-xs font-bold text-emerald-50">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="break-words text-lg font-black text-slate-900">
            {title}
          </h2>
          <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClass(Boolean(error))}
      />

      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  onBlur,
  options,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: { label: string; value: string }[];
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <select
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass(Boolean(error))}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

function FileUploadBox({
  label,
  file,
  onChange,
  onBlur,
  required,
  error,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onBlur?: () => void;
  required?: boolean;
  error?: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;
    onChange(selectedFile);
    onBlur?.();
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <label
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition ${
          error
            ? 'border-red-300 bg-red-50'
            : file
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50'
        }`}
      >
        {file ? (
          <>
            <FileImage className="mb-3 h-8 w-8 text-emerald-700" />
            <span className="break-all text-sm font-black text-emerald-800">
              {file.name}
            </span>
            <span className="mt-1 text-xs font-semibold text-emerald-700">
              {(file.size / 1024 / 1024).toFixed(2)}MB selected
            </span>
          </>
        ) : (
          <>
            <ImagePlus className="mb-3 h-8 w-8 text-slate-400" />
            <span className="text-sm font-black text-slate-700">
              Upload {label}
            </span>
            <span className="mt-1 text-xs font-semibold text-slate-500">
              JPG, PNG, or WEBP. Max 5MB.
            </span>
          </>
        )}

        <span className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm">
          <UploadCloud className="h-4 w-4" />
          Choose Image
        </span>

        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleChange}
        />
      </label>

      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
        }`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>

      <p
        className={`text-sm font-bold ${
          done ? 'text-emerald-800' : 'text-slate-600'
        }`}
      >
        {label}
      </p>
    </div>
  );
}

function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
      <div className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-700">
          {formatLabel(value)}
        </p>
      </div>
    </div>
  );
}