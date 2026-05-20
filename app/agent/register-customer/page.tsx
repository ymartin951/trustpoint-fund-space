"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Save,
  UserPlus,
  Phone,
  MapPin,
  BriefcaseBusiness,
  Landmark,
  ShieldCheck,
  Upload,
  ImagePlus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "../../../src/lib/supabase/client";

type UserCategory =
  | "INDIVIDUAL"
  | "GOVERNMENT_WORKER"
  | "TEACHER"
  | "NURSE"
  | "BUSINESS_OWNER"
  | "MARKET_WOMAN"
  | "TRADER"
  | "STUDENT"
  | "OTHER";

type Gender = "MALE" | "FEMALE" | "OTHER" | "";

type IdType =
  | "GHANA_CARD"
  | "PASSPORT"
  | "VOTER_ID"
  | "DRIVER_LICENSE"
  | "NATIONAL_ID"
  | "OTHER"
  | "";

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

const initialForm: FormState = {
  full_name: "",
  phone: "",
  email: "",
  country: "Ghana",
  region: "",
  city: "",
  location: "",
  gender: "",
  date_of_birth: "",
  user_category: "OTHER",
  occupation: "",
  business_name: "",
  business_type: "",
  business_location: "",
  id_type: "",
  id_number: "",
  ghana_card: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  momo_number: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  notes: "",
};

const CUSTOMER_FORM_STORAGE_KEY = "trustpoint_agent_register_customer_form";


const userCategories: { label: string; value: UserCategory }[] = [
  { label: "Individual", value: "INDIVIDUAL" },
  { label: "Government Worker", value: "GOVERNMENT_WORKER" },
  { label: "Teacher", value: "TEACHER" },
  { label: "Nurse", value: "NURSE" },
  { label: "Business Owner", value: "BUSINESS_OWNER" },
  { label: "Market Woman", value: "MARKET_WOMAN" },
  { label: "Trader", value: "TRADER" },
  { label: "Student", value: "STUDENT" },
  { label: "Other", value: "OTHER" },
];

const idTypes: { label: string; value: IdType }[] = [
  { label: "Ghana Card", value: "GHANA_CARD" },
  { label: "Passport", value: "PASSPORT" },
  { label: "Voter ID", value: "VOTER_ID" },
  { label: "Driver License", value: "DRIVER_LICENSE" },
  { label: "National ID", value: "NATIONAL_ID" },
  { label: "Other ID", value: "OTHER" },
];

function inputClass(error?: boolean) {
  return [
    "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
    "placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
    error ? "border-red-300" : "border-slate-200",
  ].join(" ");
}

function labelClass() {
  return "mb-2 block text-sm font-semibold text-slate-700";
}

function sectionTitleClass() {
  return "flex items-center gap-2 text-base font-bold text-slate-900";
}

function fileBoxClass(hasFile: boolean, hasError?: boolean) {
  return [
    "relative flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition",
    hasError
      ? "border-red-300 bg-red-50"
      : hasFile
        ? "border-emerald-300 bg-emerald-50"
        : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50",
  ].join(" ");
}

function validateImageFile(file: File | null) {
  if (!file) return "This image is required.";

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    return "Only JPG, PNG, or WEBP images are allowed.";
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    return "Image must not be more than 5MB.";
  }

  return "";
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
            <p className="text-sm font-bold text-emerald-800">{file.name}</p>
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

export default function AgentRegisterCustomerPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialForm);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasLoadedSavedForm, setHasLoadedSavedForm] = useState(false);

  const validation = useMemo(() => {
    return {
      full_name: !form.full_name.trim() ? "Customer full name is required." : "",
      phone: !form.phone.trim() ? "Customer phone number is required." : "",
      id_type: !form.id_type ? "Please select the customer ID type." : "",
      id_number: !form.id_number.trim()
        ? "Please enter the selected ID number."
        : "",
      id_document_front: validateImageFile(idFrontFile),
      id_document_back: validateImageFile(idBackFile),
      selfie: validateImageFile(selfieFile),
    };
  }, [
    form.full_name,
    form.phone,
    form.id_type,
    form.id_number,
    idFrontFile,
    idBackFile,
    selfieFile,
  ]);

  const hasRequiredError = Object.values(validation).some(Boolean);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    if (errorMessage) setErrorMessage("");
    if (successMessage) setSuccessMessage("");
  };

 const resetForm = () => {
  setForm(initialForm);
  setIdFrontFile(null);
  setIdBackFile(null);
  setSelfieFile(null);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    window.localStorage.removeItem(CUSTOMER_FORM_STORAGE_KEY);
  } catch {
    // Do nothing.
  }
};

  const buildFormData = () => {
    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });

    if (idFrontFile) {
      formData.append("id_document_front", idFrontFile);
    }

    if (idBackFile) {
      formData.append("id_document_back", idBackFile);
    }

    if (selfieFile) {
      formData.append("selfie", selfieFile);
    }

    return formData;
  };

  useEffect(() => {
  try {
    const savedForm = window.localStorage.getItem(CUSTOMER_FORM_STORAGE_KEY);

    if (savedForm) {
      const parsedForm = JSON.parse(savedForm) as Partial<FormState>;

      setForm((previous) => ({
        ...previous,
        ...parsedForm,
      }));

      setSuccessMessage(
        "We restored your saved customer registration form. Please reselect the ID images before submitting."
      );
    }
  } catch {
    // Do nothing. If saved form is corrupted, we ignore it.
  } finally {
    setHasLoadedSavedForm(true);
  }
}, []);

useEffect(() => {
  if (!hasLoadedSavedForm) return;

  try {
    window.localStorage.setItem(
      CUSTOMER_FORM_STORAGE_KEY,
      JSON.stringify(form)
    );
  } catch {
    // Do nothing. Storage may be full or blocked.
  }
}, [form, hasLoadedSavedForm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (hasRequiredError) {
      const firstError = Object.values(validation).find(Boolean);

      setErrorMessage(
        firstError ||
          "Please complete all required fields before submitting the form."
      );

      return;
    }

    try {
      setLoading(true);
      setSuccessMessage("Checking your session...");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please login again.");
      }

      setSuccessMessage("Uploading customer documents and saving profile...");

      const response = await fetch("/api/agent/customers/create", {
  method: "POST",
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
      "The customer registration API route does not allow POST requests. Please make sure this file exists: app/api/agent/customers/create/route.ts and that it exports POST."
    );
  }

  if (response.status === 404) {
    throw new Error(
      "The customer registration API route was not found. Please check that app/api/agent/customers/create/route.ts exists."
    );
  }

  throw new Error(
    result.message ||
      "Failed to register customer. Please check the details and try again."
  );
}
      setSuccessMessage(
        result.message ||
          "Customer registered successfully and is pending admin verification."
      );

      setForm(initialForm);
      setIdFrontFile(null);
      setIdBackFile(null);
      setSelfieFile(null);

      try {
  window.localStorage.removeItem(CUSTOMER_FORM_STORAGE_KEY);
} catch {
  // Do nothing.
}

      setTimeout(() => {
        router.push("/agent/customers");
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while registering customer.";

      setSuccessMessage("");
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <section className="mb-6 rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 text-white shadow-lg md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <UserPlus size={14} />
                Agent Customer Registration
              </div>

              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                Register Offline Customer
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 md:text-base">
                Capture customer information, selected ID type, ID images, and
                selfie/passport photo for admin verification.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/agent/customers")}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            >
              View Customers
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className={sectionTitleClass()}>
                <Phone size={20} className="text-blue-600" />
                Basic Information
              </h2>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                Required
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass()}>Full Name *</label>
                <input
                  value={form.full_name}
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                  className={inputClass(Boolean(validation.full_name))}
                  placeholder="Enter customer full name"
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
                  onChange={(event) => updateField("phone", event.target.value)}
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
                  onChange={(event) => updateField("email", event.target.value)}
                  className={inputClass()}
                  placeholder="customer@example.com"
                />
              </div>

              <div>
                <label className={labelClass()}>Customer Category</label>
                <select
                  value={form.user_category}
                  onChange={(event) =>
                    updateField(
                      "user_category",
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
                <label className={labelClass()}>Gender</label>
                <select
                  value={form.gender}
                  onChange={(event) =>
                    updateField("gender", event.target.value as Gender)
                  }
                  className={inputClass()}
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className={labelClass()}>Date of Birth</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(event) =>
                    updateField("date_of_birth", event.target.value)
                  }
                  className={inputClass()}
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className={sectionTitleClass()}>
                <ShieldCheck size={20} className="text-blue-600" />
                ID Verification Documents
              </h2>

              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                Required
              </span>
            </div>

            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-800">
              The admin will compare the customer’s selected ID, front image,
              back image, and selfie/passport photo before approving or
              rejecting the customer.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass()}>Selected ID Type *</label>
                <select
                  value={form.id_type}
                  onChange={(event) =>
                    updateField("id_type", event.target.value as IdType)
                  }
                  className={inputClass(Boolean(validation.id_type))}
                >
                  <option value="">Select ID type</option>
                  {idTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
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
                    updateField("id_number", event.target.value)
                  }
                  className={inputClass(Boolean(validation.id_number))}
                  placeholder="Enter ID number"
                />
                {validation.id_number && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    {validation.id_number}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass()}>
                  Ghana Card Number, if applicable
                </label>
                <input
                  value={form.ghana_card}
                  onChange={(event) =>
                    updateField("ghana_card", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="GHA-000000000-0"
                />
              </div>

              <div>
                <label className={labelClass()}>MoMo Number</label>
                <input
                  value={form.momo_number}
                  onChange={(event) =>
                    updateField("momo_number", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="MoMo number for payments"
                />
              </div>

              <FileUploadBox
                label="Front Picture of Selected ID *"
                description="Upload front side of ID"
                file={idFrontFile}
                error={validation.id_document_front}
                onChange={setIdFrontFile}
              />

              <FileUploadBox
                label="Back Picture of Selected ID *"
                description="Upload back side of ID"
                file={idBackFile}
                error={validation.id_document_back}
                onChange={setIdBackFile}
              />

              <div className="md:col-span-2">
                <FileUploadBox
                  label="Selfie / Passport Photo *"
                  description="Upload clear customer selfie or passport-size photo"
                  file={selfieFile}
                  error={validation.selfie}
                  onChange={setSelfieFile}
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className={`${sectionTitleClass()} mb-5`}>
              <MapPin size={20} className="text-blue-600" />
              Location Details
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass()}>Country</label>
                <input
                  value={form.country}
                  onChange={(event) =>
                    updateField("country", event.target.value)
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
                    updateField("region", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Ashanti Region"
                />
              </div>

              <div>
                <label className={labelClass()}>City / Town</label>
                <input
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className={inputClass()}
                  placeholder="Kumasi"
                />
              </div>

              <div>
                <label className={labelClass()}>Exact Location</label>
                <input
                  value={form.location}
                  onChange={(event) =>
                    updateField("location", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Market, shop number, community, etc."
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className={`${sectionTitleClass()} mb-5`}>
              <BriefcaseBusiness size={20} className="text-blue-600" />
              Work / Business Details
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass()}>Occupation</label>
                <input
                  value={form.occupation}
                  onChange={(event) =>
                    updateField("occupation", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Trader, teacher, nurse, etc."
                />
              </div>

              <div>
                <label className={labelClass()}>Business Name</label>
                <input
                  value={form.business_name}
                  onChange={(event) =>
                    updateField("business_name", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Customer business name"
                />
              </div>

              <div>
                <label className={labelClass()}>Business Type</label>
                <input
                  value={form.business_type}
                  onChange={(event) =>
                    updateField("business_type", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Food seller, provision shop, clothing, etc."
                />
              </div>

              <div>
                <label className={labelClass()}>Business Location</label>
                <input
                  value={form.business_location}
                  onChange={(event) =>
                    updateField("business_location", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Where the business is located"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className={`${sectionTitleClass()} mb-5`}>
              <Phone size={20} className="text-blue-600" />
              Emergency Contact
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass()}>Emergency Contact Name</label>
                <input
                  value={form.emergency_contact_name}
                  onChange={(event) =>
                    updateField("emergency_contact_name", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Name of emergency contact"
                />
              </div>

              <div>
                <label className={labelClass()}>Emergency Contact Phone</label>
                <input
                  value={form.emergency_contact_phone}
                  onChange={(event) =>
                    updateField("emergency_contact_phone", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Emergency contact phone"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className={sectionTitleClass()}>
                <Landmark size={20} className="text-blue-600" />
                Bank Details
              </h2>

              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                Optional
              </span>
            </div>

            <p className="mb-5 text-sm leading-6 text-slate-500">
              Bank details are optional. The customer can provide them now or
              later before withdrawal or payout.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass()}>Bank Name</label>
                <input
                  value={form.bank_name}
                  onChange={(event) =>
                    updateField("bank_name", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Bank name"
                />
              </div>

              <div>
                <label className={labelClass()}>Bank Account Name</label>
                <input
                  value={form.bank_account_name}
                  onChange={(event) =>
                    updateField("bank_account_name", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Account name"
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass()}>Bank Account Number</label>
                <input
                  value={form.bank_account_number}
                  onChange={(event) =>
                    updateField("bank_account_number", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Account number"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className={`${sectionTitleClass()} mb-5`}>
              <Save size={20} className="text-blue-600" />
              Agent Notes
            </h2>

            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Add any important notes about this customer..."
            />
          </section>

          <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:static md:mx-0 md:rounded-3xl md:border md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear Form
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Register Customer
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}