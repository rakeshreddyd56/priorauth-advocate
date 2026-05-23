import { NextRequest, NextResponse } from 'next/server';

// Mock IVR endpoint to return TwiML for Twilio voice integrations
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleIvr(request, params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleIvr(request, params);
}

async function handleIvr(request: NextRequest, paramsPromise: Promise<{ slug: string[] }>) {
  const { slug } = await paramsPromise;
  const path = slug.join('/');

  let twiml = '';

  if (path === 'start') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Thank you for calling Anthem Blue Cross. For member services, press 1. For provider prior authorization appeals, press 2.</Say>
  <Gather numDigits="1" action="/api/ivr/provider-menu" method="POST" timeout="10"/>
</Response>`;
  } else if (path === 'provider-menu') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Please enter the 9-digit Member Identification Number, excluding the three-letter prefix, followed by the pound sign.</Say>
  <Gather numDigits="10" finishOnKey="#" action="/api/ivr/member-verify" method="POST" timeout="15"/>
</Response>`;
  } else if (path === 'member-verify') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Thank you. For prior authorization, press 4. For claims, press 5.</Say>
  <Gather numDigits="1" action="/api/ivr/prior-auth" method="POST" timeout="10"/>
</Response>`;
  } else if (path === 'prior-auth') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Connecting you to a Prior Authorization Specialist. Please hold.</Say>
  <Play>http://demo.twilio.com/docs/classic.mp3</Play>
</Response>`;
  } else {
    // Default fallback
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Welcome to Anthem Blue Cross. Your call has been successfully routed.</Say>
  <Hangup/>
</Response>`;
  }

  return new Response(twiml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
