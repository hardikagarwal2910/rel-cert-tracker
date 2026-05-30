// ─── Shared sub-types ────────────────────────────────────────────────────────

export interface VersionHistoryEntry {
  version: number;
  updated_at: string;
  updated_by?: string;
  expiry_date: string;
  cert_number?: string | null;
  notes?: string | null;
}

export interface NotificationLogEntry {
  trigger_label: string;
  sent_at: string;
  recipient: string;
  status: 'sent' | 'failed';
}

export interface OcrResult {
  available: boolean;
  cert_number: string | null;
  expiry_date: string | null;
  issuing_body: string | null;
  cert_holder_name: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  flagged: boolean;
  cert_number_match?: boolean;
  expiry_date_match?: boolean;
  issuing_body_match?: boolean;
}

export interface ReviewEntry {
  reviewer: string;
  reviewed_at: string;
  action: 'approved' | 'rejected';
  comment?: string;
}

export interface SupplierContact {
  name: string;
  email: string;         // stored encrypted
  phone?: string;        // stored encrypted
  role?: string;
}

export interface OnboardingChecklist {
  contacts_added: boolean;
  required_certs_defined: boolean;
  invite_sent: boolean;
  invite_accepted: boolean;
  first_cert_uploaded: boolean;
}

export interface SupplierPortalLogin {
  email?: string;         // stored encrypted
  password_hash?: string;
  invite_token?: string;  // stored encrypted
  invite_expires?: string;
  invite_accepted?: boolean;
}

export interface Scorecard {
  total_submissions: number;
  approved: number;
  rejected: number;
  submitted_on_time: number;
  submitted_late: number;
  compliance_rate?: number;
  submission_quality?: number;
  on_time_rate?: number;
  combined_score?: number;
}

// ─── Table interfaces ─────────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  display_name?: string | null;
  email?: string | null;
  role: 'admin' | 'staff';
  active: boolean;
  two_factor_enabled?: boolean;
  last_login?: string | null;
  last_action?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Buyer {
  id: string;
  name: string;
  company?: string | null;
  email: string;          // stored encrypted; decrypted in API layer
  designation?: string | null;
  ip_address?: string | null;   // stored encrypted
  geolocation?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  name: string;
  cert_number?: string | null;
  issuing_body?: string | null;
  category?: string | null;
  issue_date?: string | null;
  expiry_date: string;
  renewal_process_start_date?: string | null;
  renewal_cost?: number | null;
  notes?: string | null;
  location_id?: string | null;
  buyer_tags: string[];
  buyer_visible: boolean;
  status: 'active' | 'expiring_soon' | 'expired';
  version_history: VersionHistoryEntry[];
  notification_log: NotificationLogEntry[];
  google_drive_file_id?: string | null;
  submitted_by_supplier: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  tier?: '1' | '2' | '3' | null;
  commodity_tags: string[];
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country: string;
  buyer_links: string[];
  contacts: SupplierContact[];   // individual email/phone fields encrypted
  required_cert_ids: string[];
  status: 'onboarding' | 'active' | 'inactive' | 'suspended';
  onboarding_checklist: OnboardingChecklist;
  portal_login: SupplierPortalLogin;  // all fields encrypted
  scorecard: Scorecard;
  created_at: string;
  updated_at: string;
}

export interface SupplierRequiredCert {
  id: string;
  supplier_id: string;
  required_certs: string[];
  created_at: string;
  updated_at: string;
}

export interface SupplierCert {
  id: string;
  supplier_id: string;
  cert_name: string;
  cert_number?: string | null;
  issuing_body?: string | null;
  category?: string | null;
  issue_date?: string | null;
  expiry_date: string;
  notes?: string | null;
  location_id?: string | null;
  buyer_links: string[];
  status: 'pending_review' | 'approved' | 'rejected' | 'expired' | 'expiring_soon';
  submission_date?: string | null;
  ocr_result: OcrResult | Record<string, unknown>;
  review: ReviewEntry | Record<string, unknown>;
  google_drive_file_id?: string | null;
  version_history: VersionHistoryEntry[];
  notification_log: NotificationLogEntry[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_identifier?: string | null;
  action_type: string;
  target?: string | null;
  detail?: string | null;
  ip_address?: string | null;
  timestamp: string;
}

export interface NotificationLog {
  id: string;
  cert_id?: string | null;
  cert_type: 'internal' | 'supplier';
  recipient?: string | null;
  subject?: string | null;
  trigger_label?: string | null;
  timestamp_sent?: string | null;
  status: 'sent' | 'failed';
  error_message?: string | null;
}

export interface PdfRequest {
  id: string;
  cert_id?: string | null;
  buyer_name?: string | null;
  buyer_company?: string | null;
  buyer_email?: string | null;  // stored encrypted
  cert_name?: string | null;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requested_at?: string | null;
  reviewed_at?: string | null;
  reviewer?: string | null;
  comment?: string | null;
}

export interface DownloadToken {
  token: string;
  cert_id: string;
  buyer_email?: string | null;  // stored encrypted
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at?: string | null;
}
