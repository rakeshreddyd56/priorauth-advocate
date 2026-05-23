import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { image, useSample } = body;
    const origin = request.nextUrl.origin;

    // Step 1: Intake
    const intakeRes = await fetch(`${origin}/api/run/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, useSample }),
    });
    if (!intakeRes.ok) throw new Error('Intake stage failed');
    const intakeData = await intakeRes.json();
    const intakeSource = intakeRes.headers.get('X-Lane-Source') || 'unknown';

    // Step 2: Policy Matching
    const policyRes = await fetch(`${origin}/api/run/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intakeData),
    });
    if (!policyRes.ok) throw new Error('Policy matching stage failed');
    const policyData = await policyRes.json();
    const policySource = policyRes.headers.get('X-Lane-Source') || 'unknown';

    // Step 3: Appeal Letter Drafting
    const draftRes = await fetch(`${origin}/api/run/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ denial: intakeData, policy: policyData }),
    });
    if (!draftRes.ok) throw new Error('Drafting stage failed');
    const draftData = await draftRes.json();
    const draftSource = draftRes.headers.get('X-Lane-Source') || 'unknown';

    // Step 4: Voice Script Generation
    const voiceScriptRes = await fetch(`${origin}/api/run/voice-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ denial: intakeData, appeal: draftData }),
    });
    if (!voiceScriptRes.ok) throw new Error('Voice script stage failed');
    const voiceScriptData = await voiceScriptRes.json();
    const voiceScriptSource = voiceScriptRes.headers.get('X-Lane-Source') || 'unknown';

    return NextResponse.json({
      intake: { data: intakeData, source: intakeSource },
      policy: { data: policyData, source: policySource },
      draft: { data: draftData, source: draftSource },
      voiceScript: { data: voiceScriptData, source: voiceScriptSource },
    });
  } catch (error: any) {
    console.error('Error in demo orchestrator:', error);
    return NextResponse.json({ error: error.message || 'Orchestration failed' }, { status: 500 });
  }
}
