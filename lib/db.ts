/**
 * Supabase database helpers.
 * All queries run server-side using the service role key and should
 * only be called from API routes or Server Components.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getClients() {
  const { data, error } = await supabase
    .from('tc_clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error (getClients):', error);
    throw error;
  }

  return data || [];
}

export async function getProjectById(projectId: string) {
  const { data, error } = await supabase
    .from('tc_projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    console.error('Supabase error (getProjectById):', error);
    throw error;
  }

  return data;
}

export async function getProjectsByClient(clientId: string) {
  const { data, error } = await supabase
    .from('tc_projects')
    .select('*')
    .eq('client_id', clientId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase error (getProjectsByClient):', error);
    throw error;
  }

  return data || [];
}

export async function getExpensesByProject(projectId: string) {
  const { data, error } = await supabase
    .from('tc_expense_records')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Supabase error (getExpensesByProject):', error);
    throw error;
  }

  const expenses = data || [];

  // Batch join document data
  const documentIds = expenses.map(e => e.document_id).filter(Boolean);
  if (documentIds.length > 0) {
    const { data: documents } = await supabase
      .from('tc_documents')
      .select('id, file_path, status')
      .in('id', documentIds);

    if (documents) {
      const docMap = new Map(documents.map(d => [d.id, d]));
      for (const expense of expenses) {
        if (expense.document_id && docMap.has(expense.document_id)) {
          (expense as Record<string, unknown>).document = docMap.get(expense.document_id);
        }
      }
    }
  }

  return expenses;
}

export async function getAllExpensesForFinancials() {
  const { data, error } = await supabase
    .from('tc_expense_records')
    .select('id, expense_date, total_amount, tax_amount, vendor_name, status, project_id, confidence_score')
    .order('expense_date', { ascending: false })
    .limit(2000);

  if (error) {
    console.error('Supabase error (getAllExpensesForFinancials):', error);
    throw error;
  }

  return data || [];
}

export async function getExpenses() {
  const { data, error } = await supabase
    .from('tc_expense_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Supabase error (getExpenses):', error);
    throw error;
  }

  const expenses = data || [];

  // Fetch document data for expenses that have a document_id
  const documentIds = expenses
    .map(e => e.document_id)
    .filter(Boolean);

  if (documentIds.length > 0) {
    const { data: documents } = await supabase
      .from('tc_documents')
      .select('id, file_path, status')
      .in('id', documentIds);

    if (documents) {
      const docMap = new Map(documents.map(d => [d.id, d]));
      for (const expense of expenses) {
        if (expense.document_id && docMap.has(expense.document_id)) {
          (expense as Record<string, unknown>).document = docMap.get(expense.document_id);
        }
      }
    }
  }

  return expenses;
}

export async function getDocumentById(id: string) {
  const { data, error } = await supabase
    .from('tc_documents')
    .select('id, file_path, status')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Supabase error (getDocumentById):', error);
    throw error;
  }

  return data;
}

export async function updateExpense(id: string, fields: {
  vendor_name?: string;
  expense_date?: string;
  total_amount?: number;
  tax_amount?: number;
}) {
  const { data, error } = await supabase
    .from('tc_expense_records')
    .update(fields)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Supabase error (updateExpense):', error);
    throw error;
  }

  return data;
}

export async function getExpenseById(id: string) {
  const { data: expense, error: expenseError } = await supabase
    .from('tc_expense_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (expenseError) {
    console.error('Supabase error (getExpenseById):', expenseError);
    throw expenseError;
  }

  if (!expense) return null;

  if (expense.document_id) {
    const { data: document } = await supabase
      .from('tc_documents')
      .select('id, file_path, status')
      .eq('id', expense.document_id)
      .maybeSingle();

    if (document) {
      (expense as Record<string, unknown>).document = document;
    }
  }

  return expense;
}
