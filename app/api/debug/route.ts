import { NextResponse } from 'next/server';
import { getExpenses } from '@/lib/db';

export async function GET() {
  try {
    const expenses = await getExpenses();
    
    return NextResponse.json({
      count: expenses.length,
      ids: expenses.map((e: any) => ({ id: e.id, vendor: e.vendor_name })),
      first_expense: expenses[0],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}