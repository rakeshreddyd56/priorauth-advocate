#!/usr/bin/env node
/**
 * Seed synthetic FHIR resources (Patient + DocumentReference) into a
 * Cloud Healthcare API FHIR R4 store. Idempotent — uses upsert.
 *
 * Required env:
 *   GOOGLE_PROJECT_ID
 *   GOOGLE_APPLICATION_CREDENTIALS  (path to service account JSON)
 *   VERTEX_LOCATION                 (default us-central1)
 *   HEALTHCARE_DATASET              (default priorauth-demo)
 *   HEALTHCARE_FHIR_STORE           (default priorauth-fhir)
 *
 * Run: npx tsx scripts/seed-fhir.ts
 */
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const PROJECT = process.env.GOOGLE_PROJECT_ID;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const DATASET = process.env.HEALTHCARE_DATASET || 'priorauth-demo';
const FHIR_STORE = process.env.HEALTHCARE_FHIR_STORE || 'priorauth-fhir';

if (!PROJECT) {
  console.error('❌ GOOGLE_PROJECT_ID not set');
  console.error('Set up the FHIR store first via Google Cloud Console:');
  console.error('  https://console.cloud.google.com/healthcare/browser');
  console.error('  → Create dataset "priorauth-demo" in us-central1');
  console.error('  → Inside it, create FHIR store "priorauth-fhir" version R4');
  console.error('Then set GOOGLE_PROJECT_ID and re-run.');
  process.exit(1);
}

async function getAuthToken(): Promise<string> {
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) throw new Error('Token was null');
    return tokenResponse.token;
  } catch (err: any) {
    console.error('❌ Failed to acquire access token:', err.message);
    console.error('Ensure GOOGLE_APPLICATION_CREDENTIALS points at a valid service-account key.');
    process.exit(1);
  }
}

async function upsertResource(resource: any, base: string, token: string) {
  const url = `${base}/${resource.resourceType}/${resource.id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/fhir+json',
    },
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${resource.resourceType}/${resource.id}: HTTP ${res.status}\n${errBody}`);
  }
  return res.json();
}

async function main() {
  const resourcesDir = path.join(process.cwd(), 'scripts', 'fhir-resources');
  const patientRaw = await fs.readFile(path.join(resourcesDir, 'patient-rr.json'), 'utf8');
  const docRefRaw = await fs.readFile(path.join(resourcesDir, 'document-reference-azathioprine-trial.json'), 'utf8');
  const patient = JSON.parse(patientRaw);
  const docRef = JSON.parse(docRefRaw);

  const base = `https://healthcare.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/datasets/${DATASET}/fhirStores/${FHIR_STORE}/fhir`;

  console.log(`\n🌱 Seeding FHIR store:\n   ${base}\n`);

  const token = await getAuthToken();

  console.log(`   PUT Patient/${patient.id} ...`);
  await upsertResource(patient, base, token);
  console.log('   ✅ Patient seeded');

  console.log(`   PUT DocumentReference/${docRef.id} ...`);
  await upsertResource(docRef, base, token);
  console.log('   ✅ DocumentReference seeded');

  console.log('\n✅ FHIR seed complete. Test with:');
  console.log(`   curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \\`);
  console.log(`     "${base}/Patient?identifier=urn:priorauth:demo|5821"`);
  console.log('');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
