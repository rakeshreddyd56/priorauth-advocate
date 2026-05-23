import { NextRequest, NextResponse } from 'next/server';
import { DenialLetterSchema } from '@/lib/schemas';
import { MOCK_DENIAL_LETTER } from '@/lib/fallback-data';
import { INTAKE_SYSTEM_INSTRUCTION } from '@/lib/prompts/intake';
import { verifyEnv } from '@/lib/env';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: NextRequest) {
  // Check required environment variables
  const envCheck = verifyEnv(["GEMINI_API_KEY"]);
  if (!envCheck.ok) {
    return NextResponse.json({
      error: "Missing required environment variables for Intake route",
      missing: envCheck.missing
    }, { status: 503 });
  }

  try {
    const isDemoMode = process.env.DEMO === '1';
    
    // Parse request content
    const contentType = request.headers.get('content-type') || '';
    let imageBase64: string | null = null;
    let imageMimeType: string | null = null;
    let rawText: string | null = null;
    let useSample = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageBase64 = buffer.toString('base64');
        imageMimeType = file.type;
      }
      rawText = formData.get('raw_text') as string | null;
      useSample = formData.get('useSample') === 'true';
    } else {
      const body = await request.json().catch(() => ({}));
      useSample = !!body.useSample;
      
      if (body.image) {
        if (body.image.includes('base64,')) {
          const parts = body.image.split(';base64,');
          imageMimeType = parts[0].split(':')[1];
          imageBase64 = parts[1];
        } else {
          imageBase64 = body.image;
          imageMimeType = 'image/jpeg';
        }
      } else if (body.image_url) {
        try {
          const res = await fetch(body.image_url);
          const buffer = Buffer.from(await res.arrayBuffer());
          imageBase64 = buffer.toString('base64');
          imageMimeType = res.headers.get('content-type') || 'image/jpeg';
        } catch (err) {
          console.error("Failed to fetch image_url:", err);
        }
      }
      rawText = body.raw_text;
    }

    // Short-circuit to fallback-data.ts if DEMO=1 OR useSample is true
    if (isDemoMode || useSample) {
      return NextResponse.json(MOCK_DENIAL_LETTER, {
        headers: { 'X-Lane-Source': 'demo cache' },
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let contents: any[] = [];

    if (imageBase64 && imageMimeType) {
      contents.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64,
        },
      });
    } else if (rawText) {
      contents.push({
        text: `Extract denial fields from the following letter text:\n\n${rawText}`,
      });
    } else {
      return NextResponse.json({ error: "Missing image or raw_text input" }, { status: 400 });
    }

    const responseSchema = {
      type: "OBJECT",
      properties: {
        patient_name_redacted: { type: "STRING" },
        member_id: { type: "STRING" },
        insurer: { type: "STRING" },
        plan_name: { type: "STRING" },
        service_or_drug: { type: "STRING" },
        denial_reason_code: { type: "STRING" },
        denial_reason_text: { type: "STRING" },
        cited_policy_section: { type: "STRING" },
        appeal_deadline_iso: { type: "STRING" },
        contact_phone: { type: "STRING" },
        raw_text: { type: "STRING" },
        confidences: {
          type: "OBJECT",
          properties: {
            patient_name_redacted: { type: "NUMBER" },
            member_id: { type: "NUMBER" },
            insurer: { type: "NUMBER" },
            plan_name: { type: "NUMBER" },
            service_or_drug: { type: "NUMBER" },
            denial_reason_code: { type: "NUMBER" },
            denial_reason_text: { type: "NUMBER" },
            cited_policy_section: { type: "NUMBER" },
            appeal_deadline_iso: { type: "NUMBER" },
            contact_phone: { type: "NUMBER" }
          },
          required: [
            "patient_name_redacted", "member_id", "insurer", "plan_name",
            "service_or_drug", "denial_reason_code", "denial_reason_text",
            "cited_policy_section", "appeal_deadline_iso", "contact_phone"
          ]
        }
      },
      required: [
        "patient_name_redacted", "member_id", "insurer", "plan_name",
        "service_or_drug", "denial_reason_code", "denial_reason_text",
        "cited_policy_section", "appeal_deadline_iso", "contact_phone", "raw_text", "confidences"
      ]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: INTAKE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedJson = JSON.parse(text);
    
    // Ensure raw_text is filled if Gemini returned empty
    if (!parsedJson.raw_text && rawText) {
      parsedJson.raw_text = rawText;
    }

    // Validate using Zod
    const validated = DenialLetterSchema.parse(parsedJson);

    // Check confidences on required non-null fields
    if (validated.confidences) {
      const lowConfidenceFields: string[] = [];
      const requiredFields = [
        "patient_name_redacted", "member_id", "insurer", "service_or_drug",
        "denial_reason_text", "cited_policy_section", "appeal_deadline_iso", "contact_phone"
      ];

      for (const field of requiredFields) {
        const val = (validated as any)[field];
        const confidence = (validated.confidences as any)[field];
        if (val !== null && (confidence === undefined || confidence < 0.6)) {
          lowConfidenceFields.push(field);
        }
      }

      if (lowConfidenceFields.length > 0) {
        return NextResponse.json({
          needs_retry: true,
          partial: validated,
          low_confidence_fields: lowConfidenceFields
        }, { status: 422 }); // Unprocessable Entity
      }
    }

    return NextResponse.json(validated, {
      headers: { 'X-Lane-Source': 'live' }
    });
  } catch (error: any) {
    console.error("Intake lane error:", error);
    return NextResponse.json({ error: error.message || 'Intake failed' }, { status: 500 });
  }
}
