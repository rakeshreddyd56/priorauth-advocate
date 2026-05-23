'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, SkipBack } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Brand-aligned color palette
// ──────────────────────────────────────────────────────────────────
const COLORS = {
  patient: '#1F2421',       // charcoal — the human in the loop
  google:  '#1F4D2E',       // forest green — Google managed agents + Gemini
  cloud:   '#4285F4',       // Google blue — Cloud Healthcare API + Vertex
  eleven:  '#C5663F',       // warm rust — ElevenLabs voice
  n8n:     '#EA4B71',       // n8n brand pink-red
  gmail:   '#D04437',       // Google red — Gmail outputs
  gov:     '#5C7080',       // slate blue-gray — government / external review
} as const;

// ──────────────────────────────────────────────────────────────────
// Node positions on a 1600×720 canvas
// Layout: three vertical bands (sub-agents at top, fan-in middle,
// durable outputs row at bottom). No label collisions.
// ──────────────────────────────────────────────────────────────────
type NodeKind = 'pill' | 'circle';
const NODES = {
  // ── Tier 1+2: Patient + App layer (left column) ──
  user:        { x: 80,   y: 110, w: 80,  kind: 'circle' as NodeKind, label: 'Patient',         sub: 'Rakesh',                    icon: 'user',      color: COLORS.patient, brand: 'human' },
  frontend:    { x: 80,   y: 290, w: 200, kind: 'pill' as NodeKind,   label: 'Dashboard',       sub: 'Next.js · 6-lane UI',       icon: 'window',    color: COLORS.patient, brand: 'app' },
  orchestrator:{ x: 380,  y: 290, w: 230, kind: 'pill' as NodeKind,   label: 'Managed Agents',  sub: 'Gemini 3.5 Flash planner',  icon: 'hub',       color: COLORS.google,  brand: 'Google · Vertex AI' },
  // ── Tier 3: Sub-agents (three rows, vertical fan-out) ──
  intake:      { x: 760,  y: 110, w: 90,  kind: 'circle' as NodeKind, label: '① Intake',        sub: 'Vision OCR',                icon: 'eye',       color: COLORS.google,  brand: 'Gemini' },
  policy:      { x: 760,  y: 290, w: 90,  kind: 'circle' as NodeKind, label: '② Policy',        sub: 'RAG · Aetna corpus',        icon: 'book',      color: COLORS.google,  brand: 'Gemini' },
  clinical:    { x: 760,  y: 460, w: 90,  kind: 'circle' as NodeKind, label: '③ Clinical',      sub: 'FHIR R4 · LIVE',            icon: 'heart',     color: COLORS.cloud,   brand: 'Cloud Healthcare' },
  // ── Tier 4: Fan-in + voice runtime (mid horizontal row) ──
  drafting:    { x: 980,  y: 290, w: 90,  kind: 'circle' as NodeKind, label: '④ Drafting',      sub: 'AppealLetter JSON',         icon: 'pen',       color: COLORS.google,  brand: 'Gemini' },
  voiceprep:   { x: 1180, y: 290, w: 90,  kind: 'circle' as NodeKind, label: '⑤ Voice Prep',    sub: 'VoiceScript',               icon: 'speech',    color: COLORS.google,  brand: 'Gemini' },
  elevenlabs:  { x: 1370, y: 290, w: 190, kind: 'pill' as NodeKind,   label: 'ElevenLabs',      sub: 'Live conversation',         icon: 'mic',       color: COLORS.eleven,  brand: 'ElevenLabs' },
  // ── Tier 5: Durable + outputs (bottom row, all aligned at y=620) ──
  n8n:         { x: 1370, y: 620, w: 190, kind: 'pill' as NodeKind,   label: 'n8n workflow',    sub: 'Durable · Day 5/14/30',     icon: 'loop',      color: COLORS.n8n,     brand: 'n8n' },
  gmail:       { x: 1140, y: 620, w: 200, kind: 'pill' as NodeKind,   label: 'Gmail status',    sub: 'Patient email · auto-sent', icon: 'envelope',  color: COLORS.gmail,   brand: 'Gmail' },
  iro:         { x: 880,  y: 620, w: 230, kind: 'pill' as NodeKind,   label: 'IRO packet',      sub: 'External review · Day 14',  icon: 'document',  color: COLORS.gov,     brand: 'External Review' },
  doi:         { x: 600,  y: 620, w: 250, kind: 'pill' as NodeKind,   label: 'State DOI',       sub: 'Auto-escalation · Day 30',  icon: 'building',  color: COLORS.gov,     brand: 'State DOI' },
} as const;
type NodeKey = keyof typeof NODES;

const ICON_PATHS: Record<string, React.ReactNode> = {
  user: (
    <g>
      <circle cx="0" cy="-6" r="5" fill="currentColor" />
      <path d="M -8 8 C -8 2, 8 2, 8 8 L 8 12 L -8 12 Z" fill="currentColor" />
    </g>
  ),
  window: (
    <g>
      <rect x="-10" y="-8" width="20" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="-10" y1="-3" x2="10" y2="-3" stroke="currentColor" strokeWidth="1" />
      <circle cx="-7" cy="-6" r="0.6" fill="currentColor" />
    </g>
  ),
  hub: (
    <g>
      <circle cx="0" cy="0" r="3" fill="currentColor" />
      <line x1="0" y1="0" x2="-9" y2="-7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="0" x2="9" y2="-7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="0" x2="-9" y2="7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="0" x2="9" y2="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="-9" cy="-7" r="1.6" fill="currentColor" />
      <circle cx="9" cy="-7" r="1.6" fill="currentColor" />
      <circle cx="-9" cy="7" r="1.6" fill="currentColor" />
      <circle cx="9" cy="7" r="1.6" fill="currentColor" />
    </g>
  ),
  eye: (
    <g>
      <path d="M -10 0 C -6 -5, 6 -5, 10 0 C 6 5, -6 5, -10 0 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="0" cy="0" r="3" fill="currentColor" />
    </g>
  ),
  book: (
    <g>
      <path d="M -9 -8 L 0 -6 L 9 -8 L 9 8 L 0 6 L -9 8 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="0" y1="-6" x2="0" y2="6" stroke="currentColor" strokeWidth="1" />
    </g>
  ),
  heart: (
    <g>
      <path d="M 0 8 C -10 0, -10 -8, -4 -8 C -1 -8, 0 -5, 0 -5 C 0 -5, 1 -8, 4 -8 C 10 -8, 10 0, 0 8 Z" fill="currentColor" />
      <path d="M -5 -1 L 5 -1 M 0 -6 L 0 4" stroke="white" strokeWidth="1.2" opacity="0.85" />
    </g>
  ),
  pen: (
    <g>
      <path d="M -8 8 L -6 4 L 6 -8 L 8 -6 L -4 6 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="-8" y1="8" x2="-5" y2="5" stroke="currentColor" strokeWidth="1.5" />
    </g>
  ),
  speech: (
    <g>
      <path d="M -10 -6 L 10 -6 L 10 4 L 2 4 L -2 8 L -2 4 L -10 4 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="-4" cy="-1" r="0.8" fill="currentColor" />
      <circle cx="0" cy="-1" r="0.8" fill="currentColor" />
      <circle cx="4" cy="-1" r="0.8" fill="currentColor" />
    </g>
  ),
  mic: (
    <g>
      <rect x="-3.5" y="-9" width="7" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M -7 0 C -7 5, 7 5, 7 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="0" y1="5" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5" />
    </g>
  ),
  loop: (
    <g>
      <path d="M 7 -2 A 8 8 0 1 1 0 -8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <polygon points="5,-5 8,-2 5,1" fill="currentColor" />
      <text x="0" y="3" fontSize="6" fontFamily="Charter, serif" fill="currentColor" textAnchor="middle">n8n</text>
    </g>
  ),
  envelope: (
    <g>
      <rect x="-9" y="-6" width="18" height="12" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M -9 -6 L 0 2 L 9 -6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </g>
  ),
  document: (
    <g>
      <path d="M -7 -9 L 4 -9 L 8 -5 L 8 9 L -7 9 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M 4 -9 L 4 -5 L 8 -5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="-3" y1="0" x2="4" y2="0" stroke="currentColor" strokeWidth="1" />
      <line x1="-3" y1="4" x2="4" y2="4" stroke="currentColor" strokeWidth="1" />
    </g>
  ),
  building: (
    <g>
      <rect x="-8" y="-9" width="16" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="-5" y="-6" width="2.5" height="2.5" fill="currentColor" />
      <rect x="-1" y="-6" width="2.5" height="2.5" fill="currentColor" />
      <rect x="3" y="-6" width="2.5" height="2.5" fill="currentColor" />
      <rect x="-5" y="-2" width="2.5" height="2.5" fill="currentColor" />
      <rect x="-1" y="-2" width="2.5" height="2.5" fill="currentColor" />
      <rect x="3" y="-2" width="2.5" height="2.5" fill="currentColor" />
      <rect x="-2.5" y="3" width="5" height="6" fill="currentColor" />
    </g>
  ),
};

// ──────────────────────────────────────────────────────────────────
// Edges with optional data-shape label that appears mid-flow
// ──────────────────────────────────────────────────────────────────
const EDGES: { from: NodeKey; to: NodeKey; label?: string }[] = [
  { from: 'user',         to: 'frontend',     label: 'photo' },
  { from: 'frontend',     to: 'orchestrator', label: 'image upload' },
  { from: 'orchestrator', to: 'intake',       label: 'image bytes' },
  { from: 'orchestrator', to: 'policy',       label: 'denial' },
  { from: 'orchestrator', to: 'clinical',     label: 'denial' },
  { from: 'intake',       to: 'drafting',     label: 'DenialLetter' },
  { from: 'policy',       to: 'drafting',     label: 'PolicyMatch' },
  { from: 'clinical',     to: 'drafting',     label: 'corroboration' },
  { from: 'drafting',     to: 'voiceprep',    label: 'AppealLetter' },
  { from: 'voiceprep',    to: 'elevenlabs',   label: 'VoiceScript' },
  { from: 'elevenlabs',   to: 'n8n',          label: 'CallResult + transcript' },
  { from: 'n8n',          to: 'gmail',        label: 'status email' },
  { from: 'n8n',          to: 'iro',          label: 'Day 14 packet' },
  { from: 'n8n',          to: 'doi',          label: 'Day 30 filing' },
];

// ──────────────────────────────────────────────────────────────────
// Narration covering managed agents, parallel fan-out, Gmail flow
// ──────────────────────────────────────────────────────────────────
const STEPS: { active: NodeKey[]; activeEdges: number[]; title: string; detail: string }[] = [
  {
    active: [],
    activeEdges: [],
    title: 'Ready to walk the architecture',
    detail: 'Press Play. Each step lights the live components, animates the data flow between them, and explains what just happened. This is exactly the order the demo runs.',
  },
  {
    active: ['user'],
    activeEdges: [],
    title: '0 · The patient',
    detail: 'Rakesh — 32, Crohn\'s disease, Aetna PPO. He got a denial letter. The agent fleet activates the moment he picks up his phone.',
  },
  {
    active: ['user', 'frontend'],
    activeEdges: [0],
    title: '1 · Photo of denial → Dashboard',
    detail: 'The Next.js dashboard accepts the photo over a simple multipart upload. Same code path as the production mobile app.',
  },
  {
    active: ['frontend', 'orchestrator'],
    activeEdges: [1],
    title: '2 · Managed Agents orchestrator activates',
    detail: 'This is the Google managed-agents pattern. A single planner agent (Gemini 3.5 Flash) decides the lane sequence, holds the run state, and enforces typed contracts between every sub-agent. No agent ever frees itself from the schema.',
  },
  {
    active: ['orchestrator', 'intake'],
    activeEdges: [2],
    title: '3 · Intake sub-agent — Gemini Vision',
    detail: 'Multimodal call. Reads the photo, extracts DenialLetter JSON: insurer, drug, denial reason code, cited policy section, appeal deadline, contact phone. Strict Zod schema rejects anything malformed.',
  },
  {
    active: ['orchestrator', 'policy', 'clinical'],
    activeEdges: [3, 4],
    title: '4 · Parallel fan-out — Policy ∥ Clinical Evidence',
    detail: 'This is the managed-agents superpower. Policy and Clinical Evidence sub-agents fire simultaneously off the same DenialLetter. Policy RAG-queries the Aetna CPB corpus; Clinical Evidence fetches the patient\'s 8-week azathioprine trial note LIVE from Cloud Healthcare API FHIR R4.',
  },
  {
    active: ['policy', 'clinical', 'drafting'],
    activeEdges: [5, 6, 7],
    title: '5 · Fan-in to Drafting',
    detail: 'All three upstream payloads land at the Drafting sub-agent. Gemini composes a formal appeal letter that quotes the insurer\'s own policy clauses verbatim and cites the FHIR-corroborated trial. Returns AppealLetter JSON with a win-probability score.',
  },
  {
    active: ['drafting', 'voiceprep'],
    activeEdges: [8],
    title: '6 · Voice Prep — script generation',
    detail: 'The drafting output becomes a compact VoiceScript: opening line, IVR navigation strategy, 30-second appeal summary, forbidden phrases. This is what the voice agent will read aloud on the call.',
  },
  {
    active: ['voiceprep', 'elevenlabs'],
    activeEdges: [9],
    title: '7 · Voice Execution — ElevenLabs',
    detail: 'The ElevenLabs Conversational AI runtime takes the VoiceScript and opens a live audio session — browser SDK for the stage demo, Twilio outbound for production. Real conversation, sub-second turn-taking, full transcript captured.',
  },
  {
    active: ['elevenlabs', 'n8n'],
    activeEdges: [10],
    title: '8 · Post-call webhook → n8n',
    detail: 'When the call ends, ElevenLabs posts the CallResult to an n8n webhook. n8n is the durable execution layer — the part of the architecture that keeps running when the patient closes their laptop.',
  },
  {
    active: ['n8n', 'gmail'],
    activeEdges: [11],
    title: '9 · Gmail status email — fired immediately',
    detail: 'First action n8n takes: send the patient a styled status email with confirmation number, appeal summary, Day 5/14/30 schedule. The exact email you saw drafted in your Gmail.',
  },
  {
    active: ['n8n', 'iro'],
    activeEdges: [12],
    title: '10 · Day 14 — IRO packet armed',
    detail: 'If Aetna doesn\'t respond in 14 days, n8n triggers the Drafting agent in a second mode to generate the full External Review (IRO) escalation packet. Patient just needs to click Send.',
  },
  {
    active: ['n8n', 'doi'],
    activeEdges: [13],
    title: '11 · Day 30 — State DOI complaint filed',
    detail: 'Still denied? n8n drafts and files an automatic complaint with the State Department of Insurance. The long-horizon part: 30 days after the patient went back to being sick, the system is still fighting on their behalf.',
  },
  {
    active: ['user', 'frontend', 'orchestrator', 'intake', 'policy', 'clinical', 'drafting', 'voiceprep', 'elevenlabs', 'n8n', 'gmail', 'iro', 'doi'],
    activeEdges: Array.from({length: EDGES.length}, (_, i) => i),
    title: '12 · The whole agent fleet, in one frame',
    detail: 'Six Gemini sub-agents on Google managed-agent infrastructure. One ElevenLabs voice runtime. One n8n durable workflow. Three escalation outputs. Photo to filed appeal in under 90 seconds. n8n keeps fighting for 60 days after.',
  },
];

// ──────────────────────────────────────────────────────────────────
// Path geometry — wavy bezier for organic feel
// ──────────────────────────────────────────────────────────────────
function nodeCenter(key: NodeKey) {
  const n = NODES[key];
  return n.kind === 'circle'
    ? { cx: n.x + n.w / 2, cy: n.y, r: n.w / 2 }
    : { cx: n.x + n.w / 2, cy: n.y + 25, w: n.w, h: 50 };
}

function pathBetween(from: NodeKey, to: NodeKey) {
  const a = NODES[from], b = NODES[to];
  const ax = a.x + a.w / 2;
  const ay = a.kind === 'circle' ? a.y : a.y + 25;
  const bx = b.x + b.w / 2;
  const by = b.kind === 'circle' ? b.y : b.y + 25;

  const dx = bx - ax;
  const dy = by - ay;
  let x1: number, y1: number, x2: number, y2: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal-dominant — attach on left/right sides
    const ar = a.kind === 'circle' ? a.w / 2 : a.w / 2;
    const br = b.kind === 'circle' ? b.w / 2 : b.w / 2;
    x1 = dx > 0 ? ax + ar : ax - ar;
    y1 = ay;
    x2 = dx > 0 ? bx - br : bx + br;
    y2 = by;
  } else {
    // Vertical-dominant — attach top/bottom
    const ar = a.kind === 'circle' ? a.w / 2 : 25;
    const br = b.kind === 'circle' ? b.w / 2 : 25;
    x1 = ax;
    y1 = dy > 0 ? ay + ar : ay - ar;
    x2 = bx;
    y2 = dy > 0 ? by - br : by + br;
  }

  const midX = (x1 + x2) / 2;
  const cx1 = Math.abs(dx) > Math.abs(dy) ? midX : x1;
  const cy1 = Math.abs(dx) > Math.abs(dy) ? y1 : (y1 + y2) / 2;
  const cx2 = Math.abs(dx) > Math.abs(dy) ? midX : x2;
  const cy2 = Math.abs(dx) > Math.abs(dy) ? y2 : (y1 + y2) / 2;

  return {
    d: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2,
  };
}

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────
export default function ArchitectureFlow() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    tRef.current = window.setTimeout(() => {
      if (step >= STEPS.length - 1) setStep(0);
      else setStep(s => s + 1);
    }, step === 0 ? 1500 : 3200);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [step, playing]);

  const current = STEPS[step];
  const activeNodes = new Set(current.active);
  const activeEdges = new Set(current.activeEdges);

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      {/* ── Controls ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => { setStep(Math.max(0, step - 1)); setPlaying(false); }} className="pa-btn-ghost" style={{ padding: '0.45rem 0.7rem' }}><SkipBack size={14} /></button>
          <button onClick={() => setPlaying(p => !p)} className="pa-btn-accent" style={{ padding: '0.5rem 1.1rem' }}>
            {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Auto-play architecture walkthrough</>}
          </button>
          <button onClick={() => { setStep(Math.min(STEPS.length - 1, step + 1)); setPlaying(false); }} className="pa-btn-ghost" style={{ padding: '0.45rem 0.7rem' }}><SkipForward size={14} /></button>
          <button onClick={() => { setStep(0); setPlaying(false); }} className="pa-btn-ghost" style={{ padding: '0.45rem 0.7rem' }}><RotateCcw size={12} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setStep(i); setPlaying(false); }}
              style={{
                width: '1.55rem', height: '1.55rem', borderRadius: '50%',
                background: i === step ? 'var(--pa-accent)' : i < step ? 'var(--pa-accent-soft)' : 'transparent',
                color: i === step ? 'white' : i < step ? 'var(--pa-accent)' : 'var(--pa-ink-3)',
                border: '1px solid ' + (i === step ? 'var(--pa-accent)' : 'var(--pa-rule-soft)'),
                fontSize: '0.7rem', fontFamily: 'Charter, serif',
                cursor: 'pointer', padding: 0, lineHeight: 1,
              }}
            >{i}</button>
          ))}
        </div>
      </div>

      {/* ── Caption ─────────────────────────────────────────────── */}
      <div className="pa-card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--pa-accent)', minHeight: '7.5rem' }}>
        <div className="pa-label" style={{ marginBottom: '0.35rem' }}>Step {step} of {STEPS.length - 1} · narrate over the motion</div>
        <div className="pa-serif" style={{ fontSize: '1.35rem', marginBottom: '0.45rem', lineHeight: 1.25 }}>{current.title}</div>
        <p style={{ fontSize: '0.94rem', color: 'var(--pa-ink-2)', lineHeight: 1.55, margin: 0 }}>{current.detail}</p>
      </div>

      {/* ── SVG diagram ─────────────────────────────────────────── */}
      <div style={{ background: 'white', border: '1px solid var(--pa-rule-soft)', borderRadius: '4px', padding: '0.5rem' }}>
        <svg viewBox="0 0 1600 740" style={{ width: '100%', display: 'block', fontFamily: 'Inter, sans-serif' }}>
          <defs>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--pa-accent)" />
            </marker>
            <marker id="arrow-idle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(31,36,33,0.35)" />
            </marker>
          </defs>

          {/* ── Tier labels — placed in negative space, no node collisions ── */}
          <text x="80"   y="80"  fontSize="9" letterSpacing="2.5" fill="var(--pa-ink-3)" style={{ textTransform: 'uppercase' }}>① Patient</text>
          <text x="80"   y="265" fontSize="9" letterSpacing="2.5" fill="var(--pa-ink-3)" style={{ textTransform: 'uppercase' }}>② App layer</text>
          <text x="380"  y="265" fontSize="9" letterSpacing="2.5" fill="var(--pa-accent)" fontWeight="600" style={{ textTransform: 'uppercase' }}>③ Managed agents · Google Vertex AI</text>
          <text x="760"  y="80"  fontSize="9" letterSpacing="2.5" fill="var(--pa-accent)" fontWeight="600" style={{ textTransform: 'uppercase' }}>④ Gemini 3.5 Flash sub-agents · parallel fan-out</text>
          <text x="1370" y="265" fontSize="9" letterSpacing="2.5" fill="#C5663F" fontWeight="600" style={{ textTransform: 'uppercase' }}>⑤ Voice runtime · ElevenLabs</text>
          <text x="80"   y="595" fontSize="9" letterSpacing="2.5" fill="#EA4B71" fontWeight="600" style={{ textTransform: 'uppercase' }}>⑥ Durable workflow · long-horizon outputs</text>

          {/* ── Edges ── */}
          {EDGES.map((edge, i) => {
            const isActive = activeEdges.has(i);
            const { d, mx, my } = pathBetween(edge.from, edge.to);
            // Color the flow by the source node's brand color
            const edgeColor = NODES[edge.from].color;
            return (
              <g key={i}>
                <path
                  d={d} fill="none"
                  stroke={isActive ? edgeColor : 'rgba(31,36,33,0.16)'}
                  strokeWidth={isActive ? 2 : 1}
                  style={{ transition: 'all 0.4s ease' }}
                />
                {isActive && (
                  <>
                    <path d={d} fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="6 14" style={{ animation: 'pa-flow 1.4s linear infinite' }} />
                    {/* Data-shape label floating mid-edge */}
                    {edge.label && (
                      <g style={{ animation: 'pa-fade-in 0.4s ease' }}>
                        <rect
                          x={mx - (edge.label.length * 3.4 + 8)} y={my - 9}
                          width={edge.label.length * 6.8 + 16} height={18}
                          rx="9"
                          fill={edgeColor}
                        />
                        <text
                          x={mx} y={my + 3}
                          fontSize="10"
                          fontFamily="iA Writer Mono S, SF Mono, monospace"
                          fill="white"
                          textAnchor="middle"
                          letterSpacing="0.04em"
                        >{edge.label}</text>
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {(Object.keys(NODES) as NodeKey[]).map(key => {
            const n = NODES[key];
            const active = activeNodes.has(key);

            const fillColor = active ? n.color : '#FFFFFF';
            const strokeColor = active ? n.color : 'rgba(31,36,33,0.22)';
            const textColor = active ? '#FAF8F3' : 'var(--pa-ink)';
            const subColor = active ? 'rgba(250,248,243,0.78)' : 'var(--pa-ink-3)';

            if (n.kind === 'circle') {
              const r = n.w / 2;
              const cx = n.x + r;
              const cy = n.y;
              return (
                <g key={key} style={{ transition: 'all 0.4s ease' }}>
                  {active && (
                    <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={n.color} strokeWidth="2" opacity="0" style={{ animation: 'pa-pulse-ring 1.7s ease-out infinite' }} />
                  )}
                  <circle cx={cx} cy={cy} r={r} fill={fillColor} stroke={strokeColor} strokeWidth={active ? 2 : 1} style={{ transition: 'all 0.4s ease' }} />
                  <g transform={`translate(${cx}, ${cy - 5})`} color={textColor} style={{ transition: 'color 0.4s ease' }}>
                    {ICON_PATHS[n.icon]}
                  </g>
                  <text x={cx} y={cy + 60} fontSize="13" fontFamily="Charter, serif" fontWeight="500" fill="var(--pa-ink)" textAnchor="middle">{n.label}</text>
                  <text x={cx} y={cy + 76} fontSize="10" fill={n.color} textAnchor="middle" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>{n.brand}</text>
                  <text x={cx} y={cy + 90} fontSize="9.5" fill="var(--pa-ink-3)" textAnchor="middle">{n.sub}</text>
                </g>
              );
            }

            // Pill node
            return (
              <g key={key} style={{ transition: 'all 0.4s ease' }}>
                {active && (
                  <rect x={n.x - 6} y={n.y - 6} width={n.w + 12} height="62" rx="33" fill="none" stroke={n.color} strokeWidth="2" opacity="0" style={{ animation: 'pa-pulse-ring 1.7s ease-out infinite' }} />
                )}
                <rect x={n.x} y={n.y} width={n.w} height="50" rx="25" fill={fillColor} stroke={strokeColor} strokeWidth={active ? 2 : 1} style={{ transition: 'all 0.4s ease' }} />
                <g transform={`translate(${n.x + 22}, ${n.y + 25})`} color={textColor} style={{ transition: 'color 0.4s ease' }}>
                  {ICON_PATHS[n.icon]}
                </g>
                <text x={n.x + 44} y={n.y + 20} fontSize="13" fontFamily="Charter, serif" fontWeight="500" fill={textColor} style={{ transition: 'fill 0.4s ease' }}>{n.label}</text>
                <text x={n.x + 44} y={n.y + 36} fontSize="9.5" fill={subColor} style={{ transition: 'fill 0.4s ease' }}>{n.sub}</text>
                {/* brand chip outside the pill */}
                <text x={n.x + n.w / 2} y={n.y + 65} fontSize="9.5" fill={n.color} textAnchor="middle" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>{n.brand}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Stack legend (color → vendor) ────────────────────────── */}
      <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'var(--pa-paper)', border: '1px solid var(--pa-rule-soft)', borderRadius: '3px' }}>
        <div className="pa-label" style={{ marginBottom: '0.6rem' }}>Stack legend</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem 1rem', fontSize: '0.8rem' }}>
          {[
            { c: COLORS.google, name: 'Google managed agents', detail: 'Gemini 3.5 Flash · 5 sub-agents' },
            { c: COLORS.cloud,  name: 'Cloud Healthcare API',  detail: 'FHIR R4 · live patient pull' },
            { c: COLORS.eleven, name: 'ElevenLabs',            detail: 'Conversational AI voice' },
            { c: COLORS.n8n,    name: 'n8n',                   detail: 'Durable workflow · Day 5/14/30' },
            { c: COLORS.gmail,  name: 'Gmail',                 detail: 'Patient status email' },
            { c: COLORS.gov,    name: 'External IRO · State DOI', detail: 'Auto-escalation outputs' },
            { c: COLORS.patient, name: 'Patient / App layer',  detail: 'User-facing surface' },
          ].map(item => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{ width: '14px', height: '14px', background: item.c, borderRadius: '50%', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--pa-ink)' }}>{item.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--pa-ink-3)', marginTop: '0.1rem' }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
