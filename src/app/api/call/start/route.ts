import { NextRequest, NextResponse } from 'next/server';
import { MOCK_CALL_RESULT } from '@/lib/fallback-data';
import { verifyEnv } from '@/lib/env';
import { rememberCallResult, rememberCallContext } from '@/lib/call-store';
import { CallResultSchema } from '@/lib/schemas';

// Canonical simulated call result for the stage-fallback path.
// Same shape ElevenLabs's webhook would return — UI flow is identical.
const SIMULATED_CALL_RESULT = {
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
    { speaker: 'rep' as const, text: "That's correct. Written confirmation will be sent to the address on file within forty-eight hours.", t: 35 },
    { speaker: 'agent' as const, text: 'Thank you. Goodbye.', t: 37 },
  ],
  confirmation_number: 'A4-7821',
  status: 'filed' as const,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { voiceScript, denialLetter } = body;

    // Stage-fallback short-circuit: when DEMO_FORCE_SIMULATE=1, skip
    // ElevenLabs entirely and inject the canonical CallResult into the
    // call-store. The frontend's normal poll picks it up.
    if (process.env.DEMO_FORCE_SIMULATE === '1') {
      const conversationId = `conv-sim-${Date.now()}`;
      const result = { ...SIMULATED_CALL_RESULT, conversation_id: conversationId };
      const validated = CallResultSchema.parse(result);
      rememberCallResult(conversationId, validated);
      return NextResponse.json({
        call_sid: validated.call_sid,
        conversation_id: conversationId,
        status: 'simulated',
        message: 'Stage-fallback simulated call. Same UI flow, no live dial.',
        live: false,
        simulated: true,
      });
    }

    // Check required ElevenLabs env vars
    const envCheck = verifyEnv([
      'ELEVENLABS_API_KEY',
      'ELEVENLABS_AGENT_ID',
      'ELEVENLABS_PHONE_NUMBER_ID',
    ]);
    const isDemoMode = !envCheck.ok || process.env.DEMO === '1';

    if (!isDemoMode) {
      const apiKey = process.env.ELEVENLABS_API_KEY!;
      const agentId = process.env.ELEVENLABS_AGENT_ID!;
      const agentPhoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID!;

      // Pick the target phone number.
      // DEMO_CALL_TARGET_PHONE overrides denialLetter.contact_phone — used when
      // dialing a real human on stage (Twilio trial accounts are limited to
      // one number, so the agent can't call its own Twilio IVR). In production,
      // remove DEMO_CALL_TARGET_PHONE and the call dials the insurer line.
      const customerPhone = process.env.DEMO_CALL_TARGET_PHONE || denialLetter?.contact_phone;
      if (!customerPhone) {
        return NextResponse.json(
          { error: 'No target phone — set DEMO_CALL_TARGET_PHONE env var or supply denialLetter.contact_phone' },
          { status: 400 }
        );
      }

      // Build dynamic variables for the ElevenLabs conversational agent
      const dynamicVariables: Record<string, string> = {
        opening_line: voiceScript?.opening_line ?? '',
        appeal_summary: voiceScript?.appeal_summary_30_sec ?? '',
        member_id: denialLetter?.member_id ?? '',
        service_or_drug: denialLetter?.service_or_drug ?? '',
        patient_name: denialLetter?.patient_name_redacted ?? '',
        insurer: denialLetter?.insurer ?? '',
      };

      const elevenLabsPayload = {
        agent_id: agentId,
        agent_phone_number_id: agentPhoneNumberId,
        to_number: customerPhone,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
        },
      };

      try {
        const res = await fetch(
          'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(elevenLabsPayload),
          }
        );

        if (!res.ok) {
          const errBody = await res.text().catch(() => 'unknown error');
          console.error(
            `ElevenLabs API error (${res.status}): ${errBody}`
          );
          // Fall through to demo fallback on API error
          return NextResponse.json(
            {
              call_sid: MOCK_CALL_RESULT.call_sid,
              conversation_id: MOCK_CALL_RESULT.conversation_id,
              status: 'queued',
              message: `ElevenLabs API error (${res.status}). Falling back to demo mode.`,
              live: false,
            },
            {
              headers: {
                'X-Lane-Source': 'demo cache',
                'X-Lane-Error': `elevenlabs-${res.status}`,
              },
            }
          );
        }

        const data = await res.json();
        const callSidOut = data.call_sid ?? data.phone_call_id ?? `CA-${Date.now()}`;
        const convIdOut = data.conversation_id ?? data.agent_id ?? agentId;

        // Persist DenialLetter context so the post-call webhook can enrich
        // the CallResult forwarded to n8n with patient/policy/drug details.
        rememberCallContext(convIdOut, { denialLetter, voiceScript });
        if (callSidOut) rememberCallContext(callSidOut, { denialLetter, voiceScript });

        return NextResponse.json({
          call_sid: callSidOut,
          conversation_id: convIdOut,
          status: data.status ?? 'initiated',
          message: 'ElevenLabs outbound call initiated successfully.',
          live: true,
        });
      } catch (fetchError: any) {
        console.error('ElevenLabs fetch failed:', fetchError);
        // Graceful fallback to demo on network errors
        return NextResponse.json(
          {
            call_sid: MOCK_CALL_RESULT.call_sid,
            conversation_id: MOCK_CALL_RESULT.conversation_id,
            status: 'queued',
            message: `Network error reaching ElevenLabs. Falling back to demo mode.`,
            live: false,
          },
          {
            headers: {
              'X-Lane-Source': 'demo cache',
              'X-Lane-Error': fetchError.message ?? 'network-error',
            },
          }
        );
      }
    }

    // Default DEMO fallback
    return NextResponse.json({
      call_sid: MOCK_CALL_RESULT.call_sid,
      conversation_id: MOCK_CALL_RESULT.conversation_id,
      status: 'queued',
      message: 'Call queued (Demo Mode). Use webhook trigger to finalize.',
      live: false,
    });
  } catch (error: any) {
    console.error('Error in call/start route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
