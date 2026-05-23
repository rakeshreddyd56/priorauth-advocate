import { GoogleGenAI } from '@google/genai';

/**
 * Shared Gemini client.
 *
 * Routes all Gemini 3.5 Flash calls through **Vertex AI**, not the AI Studio
 * generativelanguage endpoint. This means:
 *
 *   • Every call hits aiplatform.googleapis.com under project
 *     $GOOGLE_PROJECT_ID, region $VERTEX_LOCATION
 *   • Auth via Application Default Credentials (no API key on the wire)
 *   • Calls are logged in Cloud Logging under the project's audit log
 *   • Compliant with the iam.disableServiceAccountKeyCreation org policy
 *
 * If GOOGLE_PROJECT_ID isn't set, falls back to AI Studio (for local dev
 * without GCP setup).
 *
 * The agent topology — orchestrator + 5 sub-agents with strict Zod contracts
 * and parallel fan-out — is the Google managed-agents pattern. Vertex AI is
 * the runtime; the agents are defined in src/app/api/run/* with prompts in
 * src/lib/prompts/*.
 */
export function getGeminiClient(): GoogleGenAI {
  const project = process.env.GOOGLE_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || 'us-central1';

  if (project) {
    // Vertex AI mode — uses ADC, no API key on the wire
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }

  // Local-dev fallback to AI Studio
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export const GEMINI_MODEL = 'gemini-3.5-flash';
