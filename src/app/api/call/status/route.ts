import { NextRequest, NextResponse } from 'next/server';
import { recallCallResult } from '@/lib/call-store';

// Frontend polls this endpoint after firing /api/call/start.
// Returns the CallResult when the ElevenLabs post-call webhook has fired,
// or 404 if the call is still in flight.
//
// Usage: GET /api/call/status?id=<conversation_id_or_call_sid>

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Missing ?id query parameter (conversation_id or call_sid)' },
      { status: 400 }
    );
  }

  const result = recallCallResult(id);
  if (!result) {
    return NextResponse.json(
      { status: 'pending', message: 'Call result not yet received from ElevenLabs webhook.' },
      { status: 202 }
    );
  }

  return NextResponse.json({ status: 'completed', callResult: result });
}
