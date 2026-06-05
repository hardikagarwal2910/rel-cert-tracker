// Re-export all database types
export type {
  Location,
  Category,
  User,
  Buyer,
  Certificate,
  Supplier,
  SupplierRequiredCert,
  SupplierCert,
  AuditLog,
  NotificationLog,
  PdfRequest,
  DownloadToken,
  // Sub-types
  VersionHistoryEntry,
  NotificationLogEntry,
  OcrResult,
  ReviewEntry,
  SupplierContact,
  OnboardingChecklist,
  SupplierPortalLogin,
  Scorecard,
} from './database';

// ─── API response types ───────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  data: T;
  message?: string;
};

export type ApiError = {
  error: string;
  code?: string;
};

// ─── Input types for DB operations ───────────────────────────────────────────

export interface CertFilter {
  category?: string;
  buyer_tag?: string;
  location_id?: string;
  status?: string;
  buyer_visible?: boolean;
  view?: 'internal' | 'supplier' | 'all';
  // Soft-delete (v1.1.1). By default getCertificates returns only non-archived
  // certs. `archived: true` returns ONLY archived; `includeArchived: true`
  // returns both.
  archived?: boolean;
  includeArchived?: boolean;
}

export interface SupplierFilter {
  tier?: string;
  buyer_link?: string;
  status?: string;
  commodity?: string;
  // Soft-delete (v1.1.1). By default getSuppliers excludes status='inactive'
  // unless a specific `status` is requested or `includeInactive` is set.
  includeInactive?: boolean;
}

export interface AuditFilter {
  user?: string;
  action_type?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
}

export interface CertInput {
  name: string;
  cert_number?: string;
  issuing_body?: string;
  category?: string;
  issue_date?: string;
  expiry_date: string;
  renewal_process_start_date?: string;
  renewal_cost?: number;
  notes?: string;
  location_id?: string;
  buyer_tags?: string[];
  buyer_visible?: boolean;
  google_drive_file_id?: string;
  submitted_by_supplier?: boolean;
  created_by?: string;
  renewal_stage?: 'not_started' | 'in_progress' | 'awaiting_issuer' | 'renewed';
}

export interface RenewalInput {
  new_expiry_date: string;
  new_cert_number?: string;
  renewal_cost?: number;
  notes?: string;
  updated_by?: string;
}

export interface SupplierCertInput {
  supplier_id: string;
  cert_name: string;
  cert_number?: string;
  issuing_body?: string;
  category?: string;
  issue_date?: string;
  expiry_date: string;
  notes?: string;
  location_id?: string;
  buyer_links?: string[];
  google_drive_file_id?: string;
}

export interface ReviewInput {
  reviewer: string;
  comment?: string;
}

export interface UserInput {
  username: string;
  password?: string;
  display_name?: string;
  email?: string;
  role?: 'admin' | 'staff';
  active?: boolean;
}

export interface LocationInput {
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  active?: boolean;
}

export interface SupplierInput {
  name: string;
  tier?: '1' | '2' | '3';
  commodity_tags?: string[];
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  buyer_links?: string[];
  contacts?: Array<{ name: string; email: string; phone?: string; role?: string }>;
  required_cert_ids?: string[];
  status?: string;
}

export interface BuyerInput {
  name: string;
  company?: string;
  email: string;
  designation?: string;
  ip_address?: string;
  geolocation?: Record<string, unknown>;
}

export interface AuditLogInput {
  user_identifier?: string;
  action_type: string;
  target?: string;
  detail?: string;
  ip_address?: string;
}

export interface NotificationLogInput {
  cert_id?: string;
  cert_type: 'internal' | 'supplier';
  recipient?: string;
  subject?: string;
  trigger_label?: string;
  status: 'sent' | 'failed';
  error_message?: string;
}

export interface PdfRequestInput {
  cert_id: string;
  buyer_name?: string;
  buyer_company?: string;
  buyer_email?: string;
  cert_name?: string;
}
