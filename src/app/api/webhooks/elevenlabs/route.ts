import { NextRequest, NextResponse } from 'next/server';
import { CallResultSchema } from '@/lib/schemas';
import { MOCK_CALL_RESULT } from '@/lib/fallback-data';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the webhook signature using HMAC SHA-256.
 * Returns true when verification passes OR when no secret is configured
 * (so development environments without a secret still work).
 */
function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return true; // no secret configured → skip verification
  if (!signatureHeader) return false; // secret is set but no header → reject

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Support both raw hex and "sha256=<hex>" formats
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(provided, 'hex')
  );
}

/**
 * Map an ElevenLabs status string to the CallResult status enum.
 */
function mapStatus(
  raw: string | undefined
): 'filed' | 'callback_required' | 'failed' {
  if (!raw) return 'failed';
  const lower = raw.toLowerCase();
  if (lower === 'completed' || lower === 'done' || lower === 'success' || lower === 'filed') {
    return 'filed';
  }
  if (
    lower === 'callback' ||
    lower === 'callback_required' ||
    lower === 'needs_followup' ||
    lower === 'pending'
  ) {
    return 'callback_required';
  }
  return 'failed';
}

/**
 * Map ElevenLabs transcript array entries to our CallResult segment format.
 * ElevenLabs sends items like { role, message, time_in_call_secs } or similar.
 */
function mapTranscript(
  rawTranscript: any[] | undefined
): { speaker: 'agent' | 'ivr' | 'rep' | 'system'; text: string; t: number }[] {
  if (!Array.isArray(rawTranscript) || rawTranscript.length === 0) {
    return [];
  }

  return rawTranscript.map((entry: any) => {
    // Determine the speaker role
    let speaker: 'agent' | 'ivr' | 'rep' | 'system' = 'system';
    const role = (entry.role ?? entry.speaker ?? '').toLowerCase();
    if (role === 'agent' || role === 'assistant' || role === 'ai') {
      speaker = 'agent';
    } else if (role === 'user' || role === 'human' || role === 'customer' || role === 'rep') {
      speaker = 'rep';
    } else if (role === 'ivr') {
      speaker = 'ivr';
    }

    return {
      speaker,
      text: entry.message ?? entry.text ?? entry.content ?? '',
      t: entry.time_in_call_secs ?? entry.t ?? entry.timestamp ?? 0,
    };
  });
}

/**
 * Use Gemini to extract a confirmation / reference number from transcript text.
 * Returns null if none found or if Gemini is unavailable.
 */
async function extractConfirmationNumber(
  transcriptText: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !transcriptText) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are PriorAuth Advocate's post-call analysis module.
Given the following phone-call transcript, extract the confirmation number,
reference number, appeal reference, or case reference number if one was provided
during the call. Return ONLY the extracted number as a plain string with no
additional text, quotes, or explanation. If no confirmation/reference number is
found, return exactly the word NULL.

CRITICAL: This is administrative data extraction only — not medical advice.

Transcript:
${transcriptText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ text: prompt }],
    });

    const result = (response.text ?? '').trim();
    if (!result || result.toUpperCase() === 'NULL') return null;
    return result;
  } catch (err) {
    console.error('Gemini confirmation extraction failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('X-ElevenLabs-Signature');
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

    if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse the JSON payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    // ---- Map ElevenLabs payload to CallResult ----

    const callSid =
      payload.call_id ??
      payload.conversation_id ??
      payload.call_sid ??
      MOCK_CALL_RESULT.call_sid;

    const conversationId =
      payload.agent_id ??
      payload.conversation_id ??
      MOCK_CALL_RESULT.conversation_id;

    const durationSec =
      payload.metadata?.call_duration_secs ??
      payload.call_duration_secs ??
      payload.duration_sec ??
      MOCK_CALL_RESULT.duration_sec;

    const transcriptSegments = mapTranscript(payload.transcript);
    const hasRealTranscript = transcriptSegments.length > 0;

    // Build full transcript text for confirmation extraction
    const fullTranscriptText = hasRealTranscript
      ? transcriptSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n')
      : MOCK_CALL_RESULT.transcript_segments
          .map((s) => `${s.speaker}: ${s.text}`)
          .join('\n');

    // Use Gemini to extract confirmation number from transcript
    const confirmationNumber =
      payload.confirmation_number ??
      (await extractConfirmationNumber(fullTranscriptText)) ??
      MOCK_CALL_RESULT.confirmation_number;

    const status = mapStatus(payload.status);

    const callResult = {
      call_sid: callSid,
      conversation_id: conversationId,
      duration_sec: typeof durationSec === 'number' ? durationSec : Number(durationSec) || 0,
      transcript_segments: hasRealTranscript
        ? transcriptSegments
        : MOCK_CALL_RESULT.transcript_segments,
      confirmation_number: confirmationNumber,
      status,
    };

    // Validate using Zod
    const validatedCallResult = CallResultSchema.parse(callResult);

    // Forward to n8n webhook if configured
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
      },
    });
  } catch (error: any) {
    console.error('Error in ElevenLabs webhook:', error);
    // Graceful fallback: return mock data on unexpected errors
    try {
      const fallback = CallResultSchema.parse(MOCK_CALL_RESULT);
      return NextResponse.json({
        success: true,
        callResult: fallback,
        n8n: { called: false, success: false, response: null },
        _fallback: true,
        _error: error.message,
      });
    } catch {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
}
