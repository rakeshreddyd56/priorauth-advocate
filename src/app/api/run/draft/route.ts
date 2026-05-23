import { NextRequest, NextResponse } from 'next/server';
import { AppealLetterSchema } from '@/lib/schemas';
import { MOCK_APPEAL_LETTER } from '@/lib/fallback-data';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.denial || !body.policy) {
      return NextResponse.json({ error: 'denial and policy are required' }, { status: 400 });
    }

    const { denial, policy } = body;
    const apiKey = process.env.GEMINI_API_KEY;
    const isDemoMode = process.env.DEMO === '1' || !apiKey;

    if (isDemoMode) {
      return NextResponse.json(MOCK_APPEAL_LETTER, {
        headers: {
          'X-Lane-Source': 'demo cache',
        },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are PriorAuth Advocate. Draft a formal administrative appeal letter.
Inputs:
- Denial Letter: ${JSON.stringify(denial, null, 2)}
- Matched Policy: ${JSON.stringify(policy, null, 2)}

Requirements for the Appeal Letter:
1. to_address: Address the appeal to the insurer's prior authorization appeals division. Use details from the denial letter.
2. subject: Clear subject line with patient initials (e.g. S. Jenkins), member ID, and drug/service.
3. body_markdown: Formatted markdown letter appealing the denial. Ensure it quotes policy sections and states how the exception criteria are satisfied (e.g., patient has a documented statin intolerance/contraindication, or metformin intolerance, etc.). Keep the patient's name redacted to initials (e.g., S. Jenkins) inside the letter text.
4. citations: List specific citations mapping arguments to either policy pages or medical documentation.
5. short_summary_for_voice: A concise 30-40 second read summarizing the appeal grounds. This will be used by our phone filing agent.
6. win_probability: A float between 0.0 and 1.0 indicating the strength of the appeal based on the matches.

CRITICAL SAFETY BOUNDARIES:
- This is administrative advocacy, not medical advice.
- Never recommend a treatment, diagnosis, dose, medication change, or clinical decision.
- The physician already prescribed the care. The system only reads insurer paperwork, quotes policy language, drafts administrative appeal copy, files the appeal, and tracks deadlines.
- Never say "AI doctor", "diagnose", "treatment recommendation", or "replace your physician" in the generated text.

Format the response according to the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ text: prompt }],
      config: {
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
