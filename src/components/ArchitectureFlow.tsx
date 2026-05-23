'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, SkipBack } from 'lucide-react';

// ─── Node positions on a 1600×900 canvas ──────────────────────────
const NODES = {
  user:        { x: 60,   y: 100, w: 220, h: 70, label: 'Patient',         sub: 'Rakesh · Snaps photo of denial letter' },
  frontend:    { x: 60,   y: 230, w: 220, h: 70, label: 'Next.js Dashboard', sub: '6-lane UI · SSE · Vercel' },
  orchestrator:{ x: 400,  y: 230, w: 240, h: 70, label: 'Orchestrator',    sub: 'Cloud Run · strict Zod contracts' },
  intake:      { x: 760,  y: 80,  w: 220, h: 70, label: '① Intake',        sub: 'Gemini 3.5 Flash · Vision OCR' },
  policy:      { x: 760,  y: 200, w: 220, h: 70, label: '② Policy',        sub: 'Gemini · RAG · Aetna corpus' },
  clinical:    { x: 760,  y: 320, w: 220, h: 70, label: '③ Clinical Evidence', sub: 'Cloud Healthcare API · FHIR R4' },
  drafting:    { x: 1080, y: 200, w: 220, h: 70, label: '④ Drafting',      sub: 'Gemini · AppealLetter JSON' },
  voiceprep:   { x: 1080, y: 320, w: 220, h: 70, label: '⑤ Voice Prep',    sub: 'Gemini · VoiceScript' },
  elevenlabs:  { x: 1370, y: 320, w: 200, h: 70, label: '⑥ Voice Exec',    sub: 'ElevenLabs · Twilio' },
  n8n:         { x: 1080, y: 470, w: 220, h: 70, label: '⑦ n8n Tracking',  sub: 'Durable · Day 5 / 14 / 30' },
  outputs:     { x: 760,  y: 470, w: 220, h: 70, label: 'Outputs',         sub: 'Email · IRO · DOI · Confirmation' },
} as const;

type NodeKey = keyof typeof NODES;

// ─── Edges (from → to) and which step they belong to ──────────────
const EDGES: { from: NodeKey; to: NodeKey; step: number; color?: string }[] = [
  { from: 'user',         to: 'frontend',     step: 1 },
  { from: 'frontend',     to: 'orchestrator', step: 2 },
  { from: 'orchestrator', to: 'intake',       step: 3 },
  { from: 'orchestrator', to: 'policy',       step: 4 },
  { from: 'orchestrator', to: 'clinical',     step: 4 },
  { from: 'policy',       to: 'drafting',     step: 5 },
  { from: 'clinical',     to: 'drafting',     step: 5 },
  { from: 'drafting',     to: 'voiceprep',    step: 6 },
  { from: 'voiceprep',    to: 'elevenlabs',   step: 7 },
  { from: 'elevenlabs',   to: 'n8n',          step: 8 },
  { from: 'n8n',          to: 'outputs',      step: 9 },
];

// ─── Steps (the narrated flow) ────────────────────────────────────
const STEPS: { active: NodeKey[]; title: string; detail: string; edges: number[] }[] = [
  { active: [], title: 'Ready', detail: 'Click play. The flow walks through every active component in the order the demo runs.', edges: [] },
  { active: ['user', 'frontend'], title: '1 · Patient uploads denial letter', detail: 'Photo of the Aetna denial reaches the Next.js dashboard.', edges: [1] },
  { active: ['frontend', 'orchestrator'], title: '2 · Frontend posts to orchestrator', detail: 'Cloud Run service receives the photo; the planner agent decides the lane sequence.', edges: [2] },
  { active: ['orchestrator', 'intake'], title: '3 · Intake — Gemini 3.5 Flash Vision', detail: 'Multimodal call extracts DenialLetter JSON: insurer, drug, denial reason, cited policy section, appeal deadline.', edges: [3] },
  { active: ['orchestrator', 'policy', 'clinical'], title: '4 · Policy ∥ Clinical Evidence (PARALLEL)', detail: 'Policy lane RAG-queries the Aetna CPB corpus. Clinical Evidence lane fetches an 8-week azathioprine trial note live from the Cloud Healthcare FHIR R4 store.', edges: [4, 5] },
  { active: ['policy', 'clinical', 'drafting'], title: '5 · Drafting — fan-in', detail: 'Gemini composes the appeal letter, quoting policy clauses verbatim and citing the FHIR-corroborated trial. Wins-prob 85%.', edges: [6, 7] },
  { active: ['drafting', 'voiceprep'], title: '6 · Voice Prep — script generation', detail: 'AppealLetter becomes a tight VoiceScript JSON with opening line, IVR strategy, and forbidden phrases.', edges: [8] },
  { active: ['voiceprep', 'elevenlabs'], title: '7 · Voice Execution — ElevenLabs', detail: 'Browser SDK opens a real conversation. Agent voice plays through laptop speakers; patient or rep speaks back. Same code path as production Twilio outbound.', edges: [9] },
  { active: ['elevenlabs', 'n8n'], title: '8 · Post-call webhook → n8n', detail: 'CallResult shipped to the n8n workflow with full transcript + confirmation number.', edges: [10] },
  { active: ['n8n', 'outputs'], title: '9 · Long-horizon tracking', detail: 'n8n schedules Day 5 status check, Day 14 fax refile, Day 30 state DOI complaint. Status email sent to the patient. IRO escalation packet drafted.', edges: [11] },
];

// ─── Helpers ──────────────────────────────────────────────────────
function bezierPath(from: NodeKey, to: NodeKey) {
  const a = NODES[from], b = NODES[to];
  const x1 = a.x + a.w, y1 = a.y + a.h / 2;
  const x2 = b.x,       y2 = b.y + b.h / 2;
  const dx = (x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function leftOverlapPath(from: NodeKey, to: NodeKey) {
  // For edges going right-to-left (n8n → outputs)
  const a = NODES[from], b = NODES[to];
  const x1 = a.x, y1 = a.y + a.h / 2;
  const x2 = b.x + b.w, y2 = b.y + b.h / 2;
  const dx = (x1 - x2) * 0.55;
  return `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
}

// ─── Component ────────────────────────────────────────────────────
export default function ArchitectureFlow() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    tRef.current = window.setTimeout(() => {
      if (step >= STEPS.length - 1) {
        setStep(0); // loop
      } else {
        setStep(s => s + 1);
      }
    }, step === 0 ? 1500 : 2800);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [step, playing]);

  const current = STEPS[step];
  const activeSet = new Set(current.active);
  const activeEdges = new Set(current.edges);

  const nodeStyle = (key: NodeKey) => {
    const isActive = activeSet.has(key);
    return {
      fill: isActive ? 'var(--pa-accent)' : '#FFFFFF',
      stroke: isActive ? 'var(--pa-accent)' : 'rgba(31,36,33,0.25)',
      strokeWidth: isActive ? 2 : 1,
    };
  };
  const textStyle = (key: NodeKey) => ({
    fill: activeSet.has(key) ? '#FAF8F3' : 'var(--pa-ink)',
  });
  const subStyle = (key: NodeKey) => ({
    fill: activeSet.has(key) ? 'rgba(250,248,243,0.7)' : 'var(--pa-ink-3)',
  });

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      {/* ── Controls ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => { setStep(Math.max(0, step - 1)); setPlaying(false); }}
            className="pa-btn-ghost"
            style={{ padding: '0.45rem 0.7rem' }}
          ><SkipBack size={14} /></button>
          <button
            onClick={() => setPlaying(p => !p)}
            className="pa-btn-accent"
            style={{ padding: '0.5rem 1.1rem' }}
          >
            {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Auto-play flow</>}
          </button>
          <button
            onClick={() => { setStep(Math.min(STEPS.length - 1, step + 1)); setPlaying(false); }}
            className="pa-btn-ghost"
            style={{ padding: '0.45rem 0.7rem' }}
          ><SkipForward size={14} /></button>
          <button
            onClick={() => { setStep(0); setPlaying(false); }}
            className="pa-btn-ghost"
            style={{ padding: '0.45rem 0.7rem' }}
          ><RotateCcw size={12} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setStep(i); setPlaying(false); }}
              style={{
                width: '1.6rem', height: '1.6rem',
                borderRadius: '50%',
                background: i === step ? 'var(--pa-accent)' : i < step ? 'var(--pa-accent-soft)' : 'transparent',
                color: i === step ? 'white' : i < step ? 'var(--pa-accent)' : 'var(--pa-ink-3)',
                border: '1px solid ' + (i === step ? 'var(--pa-accent)' : 'var(--pa-rule-soft)'),
                fontSize: '0.7rem',
                fontFamily: 'Charter, serif',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* ── Current step caption ────────────────────────────────── */}
      <div className="pa-card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--pa-accent)' }}>
        <div className="pa-label" style={{ marginBottom: '0.35rem' }}>Step {step} of {STEPS.length - 1}</div>
        <div className="pa-serif" style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>{current.title}</div>
        <p style={{ fontSize: '0.92rem', color: 'var(--pa-ink-2)', lineHeight: 1.55, margin: 0 }}>{current.detail}</p>
      </div>

      {/* ── SVG diagram ─────────────────────────────────────────── */}
      <div style={{ background: 'white', border: '1px solid var(--pa-rule-soft)', borderRadius: '4px', padding: '0.5rem', overflow: 'hidden' }}>
        <svg viewBox="0 0 1600 600" style={{ width: '100%', display: 'block', fontFamily: 'Inter, sans-serif' }}>
          <defs>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--pa-accent)" />
            </marker>
            <marker id="arrow-idle" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(31,36,33,0.35)" />
            </marker>
          </defs>

          {/* Edges */}
          {EDGES.map((edge, i) => {
            const isActive = activeEdges.has(i + 1);
            const path = edge.from === 'n8n' && edge.to === 'outputs' ? leftOverlapPath(edge.from, edge.to) : bezierPath(edge.from, edge.to);
            return (
              <g key={i}>
                {/* Idle line */}
                <path
                  d={path}
                  fill="none"
                  stroke={isActive ? 'var(--pa-accent)' : 'rgba(31,36,33,0.18)'}
                  strokeWidth={isActive ? 2.5 : 1}
                  markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow-idle)'}
                  style={{ transition: 'all 0.4s ease' }}
                />
                {/* Animated flowing dash */}
                {isActive && (
                  <path
                    d={path}
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeDasharray="8 12"
                    style={{ animation: 'pa-flow 1.4s linear infinite' }}
                  />
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {(Object.keys(NODES) as NodeKey[]).map(key => {
            const n = NODES[key];
            const active = activeSet.has(key);
            return (
              <g key={key} style={{ transition: 'all 0.4s ease' }}>
                {/* Pulse ring when active */}
                {active && (
                  <rect
                    x={n.x - 6} y={n.y - 6}
                    width={n.w + 12} height={n.h + 12}
                    rx="6"
                    fill="none"
                    stroke="var(--pa-accent)"
                    strokeWidth="2"
                    opacity="0"
                    style={{ animation: 'pa-pulse-ring 1.6s ease-out infinite' }}
                  />
                )}
                <rect
                  x={n.x} y={n.y}
                  width={n.w} height={n.h}
                  rx="3"
                  {...nodeStyle(key)}
                  style={{ transition: 'all 0.4s ease' }}
                />
                <text
                  x={n.x + 14} y={n.y + 28}
                  fontSize="16"
                  fontWeight="500"
                  fontFamily="Charter, serif"
                  {...textStyle(key)}
                  style={{ transition: 'fill 0.4s ease' }}
                >
                  {n.label}
                </text>
                <text
                  x={n.x + 14} y={n.y + 49}
                  fontSize="11"
                  {...subStyle(key)}
                  style={{ transition: 'fill 0.4s ease' }}
                >
                  {n.sub}
                </text>
              </g>
            );
          })}

          {/* Tier labels */}
          <text x="20" y="32" fontSize="10" letterSpacing="2" fill="var(--pa-ink-3)" style={{ textTransform: 'uppercase' }}>USER · UI</text>
          <text x="370" y="32" fontSize="10" letterSpacing="2" fill="var(--pa-ink-3)" style={{ textTransform: 'uppercase' }}>ORCHESTRATOR · CLOUD RUN</text>
          <text x="755" y="32" fontSize="10" letterSpacing="2" fill="var(--pa-ink-3)" style={{ textTransform: 'uppercase' }}>SUB-AGENTS · GEMINI 3.5 FLASH</text>
          <text x="1075" y="32" fontSize="10" letterSpacing="2" fill="var(--pa-ink-3)" style={{ textTransform: 'uppercase' }}>FAN-IN · VOICE</text>
          <text x="1360" y="32" fontSize="10" letterSpacing="2" fill="var(--pa-ink-3)" style={{ textTransform: 'uppercase' }}>EXECUTION</text>
        </svg>
      </div>

      {/* ── Legend ──────────────────────────────────────────────── */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--pa-ink-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '14px', height: '14px', background: 'var(--pa-accent)', borderRadius: '2px' }} />
          Active in current step
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '14px', height: '14px', background: 'white', border: '1px solid var(--pa-rule-soft)', borderRadius: '2px' }} />
          Idle / waiting
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '24px', height: '2px', background: 'var(--pa-accent)' }} />
          Live data flow
        </div>
        <div style={{ marginLeft: 'auto', color: 'var(--pa-ink-3)' }}>
          Press <strong style={{ color: 'var(--pa-ink)' }}>Auto-play</strong> · keys ← → to step · {step}/{STEPS.length - 1}
        </div>
      </div>
    </div>
  );
}
