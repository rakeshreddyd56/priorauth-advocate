const REQUIRED_VARS = [
  "GEMINI_API_KEY",
  "GOOGLE_PROJECT_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "VERTEX_LOCATION",
  "VERTEX_VECTOR_INDEX_ID",
  "VERTEX_VECTOR_ENDPOINT_ID",
  "HEALTHCARE_DATASET",
  "HEALTHCARE_FHIR_STORE",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_AGENT_ID",
  "ELEVENLABS_PHONE_NUMBER_ID",
  "ELEVENLABS_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "N8N_WEBHOOK_URL",
  "N8N_WEBHOOK_SECRET",
  "DEMO"
];

let logged = false;

export function logEnvStatus() {
  if (logged) return;
  const status = REQUIRED_VARS.map(v => `${v}=${process.env[v] ? 'SET' : 'MISSING'}`).join(', ');
  console.log(`[ENV BOOT STATUS] ${status}`);
  logged = true;
}

// Perform boot check once in server environments
if (typeof window === 'undefined') {
  logEnvStatus();
}

export function verifyEnv(vars: string[]): { ok: boolean; missing: string[] } {
  const missing = vars.filter(v => !process.env[v]);
  return {
    ok: missing.length === 0,
    missing
  };
}
