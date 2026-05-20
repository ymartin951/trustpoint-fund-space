import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../src/lib/supabase/database.types";

export const runtime = "nodejs";

type IdType =
  | "GHANA_CARD"
  | "PASSPORT"
  | "VOTER_ID"
  | "DRIVER_LICENSE"
  | "NATIONAL_ID"
  | "OTHER";

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

type Gender = "MALE" | "FEMALE" | "OTHER";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const KYC_BUCKET = "kyc-documents";

function cleanText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!value || typeof value === "string") {
    return null;
  }

  if (value.size <= 0) {
    return null;
  }

  return value;
}

function isAllowedImage(file: File) {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  return allowedTypes.includes(file.type);
}

function getFileExtension(file: File) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase();

  if (nameExtension) return nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

async function uploadKycFile(params: {
  customerId: string;
  file: File;
  folder: "id-front" | "id-back" | "selfie";
}) {
  const { customerId, file, folder } = params;

  if (!isAllowedImage(file)) {
    throw new Error(
      `${folder} must be a valid image file. Accepted formats are JPG, PNG, or WEBP.`
    );
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(`${folder} is too large. Maximum allowed size is 5MB.`);
  }

  const extension = getFileExtension(file);
  const filePath = `${customerId}/${folder}-${Date.now()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload ${folder}: ${error.message}`);
  }

  return filePath;
}

async function deleteUploadedFiles(paths: string[]) {
  const validPaths = paths.filter(Boolean);

  if (validPaths.length === 0) return;

  await supabaseAdmin.storage.from(KYC_BUCKET).remove(validPaths);
}

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
  let createdAuthUserId: string | null = null;

  try {
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized request. Please login again.",
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseAuth = createClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Your session has expired. Please login again.",
        },
        { status: 401 }
      );
    }

    const { data: agentProfile, error: agentError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status, full_name")
      .eq("id", user.id)
      .single();

    if (agentError || !agentProfile) {
      return NextResponse.json(
        {
          success: false,
          message: "Agent profile not found.",
        },
        { status: 404 }
      );
    }

    if (agentProfile.role !== "AGENT") {
      return NextResponse.json(
        {
          success: false,
          message: "Only agents can register customers.",
        },
        { status: 403 }
      );
    }

    if (agentProfile.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Your agent account is not active.",
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();

    const fullName = cleanText(formData.get("full_name"));
    const rawPhone = cleanText(formData.get("phone"));
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const email = cleanText(formData.get("email"));

    const country = cleanText(formData.get("country")) || "Ghana";
    const region = cleanText(formData.get("region"));
    const city = cleanText(formData.get("city"));
    const location = cleanText(formData.get("location"));

    const idType = cleanText(formData.get("id_type")) as IdType | null;
    const idNumber = cleanText(formData.get("id_number"));
    const ghanaCard = cleanText(formData.get("ghana_card"));
    const gender = cleanText(formData.get("gender")) as Gender | null;
    const dateOfBirth = cleanText(formData.get("date_of_birth"));

    const userCategory =
      (cleanText(formData.get("user_category")) as UserCategory | null) ||
      "OTHER";

    const occupation = cleanText(formData.get("occupation"));
    const employerName = cleanText(formData.get("employer_name"));
    const staffId = cleanText(formData.get("staff_id"));

    const businessName = cleanText(formData.get("business_name"));
    const businessType = cleanText(formData.get("business_type"));
    const businessLocation = cleanText(formData.get("business_location"));

    const emergencyContactName = cleanText(
      formData.get("emergency_contact_name")
    );
    const emergencyContactPhone = cleanText(
      formData.get("emergency_contact_phone")
    );

    const momoNumber = cleanText(formData.get("momo_number"));
    const bankName = cleanText(formData.get("bank_name"));
    const bankAccountName = cleanText(formData.get("bank_account_name"));
    const bankAccountNumber = cleanText(formData.get("bank_account_number"));
    const notes = cleanText(formData.get("notes"));

    const idFrontFile = getFile(formData, "id_document_front");
    const idBackFile = getFile(formData, "id_document_back");
    const selfieFile = getFile(formData, "selfie");

    if (!fullName) {
      return NextResponse.json(
        { success: false, message: "Customer full name is required." },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "Customer phone number is required." },
        { status: 400 }
      );
    }

    if (!idType) {
      return NextResponse.json(
        { success: false, message: "Please select the customer ID type." },
        { status: 400 }
      );
    }

    if (!idNumber) {
      return NextResponse.json(
        { success: false, message: "Please enter the selected ID number." },
        { status: 400 }
      );
    }

    if (!idFrontFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Please upload the front picture of the selected ID.",
        },
        { status: 400 }
      );
    }

    if (!idBackFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Please upload the back picture of the selected ID.",
        },
        { status: 400 }
      );
    }

    if (!selfieFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Please upload the customer selfie or passport photo.",
        },
        { status: 400 }
      );
    }

    const duplicateConditions = [`phone.eq.${phone}`, `id_number.eq.${idNumber}`];

    if (email) {
      duplicateConditions.push(`email.eq.${email}`);
    }

    if (ghanaCard) {
      duplicateConditions.push(`ghana_card.eq.${ghanaCard}`);
    }

    const { data: duplicateProfiles, error: duplicateError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, email, ghana_card")
        .or(duplicateConditions.join(","))
        .limit(1);

    if (duplicateError) {
      return NextResponse.json(
        {
          success: false,
          message:
            duplicateError.message || "Could not check duplicate customer.",
        },
        { status: 500 }
      );
    }

    if (duplicateProfiles && duplicateProfiles.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A customer with this phone number, email, Ghana Card, or ID number already exists.",
        },
        { status: 409 }
      );
    }

    const authEmail =
      email || `offline-customer-${crypto.randomUUID()}@trustpoint.local`;

    const temporaryPassword = `TP-${crypto.randomUUID()}-${Date.now()}`;

    const { data: createdAuthUser, error: authCreateError } =
      await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: temporaryPassword,
        email_confirm: true,

        // Important:
        // Do not pass phone here because Supabase Auth expects E.164 format.
        // We store phone safely in profiles.phone instead.
        user_metadata: {
          full_name: fullName,
          phone,
          created_by_agent: user.id,
          account_type: "OFFLINE_CUSTOMER",
        },
        app_metadata: {
          role: "USER",
          created_by_agent: user.id,
          account_type: "OFFLINE_CUSTOMER",
        },
      });

    if (authCreateError || !createdAuthUser.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            authCreateError?.message ||
            "Could not create secure customer account.",
        },
        { status: 500 }
      );
    }

    createdAuthUserId = createdAuthUser.user.id;
    const customerId = createdAuthUser.user.id;

    const idFrontPath = await uploadKycFile({
      customerId,
      file: idFrontFile,
      folder: "id-front",
    });
    uploadedPaths.push(idFrontPath);

    const idBackPath = await uploadKycFile({
      customerId,
      file: idBackFile,
      folder: "id-back",
    });
    uploadedPaths.push(idBackPath);

    const selfiePath = await uploadKycFile({
      customerId,
      file: selfieFile,
      folder: "selfie",
    });
    uploadedPaths.push(selfiePath);

    const profilePayload: Database["public"]["Tables"]["profiles"]["Update"] = {
      full_name: fullName,
      phone,
      email,
      role: "USER",
      status: "ACTIVE",
      user_category: userCategory,
      verification_status: "PENDING",
      country,
      region,
      city,
      location,
      date_of_birth: dateOfBirth,
      gender,
      ghana_card: ghanaCard || (idType === "GHANA_CARD" ? idNumber : null),
      ghana_card_verified: false,
      occupation,
      employer_name: employerName,
      staff_id: staffId,
      business_name: businessName,
      business_type: businessType,
      business_location: businessLocation,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      momo_number: momoNumber,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      registered_by_agent: user.id,
      trust_score: 50,
      missed_payment_count: 0,
      successful_cycles_count: 0,
      has_received_payout_before: false,
      is_blacklisted: false,
      terms_accepted: false,
      id_type: idType,
      id_number: idNumber,
      id_document_front_url: idFrontPath,
      id_document_back_url: idBackPath,
      selfie_url: selfiePath,
      updated_at: new Date().toISOString(),
    };

    const { data: createdProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profilePayload)
      .eq("id", customerId)
      .select("id, full_name, phone, verification_status")
      .single();

    if (profileError || !createdProfile) {
      await deleteUploadedFiles(uploadedPaths);

      if (createdAuthUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      }

      return NextResponse.json(
        {
          success: false,
          message:
            profileError?.message ||
            "Could not update customer profile after secure account creation.",
        },
        { status: 500 }
      );
    }

    const verificationPayload: Database["public"]["Tables"]["verification_requests"]["Insert"] =
      {
        user_id: createdProfile.id,
        full_name: fullName,
        phone,
        email,
        country,
        region,
        city,
        location,
        gender,
        date_of_birth: dateOfBirth,
        user_category: userCategory,
        occupation,
        employer_name: employerName,
        staff_id: staffId,
        business_name: businessName,
        business_type: businessType,
        business_location: businessLocation,

        // The current verification_requests table is Ghana Card based.
        // For non-Ghana-card IDs, we still store the selected ID number here
        // so the admin can review it.
        ghana_card_number: ghanaCard || idNumber,

        ghana_card_front_url: idFrontPath,
        ghana_card_back_url: idBackPath,
        selfie_url: selfiePath,
        business_proof_url: null,
        employment_proof_url: null,
        momo_number: momoNumber,
        bank_name: bankName,
        bank_account_name: bankAccountName,
        bank_account_number: bankAccountNumber,
        emergency_contact_name: emergencyContactName || "Not provided",
        emergency_contact_phone: emergencyContactPhone || "Not provided",
        submitted_by_agent: user.id,
        status: "PENDING",
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
      };

    const { data: verificationRequest, error: verificationRequestError } =
      await supabaseAdmin
        .from("verification_requests")
        .upsert(verificationPayload, {
          onConflict: "user_id",
        })
        .select("id, user_id, status")
        .single();

    if (verificationRequestError || !verificationRequest) {
      await deleteUploadedFiles(uploadedPaths);
      await supabaseAdmin.auth.admin.deleteUser(createdProfile.id);

      return NextResponse.json(
        {
          success: false,
          message:
            verificationRequestError?.message ||
            "Customer profile created but verification request could not be created.",
        },
        { status: 500 }
      );
    }

    const { data: agentCustomer, error: linkError } = await supabaseAdmin
      .from("agent_customers")
      .insert({
        agent_id: user.id,
        customer_id: createdProfile.id,
        relationship_status: "ACTIVE",
        notes,
      })
      .select("id, agent_id, customer_id")
      .single();

    if (linkError || !agentCustomer) {
      await deleteUploadedFiles(uploadedPaths);
      await supabaseAdmin.auth.admin.deleteUser(createdProfile.id);

      return NextResponse.json(
        {
          success: false,
          message:
            linkError?.message ||
            "Customer profile and verification request created but could not link customer to agent.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Customer registered successfully. The customer is now pending admin verification.",
      customer: createdProfile,
      agent_customer: agentCustomer,
      verification_request: verificationRequest,
    });
  } catch (error) {
    await deleteUploadedFiles(uploadedPaths);

    if (createdAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
    }

    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}