import { NextRequest, NextResponse } from 'next/server';
import { VoiceScriptSchema } from '@/lib/schemas';
import { MOCK_VOICE_SCRIPT } from '@/lib/fallback-data';
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini';
import { VOICE_PREP_SYSTEM_INSTRUCTION } from '@/lib/prompts/voice-prep';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.denial || !body.appeal) {
      return NextResponse.json({ error: 'denial and appeal are required' }, { status: 400 });
    }

    const { denial, appeal } = body;
    const apiKey = process.env.GEMINI_API_KEY;
    const isDemoMode = process.env.DEMO === '1' || !apiKey;

    if (isDemoMode) {
      return NextResponse.json(MOCK_VOICE_SCRIPT, {
        headers: {
          'X-Lane-Source': 'demo cache',
        },
      });
    }

    const ai = getGeminiClient();

    // Derive last 4 of member_id
    const memberId = denial.member_id || '';
    const last4 = memberId.length > 4 ? memberId.substring(memberId.length - 4) : memberId;

    const prompt = `You are PriorAuth Advocate. Generate a voice script for filing a prior authorization appeal over the phone.
Inputs:
- Denial Letter: ${JSON.stringify(denial, null, 2)}
- Appeal Letter: ${JSON.stringify(appeal, null, 2)}

Requirements:
1. call_goal: Brief summary of what this phone call should achieve.
2. opening_line: Professional introduction line for a phone representative.
3. verification_fields: Patient details including:
   - patient_name_redacted: Initials only (e.g. S. Jenkins)
   - member_id_last4: Last 4 digits of the member ID (which is ${last4})
   - service_or_drug: ${denial.service_or_drug}
   - insurer: ${denial.insurer}
4. ivr_strategy: Steps to navigate the insurer's automated IVR menus.
5. appeal_summary_30_sec: A 30-second speech summary emphasizing why this meets the policy criteria exception (e.g., severe rhabdomyolysis or complete statin intolerance).
6. forbidden_phrases: Phrases that MUST NOT be spoken because they violate the safety boundary (e.g. "I diagnose", "clinical recommendations", "treatment suggestion", "replace your doctor").
7. max_call_duration_sec: Time budget in seconds (e.g. 180).

CRITICAL SAFETY BOUNDARIES:
- This is administrative advocacy, not medical advice.
- Never recommend a treatment, diagnosis, dose, medication change, or clinical decision.
- Only quote policies and file administrative appeals.
- Never suggest clinical decisions.
- Do NOT say "AI doctor", "diagnose", "treatment recommendation", or "replace your physician".

Format the response according to the schema.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: VOICE_PREP_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            call_goal: { type: 'STRING' },
            opening_line: { type: 'STRING' },
            verification_fields: {
              type: 'OBJECT',
              properties: {
                patient_name_redacted: { type: 'STRING', nullable: true },
                member_id_last4: { type: 'STRING', nullable: true },
                service_or_drug: { type: 'STRING', nullable: true },
                insurer: { type: 'STRING', nullable: true },
              },
              required: ['patient_name_redacted', 'member_id_last4', 'service_or_drug', 'insurer'],
            },
            ivr_strategy: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
            appeal_summary_30_sec: { type: 'STRING' },
            forbidden_phrases: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
            max_call_duration_sec: { type: 'INTEGER' },
          },
          required: ['call_goal', 'opening_line', 'verification_fields', 'ivr_strategy', 'appeal_summary_30_sec', 'forbidden_phrases', 'max_call_duration_sec'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const parsedJson = JSON.parse(text);
    const validated = VoiceScriptSchema.parse(parsedJson);

    return NextResponse.json(validated, {
      headers: {
        'X-Lane-Source': 'live',
      },
    });
  } catch (error: any) {
    console.error('Error in voice-script route:', error);
    return NextResponse.json(MOCK_VOICE_SCRIPT, {
      headers: {
        'X-Lane-Source': 'demo cache',
        'X-Lane-Error': error.message || 'unknown',
      },
    });
  }
}
