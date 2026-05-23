import { NextRequest, NextResponse } from 'next/server';

/**
 * n8n → backend: TrackingPlan callback.
 *
 * After n8n builds the TrackingPlan from a CallResult, it POSTs back here so
 * the frontend can render the Day 5 / 14 / 30 timeline + escalation flags.
 *
 * For the hackathon demo we just log + acknowledge. Production would persist
 * to Firestore keyed by run_id and stream via SSE to the UI.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'TrackingPlan body required' }, { status: 400 });
    }

    console.log('[tracking/webhook] received from n8n:', JSON.stringify({
      run_id: body.run_id,
      filed_at: body.filed_at_iso,
      confirmation: body.confirmation_number,
      followups: body.followups?.length,
      escalation_ready: body.escalation_ready,
    }));

    return NextResponse.json({
      acknowledged: true,
      run_id: body.run_id,
      received_at_iso: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[tracking/webhook] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: '/api/tracking/webhook', method: 'POST' });
}
