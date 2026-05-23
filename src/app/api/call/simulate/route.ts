import { NextRequest, NextResponse } from 'next/server';
import { rememberCallResult } from '@/lib/call-store';
import { CallResultSchema } from '@/lib/schemas';

// Demo-stage fallback: when Twilio trial / carrier filter / venue wifi makes
// the live outbound call unreliable, this endpoint injects a canonical
// successful CallResult into the call-store. The frontend's normal poll picks
// it up exactly as if the real ElevenLabs webhook had fired.
//
// This preserves the rest of the demo flow (transcript streaming, confirmation
// number capture, Tracking lane firing) without dialing a phone.
//
// Usage: POST /api/call/simulate { conversation_id: string }

const CANONICAL_CALL_RESULT = {
  call_sid: 'CA-demo-simulated',
  conversation_id: 'conv-demo-simulated',
  duration_sec: 37,
  transcript_segments: [
    { speaker: 'rep' as const, text: 'Hello, Aetna Appeals. This is Sam speaking. How can I help you today?', t: 1 },
    { speaker: 'agent' as const, text: 'Hello, this is PriorAuth Advocate, an authorized representative calling on behalf of member ID ending five eight two one.', t: 5 },
    { speaker: 'agent' as const, text: 'I am filing an administrative appeal of a prior-authorization denial dated May 18th 2026. The denial cited Aetna Medical Policy zero three four one.', t: 12 },
    { speaker: 'agent' as const, text: 'The patient completed an eight-week azathioprine trial documented in the prescribing physician\'s electronic health record. We are requesting reconsideration under the documented intolerance exception.', t: 19 },
    { speaker: 'agent' as const, text: 'May I have a confirmation number for this appeal?', t: 25 },
    { speaker: 'rep' as const, text: 'Thank you for that. I have your appeal logged. Your confirmation number is Alpha four dash seven eight two one.', t: 29 },
    { speaker: 'agent' as const, text: 'Confirmation number Alpha four dash seven eight two one, correct?', t: 33 },
    { speaker: 'rep' as const, text: 'That\'s correct. Written confirmation will be sent to the address on file within forty-eight hours.', t: 35 },
    { speaker: 'agent' as const, text: 'Thank you. Goodbye.', t: 37 },
  ],
  confirmation_number: 'A4-7821',
  status: 'filed' as const,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const conversationId = body.conversation_id || 'conv-demo-simulated';

    const result = {
      ...CANONICAL_CALL_RESULT,
      conversation_id: conversationId,
    };

    const validated = CallResultSchema.parse(result);
    rememberCallResult(conversationId, validated);

    return NextResponse.json({
      success: true,
      callResult: validated,
      mode: 'simulated',
      note: 'Stage fallback — same UI flow, no live phone call.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
