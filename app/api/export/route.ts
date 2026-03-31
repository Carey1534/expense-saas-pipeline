import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cleanStr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  // Collapse newlines/tabs in strings (e.g. multi-line OCR vendor names)
  return String(value).replace(/[\r\n\t]+/g, ' ').trim();
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function fmtMoney(v: number | null | undefined): number {
  return typeof v === 'number' ? Math.round(v * 100) / 100 : 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { project_id, date_from, date_to, format } = body;
    const useCSV = format === 'csv';

    // Step 1: fetch expenses
    let query = supabase
      .from('tc_expense_records')
      .select('expense_date, vendor_name, project_id, total_amount, tax_amount, status')
      .order('expense_date', { ascending: false });

    if (project_id) query = query.eq('project_id', project_id);
    if (date_from)  query = query.gte('expense_date', date_from);
    if (date_to)    query = query.lte('expense_date', date_to);
    query = query.neq('status', 'REJECTED');

    const { data: expenses, error: expError } = await query;

    if (expError) {
      console.error('Supabase export error:', JSON.stringify(expError));
      return new Response(JSON.stringify({ error: expError.message || expError.code || 'Failed to fetch expenses' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: fetch project names for lookup
    const projectIds = [...new Set((expenses || []).map(e => e.project_id).filter(Boolean))];
    const projectMap: Record<string, string> = {};

    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('tc_projects')
        .select('id, name')
        .in('id', projectIds);
      for (const p of projects || []) {
        projectMap[p.id] = p.name;
      }
    }

    // Step 3: build worksheet data (array of objects — xlsx handles formatting)
    const rows = (expenses || []).map(e => ({
      'Date':    fmtDate(e.expense_date),
      'Vendor':  cleanStr(e.vendor_name),
      'Project': cleanStr(e.project_id ? (projectMap[e.project_id] ?? '') : ''),
      'Total':   fmtMoney(e.total_amount),
      'Tax':     fmtMoney(e.tax_amount),
      'Status':  cleanStr(e.status),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // Date
      { wch: 30 }, // Vendor
      { wch: 28 }, // Project
      { wch: 12 }, // Total
      { wch: 10 }, // Tax
      { wch: 18 }, // Status
    ];

    // Apply dollar format to Total (col D) and Tax (col E) for every data row
    const dollarFmt = '"$"#,##0.00';
    const rowCount = rows.length;
    for (let r = 1; r <= rowCount; r++) {
      const totalCell = worksheet[`D${r + 1}`];
      const taxCell   = worksheet[`E${r + 1}`];
      if (totalCell) totalCell.z = dollarFmt;
      if (taxCell)   taxCell.z   = dollarFmt;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (useCSV) {
      // CSV output — plain text, no dollar formatting needed
      const csvFmt = (v: string | number) => {
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ['Date', 'Vendor', 'Project', 'Total', 'Tax', 'Status'].join(',');
      const csvRows = rows.map(r =>
        [csvFmt(r['Date']), csvFmt(r['Vendor']), csvFmt(r['Project']),
         csvFmt(r['Total']), csvFmt(r['Tax']), csvFmt(r['Status'])].join(',')
      );
      const csv = [header, ...csvRows].join('\r\n');
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="expenses-${today}.csv"`,
        },
      });
    }

    // XLSX output
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    const buf: Uint8Array = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    return new Response(arrayBuffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="expenses-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
