import { NextRequest, NextResponse } from 'next/server';
import { PolicyMatchSchema } from '@/lib/schemas';
import { MOCK_POLICY_MATCH } from '@/lib/fallback-data';
import { GoogleGenAI } from '@google/genai';

const CLINICAL_POLICIES = [
  {
    policy_id: "ANT-PCSK9-2026",
    policy_title: "Anthem Clinical Guideline CG-DRUG-98: PCSK9 Inhibitors",
    source_url: "https://www.anthem.com/medicalpolicies/guidelines/gl_pw_d009821.htm",
    clinical_criteria: [
      "Must have a diagnosis of Heterozygous Familial Hypercholesterolemia (HeFH) OR Clinical Atherosclerotic Cardiovascular Disease (ASCVD)",
      "Must have tried and failed maximum tolerated statin therapy for at least 3 consecutive months, OR have a documented statin intolerance",
      "Must be used in combination with maximum tolerated statin therapy (unless contraindicated)"
    ],
    clauses: [
      { text: "Patient has a documented history of clinical atherosclerotic cardiovascular disease (ASCVD) OR diagnosis of heterozygous familial hypercholesterolemia (HeFH) confirmed by genetic testing or clinical criteria.", page: 2 },
      { text: "Patient has tried and failed at least 90 days of high-intensity statin therapy (atorvastatin 40-80 mg daily or rosuvastatin 20-40 mg daily) with inadequate LDL-C reduction, or has documented complete statin intolerance (e.g., severe myalgia with elevated CK).", page: 3 }
    ],
    guideline_refs: [
      { source: "ACC/AHA Cholesterol Guidelines", citation: "2018 AHA/ACC/multisociety guideline on the management of blood cholesterol" },
      { source: "NLA Scientific Statement", citation: "National Lipid Association recommendations for PCSK9 inhibitor use in patient care" }
    ]
  },
  {
    policy_id: "CIG-GLP1-2026",
    policy_title: "Cigna Coverage Policy 0543: GLP-1 Receptor Agonists",
    source_url: "https://cigna.com/static/cigna-coverage-policy-glp1.pdf",
    clinical_criteria: [
      "For Type 2 Diabetes: Patient must have documentation of HbA1c > 7.0% despite metformin trial of at least 1500mg daily for 90 days, or documented metformin contraindication.",
      "For Weight Management: Patient must have a BMI >= 30 kg/m2, or BMI >= 27 kg/m2 with at least one weight-related comorbidity (hypertension, dyslipidemia, type 2 diabetes) and has participated in a comprehensive weight management program for 6 months."
    ],
    clauses: [
      { text: "Approval requires documented diagnosis of Type 2 Diabetes Mellitus with HbA1c greater than 7.0% and therapeutic failure of metformin at maximum tolerated dose for 3 months.", page: 1 },
      { text: "For weight management indications, approval requires body mass index (BMI) of 30 kg/m2 or greater, or 27 kg/m2 or greater with at least one weight-related comorbidity, and document active lifestyle modifications for at least 6 months.", page: 4 }
    ],
    guideline_refs: [
      { source: "ADA Standards of Care", citation: "American Diabetes Association Standards of Care in Diabetes" },
      { source: "AACE Guidelines", citation: "American Association of Clinical Endocrinologists consensus statement on diabetes management" }
    ]
  },
  {
    policy_id: "BSC-DUP-2026",
    policy_title: "BSC Medical Policy: Dupixent (dupilumab)",
    source_url: "https://www.blueshieldca.com/provider/medical-policy/dupixent.pdf",
    clinical_criteria: [
      "For Moderate-to-Severe Atopic Dermatitis: Patient must have a documented baseline Eczema Area and Severity Index (EASI) score >= 16 or Investigator's Global Assessment (IGA) score >= 3.",
      "Requires trial and failure of at least one medium-to-high potency topical corticosteroid for at least 28 consecutive days, or documented contraindication."
    ],
    clauses: [
      { text: "Approval for moderate-to-severe atopic dermatitis requires baseline Eczema Area and Severity Index (EASI) score of 16 or greater or Investigator's Global Assessment (IGA) score of 3 or 4.", page: 2 },
      { text: "Patient has tried and failed at least a 28-day trial of a medium-to-high potency topical corticosteroid or has a documented contraindication to topical steroid therapy.", page: 3 }
    ],
    guideline_refs: [
      { source: "AAD Guidelines", citation: "American Academy of Dermatology guidelines of care for the management of atopic dermatitis" },
      { source: "Joint Task Force Allergy", citation: "Joint Task Force on Practice Parameters practice parameter update for atopic dermatitis" }
    ]
  }
];

export async function POST(request: NextRequest) {
  try {
    const denialLetter = await request.json().catch(() => null);

    if (!denialLetter) {
      return NextResponse.json({ error: 'Denial letter is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isDemoMode = process.env.DEMO === '1' || !apiKey;

    if (isDemoMode) {
      return NextResponse.json(MOCK_POLICY_MATCH, {
        headers: {
          'X-Lane-Source': 'demo cache',
        },
      });
    }

    // Call Gemini to match the best policy from the list
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are PriorAuth Advocate. Given this extracted Denial Letter:
${JSON.stringify(denialLetter, null, 2)}

Match it against our known clinical policies to find the most relevant one.
Here is our known clinical policy database:
${JSON.stringify(CLINICAL_POLICIES, null, 2)}

Find the policy that matches the insurer ("${denialLetter.insurer}"), plan, and service/drug ("${denialLetter.service_or_drug}").
If none matches perfectly, construct a custom PolicyMatch object based on the details in the denial letter.

CRITICAL SAFETY BOUNDARIES:
- This is administrative advocacy, not medical advice.
- Never recommend a treatment, diagnosis, dose, medication change, or clinical decision.
- Only map insurer paperwork, quote policy language, draft administrative appeal copy, and track deadlines.

Return the matching or generated PolicyMatch according to the schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ text: prompt }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            policy_id: { type: 'STRING' },
            policy_title: { type: 'STRING' },
            source_url: { type: 'STRING' },
            clinical_criteria: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
            pulled_clauses: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  page: { type: 'INTEGER' },
                },
                required: ['text', 'page'],
              },
            },
            guideline_refs: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  source: { type: 'STRING' },
                  citation: { type: 'STRING' },
                },
                required: ['source', 'citation'],
              },
            },
          },
          required: ['policy_id', 'policy_title', 'source_url', 'clinical_criteria', 'pulled_clauses', 'guideline_refs'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const parsedJson = JSON.parse(text);
    const validated = PolicyMatchSchema.parse(parsedJson);

    return NextResponse.json(validated, {
      headers: {
        'X-Lane-Source': 'live',
      },
    });
  } catch (error: any) {
    console.error('Error in policy route:', error);
    return NextResponse.json(MOCK_POLICY_MATCH, {
      headers: {
        'X-Lane-Source': 'demo cache',
        'X-Lane-Error': error.message || 'unknown',
      },
    });
  }
}
