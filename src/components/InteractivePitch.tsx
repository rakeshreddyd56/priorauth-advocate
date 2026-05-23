'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, SkipBack, ArrowRight } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Pitch steps — designed for hackathon judging:
//   Impact (20%) · Live Demo (45%) · Creativity (35%)
// ──────────────────────────────────────────────────────────────────

interface PitchStep {
  kind: 'hook' | 'stat' | 'story' | 'asymmetry' | 'competitive' | 'wedge' | 'stack' | 'demo-cue' | 'impact' | 'close';
  title: string;
  subtitle?: string;
  body?: string;
  source?: string;
  data?: any;
}

const STEPS: PitchStep[] = [
  {
    kind: 'hook',
    title: 'PriorAuth Advocate',
    subtitle: 'We fight insurance denials so patients don\'t have to.',
    body: 'Administrative advocacy. Not medical advice. Built for the Google I/O Hackathon on the Gemini 3.5 Flash managed-agents stack.',
  },
  {
    kind: 'stat',
    title: '60 million',
    subtitle: 'Americans get a prior-authorization denial every month.',
    body: '70% give up. The average appeal takes 6 hours of paperwork and 3 phone calls. Less than 1% of denials are ever appealed.',
    source: 'KFF Health Tracking Poll, January 2026 · AMA 2024 Prior Authorization Physician Survey',
  },
  {
    kind: 'stat',
    title: '#1',
    subtitle: 'PA is the single biggest non-cost burden in US healthcare.',
    body: 'Ahead of appointment access (19%), billing (17%), in-network search (15%). 29% of physicians say PA caused a serious adverse event in their care — hospitalizations, life-threatening events, deaths.',
    source: 'KFF January 2026, n=1,426 · AMA 2024, n=1,000',
  },
  {
    kind: 'story',
    title: 'Meet Rakesh.',
    subtitle: '32 · Crohn\'s disease · Aetna PPO through his employer',
    body: 'His gastroenterologist prescribes Humira — the standard biologic. Aetna sends a denial: "Per Medical Policy 0341, azathioprine trial documented as 8 weeks; policy requires 12." Without Humira, Rakesh ends up in the ER multiple times a year. The fight to overturn this denial would normally take 6 weeks to 6 months.',
  },
  {
    kind: 'asymmetry',
    title: 'The asymmetry is the opportunity.',
    subtitle: 'Less than 1% of denials get appealed. Of those, 82% win.',
    body: 'The gap is paperwork. Not medicine, not policy — paperwork. That\'s the entire wedge.',
    source: 'KFF analysis of CMS Medicare Advantage data, February 2026',
  },
  {
    kind: 'competitive',
    title: 'Every AI in this space is on the wrong side.',
    subtitle: 'Until now: insurers automate denials. Patients have nothing.',
    body: 'Cohere Health, eviCore, Carelon, Optum — all sell automation to payers. On the patient side: Counterforce Health + Maxwell coach the patient through the call. We MAKE the call.',
  },
  {
    kind: 'wedge',
    title: 'Our wedge: end-to-end.',
    subtitle: 'Photo to filed appeal in 90 seconds. n8n keeps fighting for 60 days.',
    body: 'Counterforce drafts and coaches. PriorAuth Advocate drafts, files the call by phone, captures the confirmation number, schedules the follow-up timeline, and auto-escalates to IRO + State DOI if denied again.',
  },
  {
    kind: 'stack',
    title: 'Google managed-agents architecture.',
    subtitle: '5 Gemini sub-agents · Cloud Healthcare FHIR R4 · ElevenLabs · n8n',
    body: 'The first stack where this is buildable in a weekend. Sub-agents fan out in parallel under a planner agent that enforces strict Zod contracts. Real Cloud Healthcare API call. Real outbound voice. Durable long-horizon workflow.',
  },
  {
    kind: 'demo-cue',
    title: 'Now watch it run.',
    subtitle: 'Photo of an Aetna denial → live agent fleet → real phone call → confirmation A4-7821',
    body: 'Switch to the 01 Demo tab and click Run multi-agent pipeline. Sub-30-second end-to-end.',
  },
  {
    kind: 'impact',
    title: '320,000 / year',
    subtitle: '$640M – $1.6B in care delivered to patients who would have given up.',
    body: '4.1M Medicare Advantage denials per year × even just 10% appeal rate × 80% overturn rate = 320K reversed denials. At $2K–$5K per disputed claim — that\'s the impact math.',
    source: 'KFF Feb 2026 · CMS MA denial data',
  },
  {
    kind: 'close',
    title: 'We don\'t coach the call.',
    subtitle: 'We make the call.',
    body: 'And n8n keeps fighting for 60 days after.',
  },
];

// ──────────────────────────────────────────────────────────────────
// Big-number animation hook
// ──────────────────────────────────────────────────────────────────
function useCountUp(target: number, durationMs: number = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.floor(eased * target));
      if (t < 1) raf = requestAnimationFrame(step);
      else setVal(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

// ──────────────────────────────────────────────────────────────────
// Step renderers
// ──────────────────────────────────────────────────────────────────
function HookSlide({ step }: { step: PitchStep }) {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
      <div style={{
        width: '4rem', height: '4rem', borderRadius: '50%',
        border: '2px solid var(--pa-accent)', margin: '0 auto 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Charter, serif', color: 'var(--pa-accent)', fontSize: '2rem',
      }}>P</div>
      <h1 className="pa-serif" style={{ fontSize: '4rem', lineHeight: 1.05, marginBottom: '1.2rem' }}>{step.title}</h1>
      <p className="pa-serif" style={{ fontSize: '1.6rem', color: 'var(--pa-ink-2)', maxWidth: '34ch', margin: '0 auto 2rem', lineHeight: 1.35 }}>{step.subtitle}</p>
      <p style={{ fontSize: '0.95rem', color: 'var(--pa-ink-3)', maxWidth: '52ch', margin: '0 auto', lineHeight: 1.6 }}>{step.body}</p>
    </div>
  );
}

function StatSlide({ step }: { step: PitchStep }) {
  return (
    <div style={{ padding: '4rem 3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'right' }}>
        <div className="pa-serif" style={{ fontSize: '11rem', lineHeight: 0.9, color: 'var(--pa-accent)', letterSpacing: '-0.03em' }}>{step.title}</div>
      </div>
      <div>
        <h2 className="pa-serif" style={{ fontSize: '2.4rem', lineHeight: 1.2, marginBottom: '1.5rem' }}>{step.subtitle}</h2>
        <p style={{ fontSize: '1.05rem', color: 'var(--pa-ink-2)', lineHeight: 1.65, marginBottom: '2rem' }}>{step.body}</p>
        {step.source && <div className="pa-label" style={{ letterSpacing: '0.1em', fontSize: '0.7rem' }}>{step.source}</div>}
      </div>
    </div>
  );
}

function StorySlide({ step }: { step: PitchStep }) {
  return (
    <div style={{ padding: '4rem 3rem', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '3rem', alignItems: 'center' }}>
      {/* Synthetic letter visual */}
      <div className="pa-doc" style={{ transform: 'rotate(-2deg)', position: 'relative', maxWidth: '380px' }}>
        <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
          <span className="stamp">DENIED</span>
        </div>
        <div style={{ fontFamily: 'iA Writer Mono S, SF Mono, monospace', fontSize: '0.7rem', lineHeight: 1.5, color: 'var(--pa-ink-2)' }}>
          Aetna PPO<br/>
          Date: May 18, 2026<br/>
          Patient: R. R.<br/>
          Member ID: AET-***5821<br/>
          <br/>
          Service: Humira (adalimumab)<br/>
          40 mg SC q2w<br/>
          Prescriber: Dr. M. Patel<br/>
          <br/>
          <strong style={{ color: 'var(--pa-warn)' }}>DENIAL · PA-MED-NECESSITY</strong><br/>
          Per Medical Policy 0341,<br/>
          azathioprine trial documented<br/>
          as 8 weeks; policy requires 12.
        </div>
      </div>
      <div>
        <div className="pa-label" style={{ marginBottom: '0.6rem' }}>Real case · Real fight</div>
        <h1 className="pa-serif" style={{ fontSize: '3rem', lineHeight: 1.1, marginBottom: '0.8rem' }}>{step.title}</h1>
        <p className="pa-serif" style={{ fontSize: '1.3rem', color: 'var(--pa-ink-2)', marginBottom: '1.5rem', lineHeight: 1.4 }}>{step.subtitle}</p>
        <p style={{ fontSize: '1rem', lineHeight: 1.65, color: 'var(--pa-ink)' }}>{step.body}</p>
      </div>
    </div>
  );
}

function AsymmetrySlide({ step }: { step: PitchStep }) {
  return (
    <div style={{ padding: '3.5rem 3rem' }}>
      <div className="pa-label" style={{ marginBottom: '0.8rem' }}>The opportunity</div>
      <h1 className="pa-serif" style={{ fontSize: '3rem', marginBottom: '0.6rem', lineHeight: 1.1 }}>{step.title}</h1>
      <p className="pa-serif" style={{ fontSize: '1.4rem', color: 'var(--pa-ink-2)', marginBottom: '3rem', lineHeight: 1.35 }}>{step.subtitle}</p>

      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '18ch 1fr 8ch', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <div className="pa-serif" style={{ fontSize: '1.5rem' }}>Denials appealed</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--pa-ink-3)' }}>of every 100 denied claims</div>
          </div>
          <div style={{ height: '5.5rem', position: 'relative', background: 'transparent' }}>
            <div style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: '1%', height: '4rem', background: 'var(--pa-accent)',
              animation: 'pa-bar-grow 1.2s ease-out',
              transformOrigin: 'left',
            }} />
          </div>
          <div className="pa-serif" style={{ fontSize: '2.8rem', textAlign: 'right' }}>&lt;1%</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '18ch 1fr 8ch', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div className="pa-serif" style={{ fontSize: '1.5rem' }}>Appeals that win</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--pa-ink-3)' }}>Medicare Advantage, overturned</div>
          </div>
          <div style={{ height: '5.5rem', position: 'relative', background: 'transparent' }}>
            <div style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: '82%', height: '4rem', background: 'var(--pa-accent)',
              animation: 'pa-bar-grow 1.6s ease-out',
              transformOrigin: 'left',
            }} />
          </div>
          <div className="pa-serif" style={{ fontSize: '2.8rem', textAlign: 'right' }}>82%</div>
        </div>
      </div>

      <p style={{ fontStyle: 'italic', color: 'var(--pa-ink-2)', borderLeft: '3px solid var(--pa-accent)', paddingLeft: '1rem', marginBottom: '1.5rem' }}>{step.body}</p>
      {step.source && <div className="pa-label" style={{ letterSpacing: '0.1em', fontSize: '0.7rem' }}>{step.source}</div>}
    </div>
  );
}

function CompetitiveSlide({ step }: { step: PitchStep }) {
  return (
    <div style={{ padding: '3.5rem 3rem' }}>
      <div className="pa-label" style={{ marginBottom: '0.8rem' }}>Why no one has shipped this</div>
      <h1 className="pa-serif" style={{ fontSize: '2.6rem', marginBottom: '0.6rem', lineHeight: 1.15 }}>{step.title}</h1>
      <p className="pa-serif" style={{ fontSize: '1.3rem', color: 'var(--pa-ink-2)', marginBottom: '2.5rem', lineHeight: 1.4 }}>{step.subtitle}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="pa-card" style={{ borderLeft: '3px solid var(--pa-warn)' }}>
          <div className="pa-label" style={{ color: 'var(--pa-warn)', marginBottom: '0.5rem' }}>PAYER-SIDE AUTOMATION</div>
          <div className="pa-serif" style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>Cohere · eviCore · Carelon · Optum</div>
          <p style={{ fontSize: '0.92rem', color: 'var(--pa-ink-2)', lineHeight: 1.55 }}>The entire enterprise AI market is on the denial side. ProPublica revealed eviCore has "the dial" — internal AI tunable to raise denial rates. 3:1 ROI marketed to insurers.</p>
        </div>
        <div className="pa-card" style={{ borderLeft: '3px solid var(--pa-ink-3)' }}>
          <div className="pa-label" style={{ marginBottom: '0.5rem' }}>PATIENT-SIDE COACHING</div>
          <div className="pa-serif" style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>Counterforce + Maxwell</div>
          <p style={{ fontSize: '0.92rem', color: 'var(--pa-ink-2)', lineHeight: 1.55 }}>10K appeals processed, NIH-funded, Maxwell coaches the patient through the call. They stop at the letter and the coaching.</p>
        </div>
      </div>

      <div className="pa-card" style={{ borderLeft: '3px solid var(--pa-accent)', background: 'var(--pa-accent-bg)' }}>
        <div className="pa-label" style={{ color: 'var(--pa-accent)', marginBottom: '0.5rem' }}>OUR WEDGE</div>
        <p className="pa-serif" style={{ fontSize: '1.35rem', color: 'var(--pa-ink)', lineHeight: 1.35 }}>{step.body}</p>
      </div>
    </div>
  );
}

function WedgeSlide({ step }: { step: PitchStep }) {
  const beats = [
    { num: '1', label: 'Snap photo', detail: 'Denial letter → multimodal Intake' },
    { num: '2', label: 'Quote the policy', detail: 'Gemini + RAG cite verbatim' },
    { num: '3', label: 'Pull the chart', detail: 'Cloud Healthcare FHIR R4 live' },
    { num: '4', label: 'Draft the letter', detail: 'Gemini structured output' },
    { num: '5', label: 'Place the call', detail: 'ElevenLabs voice agent' },
    { num: '6', label: 'Track 60 days', detail: 'n8n IRO + State DOI escalation' },
  ];
  return (
    <div style={{ padding: '3.5rem 3rem' }}>
      <div className="pa-label" style={{ marginBottom: '0.8rem' }}>Six beats · 90 seconds end-to-end</div>
      <h1 className="pa-serif" style={{ fontSize: '2.8rem', marginBottom: '0.6rem', lineHeight: 1.15 }}>{step.title}</h1>
      <p className="pa-serif" style={{ fontSize: '1.3rem', color: 'var(--pa-ink-2)', marginBottom: '2.5rem', lineHeight: 1.4 }}>{step.subtitle}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {beats.map(b => (
          <div key={b.num} className="pa-card-tight" style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{
              width: '2.1rem', height: '2.1rem', borderRadius: '50%',
              background: 'var(--pa-accent)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Charter, serif', fontSize: '1rem', flexShrink: 0,
            }}>{b.num}</div>
            <div>
              <div className="pa-serif" style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>{b.label}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--pa-ink-3)', lineHeight: 1.45 }}>{b.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackSlide({ step }: { step: PitchStep }) {
  const products = [
    { color: '#1F4D2E', name: 'Gemini 3.5 Flash', detail: 'Reasoning core · all 5 sub-agents · structured JSON', google: true },
    { color: '#1F4D2E', name: 'Managed Agents (Antigravity / Vertex pattern)', detail: 'Parallel fan-out · strict Zod contracts · run-state persistence', google: true },
    { color: '#4285F4', name: 'Cloud Healthcare API', detail: 'FHIR R4 store · live patient pull · HIPAA-eligible', google: true },
    { color: '#1F4D2E', name: 'Cloud Run', detail: 'Backend planner · stateless · Application Default Credentials auth', google: true },
    { color: '#4285F4', name: 'AI Studio + Imagen 3', detail: 'API key broker · prompt sandbox · deck hero illustration', google: true },
    { color: '#C5663F', name: 'ElevenLabs Conversational AI', detail: 'Voice runtime · browser SDK + Twilio outbound · post-call webhook', google: false },
    { color: '#EA4B71', name: 'n8n', detail: 'Durable workflow · Day 5/14/30 follow-ups · IRO + State DOI escalation', google: false },
    { color: '#D04437', name: 'Gmail', detail: 'Status email · auto-sent on filed appeal · styled HTML template', google: true },
  ];
  return (
    <div style={{ padding: '3.5rem 3rem' }}>
      <div className="pa-label" style={{ marginBottom: '0.8rem' }}>The first stack where this is a product</div>
      <h1 className="pa-serif" style={{ fontSize: '2.8rem', marginBottom: '0.6rem', lineHeight: 1.15 }}>{step.title}</h1>
      <p className="pa-serif" style={{ fontSize: '1.25rem', color: 'var(--pa-ink-2)', marginBottom: '2rem', lineHeight: 1.4 }}>{step.subtitle}</p>
      <p style={{ fontSize: '0.98rem', color: 'var(--pa-ink-2)', lineHeight: 1.6, marginBottom: '2rem', maxWidth: '70ch' }}>{step.body}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem' }}>
        {products.map(p => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.75rem 0.85rem', background: 'var(--pa-paper)', border: '1px solid var(--pa-rule-soft)', borderRadius: '3px' }}>
            <div style={{ width: '0.55rem', height: '2.5rem', background: p.color, flexShrink: 0, borderRadius: '1px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <div className="pa-serif" style={{ fontSize: '1rem' }}>{p.name}</div>
                {p.google && <span style={{ fontSize: '0.65rem', color: 'var(--pa-accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Google</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--pa-ink-3)', marginTop: '0.15rem' }}>{p.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', padding: '0.9rem 1.1rem', background: 'var(--pa-accent-bg)', borderLeft: '3px solid var(--pa-accent)', fontSize: '0.92rem', color: 'var(--pa-ink-2)' }}>
        <strong style={{ color: 'var(--pa-accent)' }}>6 of 8 components are Google products.</strong> The two third-party pieces (ElevenLabs, n8n) integrate cleanly via Twilio + REST webhooks. The "managed agents" pattern is the heart of the architecture, fully aligned with the I/O managed-agents prize criterion.
      </div>
    </div>
  );
}

function DemoCueSlide({ step }: { step: PitchStep }) {
  return (
    <div style={{ padding: '5rem 3rem', textAlign: 'center' }}>
      <div className="pa-label" style={{ marginBottom: '1rem' }}>Time to see it for real</div>
      <h1 className="pa-serif" style={{ fontSize: '4rem', lineHeight: 1.1, marginBottom: '1.5rem' }}>{step.title}</h1>
      <p className="pa-serif" style={{ fontSize: '1.5rem', color: 'var(--pa-ink-2)', maxWidth: '46ch', margin: '0 auto 2.5rem', lineHeight: 1.4 }}>{step.subtitle}</p>
      <p style={{ fontSize: '1rem', color: 'var(--pa-ink-3)', maxWidth: '50ch', margin: '0 auto 3rem' }}>{step.body}</p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
        <div className="pa-btn-accent" style={{ pointerEvents: 'none', fontSize: '1rem' }}>
          Click 01 Demo tab → Run multi-agent pipeline <ArrowRight size={16} />
        </div>
      </div>
    </div>
  );
}

function ImpactSlide({ step }: { step: PitchStep }) {
  const count = useCountUp(320000);
  const fmt = count.toLocaleString();
  return (
    <div style={{ padding: '3.5rem 3rem' }}>
      <div className="pa-label" style={{ marginBottom: '0.8rem' }}>Impact math · if we close even a fraction of the gap</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '3rem', alignItems: 'center' }}>
        <div>
          <div className="pa-serif" style={{ fontSize: '8rem', lineHeight: 0.9, color: 'var(--pa-accent)', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>{fmt}</div>
          <div className="pa-serif" style={{ fontSize: '1.6rem', color: 'var(--pa-ink-2)' }}>reversed denials per year</div>
        </div>
        <div>
          <h2 className="pa-serif" style={{ fontSize: '1.8rem', lineHeight: 1.3, marginBottom: '1rem' }}>{step.subtitle}</h2>
          <p style={{ fontSize: '1rem', color: 'var(--pa-ink-2)', lineHeight: 1.65, marginBottom: '1.5rem' }}>{step.body}</p>
          {step.source && <div className="pa-label" style={{ letterSpacing: '0.1em', fontSize: '0.7rem' }}>{step.source}</div>}
        </div>
      </div>
    </div>
  );
}

function CloseSlide({ step }: { step: PitchStep }) {
  return (
    <div style={{ padding: '6rem 3rem', textAlign: 'center' }}>
      <h1 className="pa-serif" style={{ fontSize: '5rem', lineHeight: 1.05, marginBottom: '1rem', fontStyle: 'italic' }}>{step.title}</h1>
      <p className="pa-serif" style={{ fontSize: '3rem', color: 'var(--pa-accent)', marginBottom: '2rem', lineHeight: 1.2 }}>{step.subtitle}</p>
      <p style={{ fontSize: '1.1rem', color: 'var(--pa-ink-2)' }}>{step.body}</p>
      <div style={{ marginTop: '3rem', fontSize: '0.78rem', color: 'var(--pa-ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        PriorAuth Advocate · Google I/O Hackathon · May 2026
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────
export default function InteractivePitch() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    tRef.current = window.setTimeout(() => {
      if (step >= STEPS.length - 1) setStep(0);
      else setStep(s => s + 1);
    }, 8000);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [step, playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { setStep(s => Math.min(STEPS.length - 1, s + 1)); setPlaying(false); }
      else if (e.key === 'ArrowLeft') { setStep(s => Math.max(0, s - 1)); setPlaying(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = STEPS[step];

  const renderStep = () => {
    switch (current.kind) {
      case 'hook': return <HookSlide step={current} />;
      case 'stat': return <StatSlide step={current} />;
      case 'story': return <StorySlide step={current} />;
      case 'asymmetry': return <AsymmetrySlide step={current} />;
      case 'competitive': return <CompetitiveSlide step={current} />;
      case 'wedge': return <WedgeSlide step={current} />;
      case 'stack': return <StackSlide step={current} />;
      case 'demo-cue': return <DemoCueSlide step={current} />;
      case 'impact': return <ImpactSlide step={current} />;
      case 'close': return <CloseSlide step={current} />;
    }
  };

  return (
    <div style={{ background: 'var(--pa-bg)', minHeight: 'calc(100vh - 64px)' }}>
      {/* Slide content area */}
      <div key={step} style={{ maxWidth: '1280px', margin: '0 auto', animation: 'pa-fade-in 0.5s ease' }}>
        {renderStep()}
      </div>

      {/* Bottom control bar */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        background: 'rgba(250,248,243,0.95)', backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--pa-rule-soft)',
        padding: '0.7rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button onClick={() => { setStep(Math.max(0, step - 1)); setPlaying(false); }} className="pa-btn-ghost" style={{ padding: '0.4rem 0.65rem' }}><SkipBack size={14} /></button>
          <button onClick={() => setPlaying(p => !p)} className="pa-btn-accent" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}>
            {playing ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Auto-play pitch</>}
          </button>
          <button onClick={() => { setStep(Math.min(STEPS.length - 1, step + 1)); setPlaying(false); }} className="pa-btn-ghost" style={{ padding: '0.4rem 0.65rem' }}><SkipForward size={14} /></button>
          <button onClick={() => { setStep(0); setPlaying(false); }} className="pa-btn-ghost" style={{ padding: '0.4rem 0.65rem' }}><RotateCcw size={12} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => { setStep(i); setPlaying(false); }}
              title={s.title}
              style={{
                width: '1.4rem', height: '1.4rem', borderRadius: '50%',
                background: i === step ? 'var(--pa-accent)' : i < step ? 'var(--pa-accent-soft)' : 'transparent',
                color: i === step ? 'white' : i < step ? 'var(--pa-accent)' : 'var(--pa-ink-3)',
                border: '1px solid ' + (i === step ? 'var(--pa-accent)' : 'var(--pa-rule-soft)'),
                fontSize: '0.65rem', fontFamily: 'Charter, serif',
                cursor: 'pointer', padding: 0, lineHeight: 1,
              }}
            >{i}</button>
          ))}
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--pa-ink-3)', letterSpacing: '0.08em' }}>
          {step + 1} / {STEPS.length} · ← → to navigate
        </div>
      </div>
    </div>
  );
}
