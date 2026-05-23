#!/usr/bin/env node
/**
 * End-to-end pipeline test against the dev server.
 * Run: npm run dev (in one terminal), then npx tsx scripts/test-pipeline.ts
 */
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface Result { lane: string; pass: boolean; ms: number; detail: string; }

async function post(url: string, body: any): Promise<{ status: number; body: any; ms: number }> {
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - start;
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, ms };
}

async function main() {
  const results: Result[] = [];

  console.log('\n🧪 Test pipeline — base URL:', BASE);

  // 1. Intake (sample mode, no photo)
  const r1 = await post(`${BASE}/api/run/intake`, { useSample: true });
  const intakeOk = r1.status === 200 && r1.body?.insurer && r1.body?.service_or_drug;
  results.push({ lane: 'Intake', pass: !!intakeOk, ms: r1.ms, detail: intakeOk ? r1.body.service_or_drug : `status=${r1.status}` });

  if (!intakeOk) {
    console.log('❌ Intake failed; aborting downstream tests');
    print(results);
    process.exit(1);
  }

  const denial = r1.body;

  // 2. Policy
  const r2 = await post(`${BASE}/api/run/policy`, denial);
  const policyOk = r2.status === 200 && r2.body?.policy_id && Array.isArray(r2.body?.clinical_criteria);
  results.push({ lane: 'Policy', pass: !!policyOk, ms: r2.ms, detail: policyOk ? r2.body.policy_id : `status=${r2.status}` });

  // 3. Clinical Evidence
  const r3 = await post(`${BASE}/api/run/clinical-evidence`, denial);
  const ceOk = r3.status === 200 && r3.body?.fhir_patient_id && Array.isArray(r3.body?.corroborated_facts);
  results.push({ lane: 'Clinical Evidence', pass: !!ceOk, ms: r3.ms, detail: ceOk ? `mode=${r3.body.mode}` : `status=${r3.status}` });

  // 4. Drafting
  const r4 = await post(`${BASE}/api/run/draft`, { denial, policy: r2.body, clinical_evidence: r3.body });
  const draftOk = r4.status === 200 && r4.body?.body_markdown && typeof r4.body?.win_probability === 'number';
  results.push({ lane: 'Drafting', pass: !!draftOk, ms: r4.ms, detail: draftOk ? `win=${(r4.body.win_probability * 100).toFixed(0)}%` : `status=${r4.status}` });

  // 5. Voice Prep
  const r5 = await post(`${BASE}/api/run/voice-script`, { denial, appeal: r4.body });
  const vpOk = r5.status === 200 && r5.body?.opening_line && Array.isArray(r5.body?.ivr_strategy);
  results.push({ lane: 'Voice Prep', pass: !!vpOk, ms: r5.ms, detail: vpOk ? `${r5.body.ivr_strategy.length} ivr steps` : `status=${r5.status}` });

  // 6. Tracking (synthetic CallResult)
  const r6 = await post(`${BASE}/api/tracking/demo`, {
    conversation_id: 'test-' + Date.now(),
    confirmation_number: 'A4-7821',
    status: 'filed',
  });
  const trOk = r6.status === 200 && r6.body?.run_id && Array.isArray(r6.body?.followups);
  results.push({ lane: 'Tracking', pass: !!trOk, ms: r6.ms, detail: trOk ? `${r6.body.followups.length} followups` : `status=${r6.status}` });

  print(results);

  const allPass = results.every(r => r.pass);
  process.exit(allPass ? 0 : 1);
}

function print(results: Result[]) {
  console.log('\n──────────────────────────────────────────────────');
  console.log('Lane              Pass  Time     Detail');
  console.log('──────────────────────────────────────────────────');
  for (const r of results) {
    console.log(
      r.lane.padEnd(18) +
      (r.pass ? '✅   ' : '❌   ') +
      (r.ms + 'ms').padEnd(9) +
      r.detail
    );
  }
  console.log('──────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('❌ Pipeline test crashed:', err.message);
  process.exit(1);
});
