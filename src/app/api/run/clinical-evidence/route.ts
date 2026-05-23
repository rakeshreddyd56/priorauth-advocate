import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Clinical Evidence lane — corroborates the DenialLetter's clinical claim
// from a synthetic FHIR R4 store (Cloud Healthcare API).
//
// Two modes:
//   LIVE: hits Cloud Healthcare API FHIR R4 endpoint when HEALTHCARE_DATASET
//         + HEALTHCARE_FHIR_STORE + GOOGLE_PROJECT_ID + GOOGLE_APPLICATION_
//         CREDENTIALS are set.
//   SCAFFOLD (default): reads the same synthetic Patient + DocumentReference
//         from scripts/fhir-resources/ — identical resource shapes; identical
//         downstream payload.
//
// Both modes return the same corroborated_facts envelope so the Drafting
// agent sees one stable contract.

interface CorroboratedFact {
  field: string;
  value: number | string;
  source: { resourceType: string; id: string; system: string };
}

interface ClinicalEvidence {
  fhir_patient_id: string;
  corroborated_facts: CorroboratedFact[];
  fetched_at_iso: string;
  mode: 'live' | 'scaffold';
}

const FHIR_RESOURCES_DIR = path.join(process.cwd(), 'scripts', 'fhir-resources');

async function readScaffoldedResources() {
  const patientRaw = await fs.readFile(path.join(FHIR_RESOURCES_DIR, 'patient-rr.json'), 'utf8');
  const docRefRaw = await fs.readFile(path.join(FHIR_RESOURCES_DIR, 'document-reference-azathioprine-trial.json'), 'utf8');
  return { patient: JSON.parse(patientRaw), docRef: JSON.parse(docRefRaw) };
}

async function fetchFromCloudHealthcare(memberIdLast4: string): Promise<{ patient: any; docRef: any } | null> {
  const project = process.env.GOOGLE_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  const dataset = process.env.HEALTHCARE_DATASET;
  const fhirStore = process.env.HEALTHCARE_FHIR_STORE;

  // No GOOGLE_APPLICATION_CREDENTIALS check — google-auth-library auto-discovers
  // Application Default Credentials (ADC) from ~/.config/gcloud/... on dev,
  // or the metadata server on Cloud Run. This is the 2026 best-practice path
  // that complies with the iam.disableServiceAccountKeyCreation org policy.
  if (!project || !dataset || !fhirStore) return null;

  // Live path — fetch Patient by identifier, then DocumentReference by subject.
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;
    const base = `https://healthcare.googleapis.com/v1/projects/${project}/locations/${location}/datasets/${dataset}/fhirStores/${fhirStore}/fhir`;

    const patientRes = await fetch(`${base}/Patient?identifier=urn:priorauth:demo|${memberIdLast4}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!patientRes.ok) return null;
    const patientBundle = await patientRes.json();
    const patient = patientBundle.entry?.[0]?.resource;
    if (!patient) return null;

    const docRefRes = await fetch(`${base}/DocumentReference?subject=Patient/${patient.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!docRefRes.ok) return null;
    const docRefBundle = await docRefRes.json();
    const docRef = docRefBundle.entry?.[0]?.resource;
    if (!docRef) return null;

    return { patient, docRef };
  } catch (err: any) {
    console.error('Cloud Healthcare API call failed, falling back to scaffold:', err.message);
    return null;
  }
}

function extractCorroboration(patient: any, docRef: any): CorroboratedFact[] {
  // Decode the base64-encoded note from the DocumentReference and surface
  // the structured fact we'd otherwise have to re-extract.
  const attachment = docRef.content?.[0]?.attachment;
  const decodedNote = attachment?.data
    ? Buffer.from(attachment.data, 'base64').toString('utf-8')
    : '';

  // Parse the trial duration. The synthetic note says "completed an 8-week
  // trial of azathioprine 100mg daily". This pattern matches the live data
  // shape we'd see from a real EHR.
  const weekMatch = decodedNote.match(/(\d+)\s*-?\s*week/i);
  const weeks = weekMatch ? parseInt(weekMatch[1], 10) : null;

  const facts: CorroboratedFact[] = [];

  if (weeks !== null) {
    facts.push({
      field: 'azathioprine_trial_duration_weeks',
      value: weeks,
      source: {
        resourceType: 'DocumentReference',
        id: docRef.id || 'rr-azathioprine-trial-doc',
        system: 'Cloud Healthcare API FHIR R4',
      },
    });
  }

  // Always include the source document reference itself.
  facts.push({
    field: 'clinical_note_excerpt',
    value: decodedNote.substring(0, 250) + (decodedNote.length > 250 ? '…' : ''),
    source: {
      resourceType: 'DocumentReference',
      id: docRef.id || 'rr-azathioprine-trial-doc',
      system: 'Cloud Healthcare API FHIR R4',
    },
  });

  return facts;
}

export async function POST(request: NextRequest) {
  try {
    const denialLetter = await request.json().catch(() => null);
    if (!denialLetter) {
      return NextResponse.json({ error: 'Denial letter is required' }, { status: 400 });
    }

    const memberIdLast4 = (denialLetter.member_id || '5821').slice(-4);

    // Try live mode first.
    let mode: 'live' | 'scaffold' = 'live';
    let resources = await fetchFromCloudHealthcare(memberIdLast4);

    if (!resources) {
      mode = 'scaffold';
      resources = await readScaffoldedResources();
    }

    const evidence: ClinicalEvidence = {
      fhir_patient_id: resources.patient.id || 'rr-demo-5821',
      corroborated_facts: extractCorroboration(resources.patient, resources.docRef),
      fetched_at_iso: new Date().toISOString(),
      mode,
    };

    return NextResponse.json(evidence, {
      headers: {
        'X-Lane-Source': mode === 'live' ? 'live' : 'scaffold (FHIR R4 JSON from disk)',
      },
    });
  } catch (error: any) {
    console.error('Error in clinical-evidence route:', error);
    return NextResponse.json({
      fhir_patient_id: null,
      corroborated_facts: [],
      fetched_at_iso: new Date().toISOString(),
      mode: 'scaffold',
      error: error.message,
    }, {
      status: 200,
      headers: {
        'X-Lane-Source': 'error-fallback',
        'X-Lane-Error': error.message || 'unknown',
      },
    });
  }
}
