import { NextRequest, NextResponse } from 'next/server';
import { AppealLetterSchema } from '@/lib/schemas';
import { MOCK_APPEAL_LETTER } from '@/lib/fallback-data';
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini';
import { DRAFTING_SYSTEM_INSTRUCTION } from '@/lib/prompts/drafting';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.denial || !body.policy) {
      return NextResponse.json({ error: 'denial and policy are required' }, { status: 400 });
    }

    const { denial, policy, clinical_evidence } = body;
    const apiKey = process.env.GEMINI_API_KEY;
    const isDemoMode = process.env.DEMO === '1' || !apiKey;

    if (isDemoMode) {
      return NextResponse.json(MOCK_APPEAL_LETTER, {
        headers: {
          'X-Lane-Source': 'demo cache',
        },
      });
    }

    const ai = getGeminiClient();

    const userPrompt = `Draft an administrative appeal letter for the following.

DENIAL LETTER:
${JSON.stringify(denial, null, 2)}

MATCHED POLICY:
${JSON.stringify(policy, null, 2)}
${clinical_evidence ? `

CLINICAL EVIDENCE (corroborated via Cloud Healthcare API FHIR R4):
${JSON.stringify(clinical_evidence, null, 2)}` : ''}

Use the patient's initials from denial.patient_name_redacted (e.g. "R. R.") in the letter subject and body. Cite at least one clinical_criteria item verbatim from the matched policy. If clinical evidence is present, reference the corroborated fact ("documented in the patient's medical record via the prescribing physician's EHR — Cloud Healthcare API FHIR R4").`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: DRAFTING_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            to_address: { type: 'STRING' },
            subject: { type: 'STRING' },
            body_markdown: { type: 'STRING' },
            citations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  source: { type: 'STRING' },
                  claim: { type: 'STRING' },
                },
                required: ['source', 'claim'],
              },
            },
            short_summary_for_voice: { type: 'STRING' },
            win_probability: { type: 'NUMBER' },
          },
          required: ['to_address', 'subject', 'body_markdown', 'citations', 'short_summary_for_voice', 'win_probability'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const parsedJson = JSON.parse(text);
    const validated = AppealLetterSchema.parse(parsedJson);

    return NextResponse.json(validated, {
      headers: {
        'X-Lane-Source': 'live',
      },
    });
  } catch (error: any) {
    console.error('Error in draft route:', error);
    return NextResponse.json(MOCK_APPEAL_LETTER, {
      headers: {
        'X-Lane-Source': 'demo cache',
        'X-Lane-Error': error.message || 'unknown',
      },
    });
  }
}
