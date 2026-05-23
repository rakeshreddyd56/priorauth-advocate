import { NextRequest, NextResponse } from 'next/server';
import { DenialLetterSchema } from '@/lib/schemas';
import { MOCK_DENIAL_LETTER } from '@/lib/fallback-data';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { image, useSample } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    const isDemoMode = process.env.DEMO === '1' || !apiKey;

    if (isDemoMode || useSample) {
      // Return mock data with demo cache header
      return NextResponse.json(MOCK_DENIAL_LETTER, {
        headers: {
          'X-Lane-Source': 'demo cache',
        },
      });
    }

    // Live OCR using @google/genai
    const ai = new GoogleGenAI({ apiKey });
    
    // Extract base64 details
    let contents: any[] = [];
    if (image && image.includes('base64,')) {
      const parts = image.split(';base64,');
      const mimeType = parts[0].split(':')[1];
      const base64Data = parts[1];
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    } else {
      // If no image, run on raw_text if provided, or default to mock
      if (body.raw_text) {
        contents.push({ text: `Analyze the following denial letter text:\n\n${body.raw_text}` });
      } else {
        return NextResponse.json(MOCK_DENIAL_LETTER, {
          headers: { 'X-Lane-Source': 'demo cache' },
        });
      }
    }

    const prompt = `You are PriorAuth Advocate. Analyze this health insurance denial letter.
Extract the administrative fields according to the requested schema.

CRITICAL SAFETY BOUNDARIES:
- This is administrative advocacy, not medical advice.
- Never recommend a treatment, diagnosis, dose, medication change, or clinical decision.
- The physician already prescribed the care. The system only reads insurer paperwork, quotes policy language, drafts administrative appeal copy, files the appeal, and tracks deadlines.
- Do NOT suggest any clinical alterations.
- Redact the patient's full name to initials/last name (e.g. S. Jenkins instead of Sarah Jenkins) for the patient_name_redacted field.

Extract the following:
1. patient_name_redacted: string or null
2. member_id: string or null
3. insurer: string or null
4. plan_name: string or null
5. service_or_drug: string or null
6. denial_reason_code: string or null
7. denial_reason_text: string or null
8. cited_policy_section: string or null
9. appeal_deadline_iso: string (ISO 8601 date, or null if not found)
10. contact_phone: string or null
11. raw_text: string (full text extracted)`;

    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            patient_name_redacted: { type: 'STRING' },
            member_id: { type: 'STRING' },
            insurer: { type: 'STRING' },
            plan_name: { type: 'STRING' },
            service_or_drug: { type: 'STRING' },
            denial_reason_code: { type: 'STRING' },
            denial_reason_text: { type: 'STRING' },
            cited_policy_section: { type: 'STRING' },
            appeal_deadline_iso: { type: 'STRING' },
            contact_phone: { type: 'STRING' },
            raw_text: { type: 'STRING' },
          },
          required: ['raw_text'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const parsedJson = JSON.parse(text);
    const validated = DenialLetterSchema.parse(parsedJson);

    return NextResponse.json(validated, {
      headers: {
        'X-Lane-Source': 'live',
      },
    });
  } catch (error: any) {
    console.error('Error in intake route:', error);
    // Fall back to mock if there is any error parsing or calling Gemini
    return NextResponse.json(MOCK_DENIAL_LETTER, {
      headers: {
        'X-Lane-Source': 'demo cache',
        'X-Lane-Error': error.message || 'unknown',
      },
    });
  }
}
