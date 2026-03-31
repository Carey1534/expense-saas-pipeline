import { NextResponse } from 'next/server';

/**
 * POST /api/approve
 * Forwards an approve/reject decision to the n8n approval webhook.
 * Expected body: { org_id, expense_id, decision: 'approve' | 'reject' }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!process.env.N8N_APPROVE_WEBHOOK) {
      console.error('N8N_APPROVE_WEBHOOK not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(process.env.N8N_APPROVE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          org_id: body.org_id,
          expense_record_id: body.expense_id,
        },
        decision: {
          action: body.decision,
        },
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`n8n webhook failed with status ${response.status}: ${responseText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process approval' },
      { status: 500 }
    );
  }
}
