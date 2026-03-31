/**
 * Shared TypeScript types used across the application.
 * Keep this file free of runtime logic — types and interfaces only.
 */

export type ExpenseStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXTRACTED' | 'PROCESSING' | 'DRAFT';

export type ExpenseCategory =
  | 'fuel' | 'materials' | 'labor' | 'tools' | 'food' | 'travel'
  | 'lodging' | 'safety' | 'equipment' | 'electrical' | 'plumbing'
  | 'office' | 'other';

export interface Document {
  id: string;
  file_path: string;
  status: string;
}

export interface Expense {
  id: string;
  org_id: string;
  project_id?: string;
  document_id: string;
  vendor_name: string;
  expense_date: string;
  total_amount: number;
  tax_amount: number;
  status: ExpenseStatus;
  confidence_score: number;
  created_at: string;
  document?: Document; // Optional, only present when joined
}

export interface Client {
  id: string;
  name: string;
  org_id: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string;
  org_id: string;
  budget?: number | null;
}
