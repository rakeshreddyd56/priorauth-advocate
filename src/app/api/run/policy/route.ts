import { NextRequest, NextResponse } from 'next/server';
import { PolicyMatchSchema } from '@/lib/schemas';
import { MOCK_POLICY_MATCH } from '@/lib/fallback-data';
import { GoogleGenAI } from '@google/genai';
import { rankPoliciesAgainst } from '@/lib/policy-corpus';
import { POLICY_SYSTEM_INSTRUCTION } from '@/lib/prompts/policy';

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
        headers: { 'X-Lane-Source': 'demo cache' },
      });
    }

    // Local RAG: rank corpus docs against the denial query, take top-1.
    // Replaces Vertex Vector Search for the hackathon demo (same shape,
    // ships in 5 hours, falls back to demo on retrieval failure).
    const query = [
      denialLetter.insurer,
      denialLetter.service_or_drug,
      denialLetter.cited_policy_section,
      denialLetter.denial_reason_text,
    ].filter(Boolean).join(' ');

    const rankings = await rankPoliciesAgainst(query);
    const top = rankings[0];

    if (!top || top.score === 0) {
      // No corpus hit — return UNKNOWN policy with the insurer's general appeals process.
      return NextResponse.json({
        policy_id: 'UNKNOWN',
        policy_title: `${denialLetter.insurer || 'Insurer'} appeals process (no policy match)`,
        source_url: '',
        clinical_criteria: ['Appeal submitted under the plan\'s general appeals procedure; specific policy bulletin could not be identified in the available corpus.'],
        pulled_clauses: [],
        guideline_refs: [],
      }, { headers: { 'X-Lane-Source': 'corpus-miss' } });
    }

    const candidate = {
      policy_id: top.doc.policy_id,
      policy_title: top.doc.policy_title,
      source_url: top.doc.source_url,
      excerpts: top.top_paragraphs.map((p, i) => ({
        excerpt_id: i + 1,
        text: p.text,
        relevance_score: p.score,
      })),
    };

    const ai = new GoogleGenAI({ apiKey });

    const userPrompt = `Extract the criteria and clauses from this insurer policy that match the denial reason. Return JSON conforming to the PolicyMatch schema.

DENIAL LETTER:
${JSON.stringify(denialLetter, null, 2)}

CANDIDATE POLICY (top match from corpus):
${JSON.stringify(candidate, null, 2)}

Use the candidate's policy_id, policy_title, and source_url as-is.
Quote clinical_criteria verbatim from the excerpts above.
For each pulled_clause, set page=1 (these come from web-scraped HTML, not paged PDFs).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      config: {
        systemInstruction: POLICY_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            policy_id: { type: 'STRING' },
            policy_title: { type: 'STRING' },
            source_url: { type: 'STRING' },
            clinical_criteria: { type: 'ARRAY', items: { type: 'STRING' } },
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
    if (!text) throw new Error('Empty response from Gemini API');

    const parsedJson = JSON.parse(text);
    const validated = PolicyMatchSchema.parse(parsedJson);

    return NextResponse.json(validated, {
      headers: {
        'X-Lane-Source': 'live',
        'X-Corpus-Hit': top.doc.policy_id,
        'X-Corpus-Score': String(top.score),
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
