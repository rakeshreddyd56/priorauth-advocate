import { NextRequest, NextResponse } from 'next/server';
import { MOCK_CALL_RESULT } from '@/lib/fallback-data';
import { verifyEnv } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { voiceScript, denialLetter } = body;

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

      // Extract the customer phone from the denial letter
      const customerPhone = denialLetter?.contact_phone;
      if (!customerPhone) {
        return NextResponse.json(
          { error: 'denialLetter.contact_phone is required for live calls' },
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
        customer_phone_number: customerPhone,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
        },
      };

      try {
        const res = await fetch(
          'https://api.elevenlabs.io/v1/convai/conversations/create-phone-call',
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

        return NextResponse.json({
          call_sid: data.call_sid ?? data.phone_call_id ?? `CA-${Date.now()}`,
          conversation_id: data.conversation_id ?? data.agent_id ?? agentId,
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
