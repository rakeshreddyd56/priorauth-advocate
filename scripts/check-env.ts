#!/usr/bin/env node
/**
 * Check environment variable coverage for PriorAuth Advocate.
 * Run: npx tsx scripts/check-env.ts
 */
import 'dotenv/config';

interface EnvVar {
  name: string;
  required: boolean;
  used_by: string;
  setup_hint?: string;
}

const ENV_VARS: EnvVar[] = [
  // Reasoning
  { name: 'GEMINI_API_KEY', required: true, used_by: 'Intake, Policy, Drafting, Voice-Prep',
    setup_hint: 'aistudio.google.com → API keys → Create' },
  { name: 'GOOGLE_PROJECT_ID', required: false, used_by: 'Clinical Evidence (live), Vertex Vector Search' },
  { name: 'GOOGLE_APPLICATION_CREDENTIALS', required: false, used_by: 'Clinical Evidence (live)',
    setup_hint: 'gcloud iam service-accounts keys create ~/priorauth-sa-key.json --iam-account=...' },
  { name: 'VERTEX_LOCATION', required: false, used_by: 'Clinical Evidence, Vertex Vector Search' },
  { name: 'VERTEX_VECTOR_INDEX_ID', required: false, used_by: 'Policy (live Vertex mode)' },
  { name: 'VERTEX_VECTOR_ENDPOINT_ID', required: false, used_by: 'Policy (live Vertex mode)' },
  { name: 'HEALTHCARE_DATASET', required: false, used_by: 'Clinical Evidence (live FHIR)' },
  { name: 'HEALTHCARE_FHIR_STORE', required: false, used_by: 'Clinical Evidence (live FHIR)' },

  // Voice
  { name: 'ELEVENLABS_API_KEY', required: true, used_by: 'Voice Execution',
    setup_hint: 'elevenlabs.io → Profile → API keys' },
  { name: 'ELEVENLABS_AGENT_ID', required: true, used_by: 'Voice Execution',
    setup_hint: 'elevenlabs.io → Conversational AI → your agent → Settings' },
  { name: 'ELEVENLABS_PHONE_NUMBER_ID', required: true, used_by: 'Voice Execution',
    setup_hint: 'elevenlabs.io → Phone Numbers → import Twilio number' },
  { name: 'ELEVENLABS_WEBHOOK_SECRET', required: false, used_by: 'Webhook signature verification' },
  { name: 'TWILIO_ACCOUNT_SID', required: false, used_by: 'Twilio fake-IVR' },
  { name: 'TWILIO_AUTH_TOKEN', required: false, used_by: 'Twilio fake-IVR' },
  { name: 'TWILIO_FROM_NUMBER', required: false, used_by: 'Twilio outbound' },

  // Tracking
  { name: 'N8N_WEBHOOK_URL', required: false, used_by: 'Tracking handoff',
    setup_hint: 'n8n → workflow → Webhook node → copy URL' },
  { name: 'N8N_WEBHOOK_SECRET', required: false, used_by: 'Tracking auth' },

  // Mode
  { name: 'DEMO', required: false, used_by: 'Demo short-circuit (1 = mock Intake, all other lanes live)' },
];

const padded = (s: string, n: number) => s.padEnd(n).slice(0, n);

function main() {
  console.log('\n🔍 PriorAuth Advocate — env check\n');

  const grouped = {
    SET: [] as EnvVar[],
    MISSING_REQUIRED: [] as EnvVar[],
    MISSING_OPTIONAL: [] as EnvVar[],
  };

  for (const v of ENV_VARS) {
    if (process.env[v.name]) {
      grouped.SET.push(v);
    } else if (v.required) {
      grouped.MISSING_REQUIRED.push(v);
    } else {
      grouped.MISSING_OPTIONAL.push(v);
    }
  }

  console.log(`✅ SET (${grouped.SET.length}):`);
  for (const v of grouped.SET) {
    console.log(`   ${padded(v.name, 36)} ${v.used_by}`);
  }

  if (grouped.MISSING_REQUIRED.length > 0) {
    console.log(`\n❌ MISSING REQUIRED (${grouped.MISSING_REQUIRED.length}):`);
    for (const v of grouped.MISSING_REQUIRED) {
      console.log(`   ${padded(v.name, 36)} ${v.used_by}`);
      if (v.setup_hint) console.log(`     → ${v.setup_hint}`);
    }
  }

  if (grouped.MISSING_OPTIONAL.length > 0) {
    console.log(`\n⚠️  MISSING OPTIONAL (${grouped.MISSING_OPTIONAL.length}) — lanes will fall back to scaffold/mock:`);
    for (const v of grouped.MISSING_OPTIONAL) {
      console.log(`   ${padded(v.name, 36)} ${v.used_by}`);
    }
  }

  const overallOk = grouped.MISSING_REQUIRED.length === 0;
  console.log(`\n${overallOk ? '✅' : '❌'} Overall: ${overallOk ? 'OK' : 'MISSING REQUIRED VARS'}\n`);

  process.exit(overallOk ? 0 : 1);
}

main();
