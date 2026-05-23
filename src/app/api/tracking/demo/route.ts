import { NextRequest, NextResponse } from 'next/server';
import { TrackingPlanSchema } from '@/lib/schemas';
import { MOCK_TRACKING_PLAN } from '@/lib/fallback-data';

export async function POST(request: NextRequest) {
  try {
    const callResult = await request.json().catch(() => null);

    const now = new Date().toISOString();
    const deadline = callResult?.appeal_deadline_iso || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(); // 180 days from now
    
    // Create a dynamic tracking plan based on the call filing status
    const trackingPlan = {
      run_id: callResult?.conversation_id || MOCK_TRACKING_PLAN.run_id,
      filed_at_iso: now,
      appeal_deadline_iso: deadline,
      next_action_iso: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
      followups: [
        {
          at_iso: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          task: 'status_call',
          owner: 'n8n',
          status: 'scheduled'
        },
        {
          at_iso: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          task: 'fax_refile',
          owner: 'user',
          status: 'waiting'
        },
        {
          at_iso: deadline,
          task: 'state_complaint',
          owner: 'user',
          status: 'waiting'
        }
      ],
      escalation_ready: {
        state_complaint: false,
        external_review_packet: false
      }
    };

    const validated = TrackingPlanSchema.parse(trackingPlan);

    return NextResponse.json(validated);
  } catch (error: any) {
    console.error('Error in tracking route:', error);
    return NextResponse.json(MOCK_TRACKING_PLAN);
  }
}
