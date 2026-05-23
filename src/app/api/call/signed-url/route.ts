import { NextResponse } from 'next/server';

// Generates a signed URL for the browser ElevenLabs Conversational AI session.
// The signed URL is per-call and embeds the agent permission so the browser
// SDK doesn't need to know the API key.
//
// Usage: GET /api/call/signed-url

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID not set' },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `ElevenLabs signed-URL fetch failed (${res.status}): ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ signed_url: data.signed_url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
