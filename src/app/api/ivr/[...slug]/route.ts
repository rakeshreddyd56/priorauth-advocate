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

  if (path === 'start' || path === 'answer') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Thank you for calling Aetna member services. For benefits, press 1. For claims, press 2. For prior authorization appeals, press 3.</Say>
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
  <Say voice="Polly.Amy-Neural">Connecting you to a prior authorization appeals specialist. Please describe the appeal in thirty seconds, beginning after the tone.</Say>
  <Record maxLength="30" playBeep="true" action="/api/ivr/confirmation" method="POST"/>
</Response>`;
  } else if (path === 'confirmation') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Thank you. Your appeal has been recorded. Your confirmation number is: A 4 dash 7 8 2 1. Again, that is Alpha 4 dash 7 8 2 1. A representative will follow up within thirty days. Goodbye.</Say>
  <Hangup/>
</Response>`;
  } else {
    // Default fallback
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural">Welcome to Aetna member services. Your call has been successfully routed.</Say>
  <Hangup/>
</Response>`;
  }

  return new Response(twiml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
