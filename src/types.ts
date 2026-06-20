export type Language = 'en' | 'hi' | 'mr' | 'bn';

export interface UserProfile {
  businessName: string;
  ownerName: string;
  gstin: string;
  mobileNumber: string;
  preferredLanguage: Language;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  supplier_name: string;
  supplier_gstin: string;
  buyer_gstin: string;
  hsn_code: string;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_gst: number;
  grand_total: number;
  validation_status: 'valid' | 'warning' | 'critical';
  validation_errors: string[];
  original_filename?: string;
  encrypted_file_path?: string;
  encrypted_file_iv?: string;
  file_mime_type?: string;
  file_size_bytes?: number;
}

export interface GSTR2BRecord {
  id: string;
  invoice_number: string;
  supplier_name: string;
  supplier_gstin: string;
  hsn_code: string;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_gst: number;
  grand_total: number;
}

export interface ReconResult {
  invoice_number: string;
  status: 'matched' | 'missing_in_gstr2b' | 'gstin_mismatch' | 'hsn_mismatch' | 'tax_mismatch' | 'duplicate_invoice' | 'supplier_error';
  invoiceDetails?: Invoice;
  gstr2bDetails?: GSTR2BRecord;
  potentialLoss: number;
  risk: 'low' | 'medium' | 'high';
}

export interface SupplierRisk {
  name: string;
  gstin: string;
  riskScore: number; // 0 to 100
  status: 'high' | 'medium' | 'low';
  errorCount: number;
  totalInvoices: number;
}

export interface SmartNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  date: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  message: string;
  timestamp: string;
}
