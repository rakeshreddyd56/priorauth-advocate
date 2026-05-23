import { NextRequest, NextResponse } from 'next/server';
import { CallResultSchema } from '@/lib/schemas';
import { MOCK_CALL_RESULT } from '@/lib/fallback-data';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    
    // Parse ElevenLabs webhook payload and map to CallResult schema
    // In a real ElevenLabs webhook, you would inspect rawBody.callId, rawBody.transcript, etc.
    // Here we map whatever is passed, or default to the mock CallResult for demo speed.
    const callResult = {
      call_sid: rawBody.call_sid || rawBody.callId || MOCK_CALL_RESULT.call_sid,
      conversation_id: rawBody.conversation_id || rawBody.agentId || MOCK_CALL_RESULT.conversation_id,
      duration_sec: rawBody.duration_sec || rawBody.duration || MOCK_CALL_RESULT.duration_sec,
      transcript_segments: rawBody.transcript_segments || MOCK_CALL_RESULT.transcript_segments,
      confirmation_number: rawBody.confirmation_number || MOCK_CALL_RESULT.confirmation_number,
      status: rawBody.status || MOCK_CALL_RESULT.status,
    };

    // Validate using Zod
    const validatedCallResult = CallResultSchema.parse(callResult);

    // Call n8n webhook if configured
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    let n8nSuccess = false;
    let n8nResponse = null;

    if (n8nUrl) {
      try {
        const res = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validatedCallResult),
        });
        n8nSuccess = res.ok;
        n8nResponse = await res.json().catch(() => null);
      } catch (err) {
        console.error('Failed to forward to n8n:', err);
      }
    }

    return NextResponse.json({
      success: true,
      callResult: validatedCallResult,
      n8n: {
        called: !!n8nUrl,
        success: n8nSuccess,
        response: n8nResponse,
      }
    });
  } catch (error: any) {
    console.error('Error in ElevenLabs webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
