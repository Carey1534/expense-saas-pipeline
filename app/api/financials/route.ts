import { NextResponse } from 'next/server';
import { getAllExpensesForFinancials, getClients, getProjectsByClient } from '@/lib/db';

export async function GET() {
  try {
    const [expenses, clients] = await Promise.all([
      getAllExpensesForFinancials(),
      getClients(),
    ]);

    // Build project map: id → { name, clientId, clientName }
    const projectMap: Record<string, { name: string; clientId: string; clientName: string }> = {};
    await Promise.all(
      clients.map(async (client) => {
        const projects = await getProjectsByClient(client.id);
        for (const p of projects) {
          projectMap[p.id] = { name: p.name, clientId: client.id, clientName: client.name };
        }
      })
    );

    return NextResponse.json({ expenses, projectMap });
  } catch (error) {
    console.error('Error fetching financials:', error);
    return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 });
  }
}
