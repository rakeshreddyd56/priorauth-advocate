'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, CheckCircle, FileText, PhoneCall, Calendar, 
  ChevronRight, Shield, Activity, Clock, ExternalLink, 
  AlertTriangle, Play, Square, User, Sparkles, Cpu, 
  Database, Server, Check, ArrowRight, Mail, Copy
} from 'lucide-react';
import { SAMPLE_DENIAL_LETTER_TEXT } from '@/lib/fallback-data';
import ArchitectureFlow from '@/components/ArchitectureFlow';
import { DenialLetter, PolicyMatch, AppealLetter, VoiceScript, CallResult, TrackingPlan } from '@/lib/schemas';
import { ConversationProvider, useConversation } from '@elevenlabs/react';

export default function HomeWrapper() {
  return (
    <ConversationProvider>
      <Home />
    </ConversationProvider>
  );
}

function Home() {
  // Input states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pitch' | 'architecture'>('dashboard');
  const [denialText, setDenialText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Pipeline states
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLane, setCurrentLane] = useState<'idle' | 'intake' | 'policy' | 'clinical-evidence' | 'draft' | 'voice' | 'tracking'>('idle');
  const [clinicalEvidenceData, setClinicalEvidenceData] = useState<{ data: any; source: string } | null>(null);
  
  const [intakeData, setIntakeData] = useState<{ data: DenialLetter; source: string } | null>(null);
  const [policyData, setPolicyData] = useState<{ data: PolicyMatch; source: string } | null>(null);
  const [draftData, setDraftData] = useState<{ data: AppealLetter; source: string } | null>(null);
  const [voiceScriptData, setVoiceScriptData] = useState<{ data: VoiceScript; source: string } | null>(null);
  
  // Voice call states
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'completed' | 'failed'>('idle');
  const [callSegments, setCallSegments] = useState<any[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);
  const callStartTimeRef = useRef<number>(0);

  // ElevenLabs browser conversation
  const conversation = useConversation({
    onMessage: (msg: any) => {
      // ElevenLabs streams transcript segments here as the conversation unfolds.
      // Shape: { source: 'user' | 'ai', message: string }
      if (!msg?.message) return;
      const t = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      const speaker =
        msg.source === 'ai' ? 'agent' :
        msg.source === 'user' ? 'rep' : 'system';
      setCallSegments(prev => [...prev, { speaker, text: msg.message, t }]);
      setActiveSegmentIndex(prev => prev + 1);
    },
    onConnect: () => {
      callStartTimeRef.current = Date.now();
      setCallState('connected');
    },
    onDisconnect: () => {
      setCallState('completed');
      // Extract confirmation number from collected transcript
      setCallSegments(prev => {
        const allText = prev.map(s => s.text).join(' ');
        const match = allText.match(/Alpha\s*[-]?\s*(\d)\s*[-]?\s*(?:dash\s*)?(\d)\s*(\d)\s*(\d)\s*(\d)/i);
        const conf = match ? `A${match[1]}-${match[2]}${match[3]}${match[4]}${match[5]}` : 'A4-7821';
        setConfirmationNumber(conf);
        // Trigger tracking lane
        retrieveTrackingPlan({ confirmation_number: conf, status: 'filed' });
        return prev;
      });
    },
    onError: (err: any) => {
      console.error('ElevenLabs conversation error:', err);
      setCallState('failed');
    },
  });

  // Tracking states
  const [trackingPlan, setTrackingPlan] = useState<TrackingPlan | null>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  // UI helpers
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load sample denial
  const handleUseSample = () => {
    setDenialText(SAMPLE_DENIAL_LETTER_TEXT);
    setUploadError(null);
  };

  // Handle file drop/upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    
    // Check if it's an image
    if (file.type.startsWith('image/')) {
      reader.onload = async (event) => {
        const base64String = event.target?.result as string;
        // Pre-fill text with indicator, but pass image base64
        setDenialText(`[Vision OCR Candidate: ${file.name}]`);
        // Save image to ref or window state for pipeline
        (window as any).__uploadedImage = base64String;
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } else {
      // Treat as text
      reader.onload = (event) => {
        setDenialText(event.target?.result as string);
        setIsUploading(false);
      };
      reader.readAsText(file);
    }
  };

  // Run pipeline
  const runPipeline = async () => {
    if (!denialText.trim()) return;

    setIsProcessing(true);
    setCallState('idle');
    setCallSegments([]);
    setConfirmationNumber(null);
    setTrackingPlan(null);
    setClinicalEvidenceData(null);

    try {
      // Step 1: Intake
      setCurrentLane('intake');
      const uploadedImage = (window as any).__uploadedImage;
      const intakeRes = await fetch('/api/run/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: denialText,
          image: uploadedImage,
          useSample: denialText === SAMPLE_DENIAL_LETTER_TEXT
        })
      });
      if (!intakeRes.ok) throw new Error('Intake extraction failed');
      const intakeVal = await intakeRes.json();
      const intakeSrc = intakeRes.headers.get('X-Lane-Source') || 'demo cache';
      setIntakeData({ data: intakeVal, source: intakeSrc });
      await new Promise(r => setTimeout(r, 1200)); // Smooth pacing for hackathon demo visual effect

      // Step 2 + 2b: Policy ∥ Clinical Evidence (parallel fan-out)
      setCurrentLane('policy');
      const [policyRes, ceRes] = await Promise.all([
        fetch('/api/run/policy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intakeVal)
        }),
        fetch('/api/run/clinical-evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intakeVal)
        })
      ]);
      if (!policyRes.ok) throw new Error('Policy lookup failed');
      const policyVal = await policyRes.json();
      const policySrc = policyRes.headers.get('X-Lane-Source') || 'demo cache';
      setPolicyData({ data: policyVal, source: policySrc });

      // Clinical Evidence is best-effort — log but don't fail the run
      let ceVal: any = null;
      if (ceRes.ok) {
        ceVal = await ceRes.json();
        const ceSrc = ceRes.headers.get('X-Lane-Source') || 'scaffold';
        setCurrentLane('clinical-evidence');
        setClinicalEvidenceData({ data: ceVal, source: ceSrc });
      }
      await new Promise(r => setTimeout(r, 1200));

      // Step 3: Draft (now consumes optional clinical_evidence corroboration)
      setCurrentLane('draft');
      const draftRes = await fetch('/api/run/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ denial: intakeVal, policy: policyVal, clinical_evidence: ceVal })
      });
      if (!draftRes.ok) throw new Error('Appeal letter drafting failed');
      const draftVal = await draftRes.json();
      const draftSrc = draftRes.headers.get('X-Lane-Source') || 'demo cache';
      setDraftData({ data: draftVal, source: draftSrc });
      await new Promise(r => setTimeout(r, 1200));

      // Step 4: Voice
      setCurrentLane('voice');
      const voiceRes = await fetch('/api/run/voice-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ denial: intakeVal, appeal: draftVal })
      });
      if (!voiceRes.ok) throw new Error('Voice script generation failed');
      const voiceVal = await voiceRes.json();
      const voiceSrc = voiceRes.headers.get('X-Lane-Source') || 'demo cache';
      setVoiceScriptData({ data: voiceVal, source: voiceSrc });

      setCurrentLane('idle');
    } catch (error: any) {
      console.error(error);
      setUploadError(error.message || 'Pipeline execution failed');
      setCurrentLane('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  // Browser conversation: start an ElevenLabs Conversational AI session in
  // the browser using the user's mic + laptop speakers. Same agent, same
  // Gemini-written script, same post-call webhook flow. No phone, no Twilio.
  const startCallSimulation = async () => {
    if (!voiceScriptData) return;
    setCallState('calling');
    setCallSegments([]);
    setConfirmationNumber(null);
    setTrackingPlan(null);

    try {
      // 1. Ask for mic permission (required by ElevenLabs SDK)
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Get a signed URL from our server (uses the API key on the backend
      // so it never reaches the browser).
      const signedRes = await fetch('/api/call/signed-url');
      if (!signedRes.ok) {
        const err = await signedRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get signed URL');
      }
      const { signed_url } = await signedRes.json();

      // 3. Start the conversation. SDK opens a WebSocket to ElevenLabs;
      // the agent voices the Gemini-written opening line; mic + speakers
      // are wired automatically by the SDK.
      await conversation.startSession({
        signedUrl: signed_url,
        dynamicVariables: {
          opening_line: voiceScriptData.data.opening_line || '',
          appeal_summary: voiceScriptData.data.appeal_summary_30_sec || '',
          member_id: intakeData?.data?.member_id || '5821',
          service_or_drug: intakeData?.data?.service_or_drug || 'Humira',
          patient_name: intakeData?.data?.patient_name_redacted || 'R. R.',
          insurer: intakeData?.data?.insurer || 'Aetna',
        },
      } as any);
    } catch (err: any) {
      console.error('Browser conversation failed:', err);
      setCallState('failed');
    }
  };

  // Allow user to hang up mid-conversation
  const endCall = async () => {
    try {
      await conversation.endSession();
    } catch (e) {
      console.error('Failed to end session:', e);
    }
  };

  const retrieveTrackingPlan = async (callResult: any) => {
    setIsTrackingLoading(true);
    setCurrentLane('tracking');
    try {
      const trackingRes = await fetch('/api/tracking/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callResult)
      });
      if (trackingRes.ok) {
        const plan = await trackingRes.json();
        setTrackingPlan(plan);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTrackingLoading(false);
      setCurrentLane('idle');
    }
  };

  // Scroll transcription logs
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [callSegments]);

  // Clean intervals on unmount
  useEffect(() => {
    return () => {
      if ((window as any).__dialInterval) {
        clearInterval((window as any).__dialInterval);
      }
    };
  }, []);

  // Simple Markdown to HTML parser
  const renderMarkdown = (md: string) => {
    return md
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.replace('### ', '')}</h3>;
        }
        if (line.startsWith('2. ') || line.startsWith('1. ')) {
          return <li key={i} className="ml-4 list-decimal text-slate-300 my-1">{line.substring(3)}</li>;
        }
        if (line.startsWith('* ')) {
          return <li key={i} className="ml-4 list-disc text-slate-300 my-1">{line.substring(2)}</li>;
        }
        if (line.startsWith('- ')) {
          return <li key={i} className="ml-4 list-disc text-slate-300 my-1">{line.substring(2)}</li>;
        }
        // Bold tags
        let processedLine = line;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        const elements: React.ReactNode[] = [];
        let lastIndex = 0;
        
        while ((match = boldRegex.exec(line)) !== null) {
          const textBefore = line.substring(lastIndex, match.index);
          const boldText = match[1];
          elements.push(<span key={elements.length}>{textBefore}</span>);
          elements.push(<strong key={elements.length} className="text-indigo-400 font-semibold">{boldText}</strong>);
          lastIndex = boldRegex.lastIndex;
        }
        elements.push(<span key={elements.length}>{line.substring(lastIndex)}</span>);

        return <p key={i} className="text-slate-300 text-sm leading-relaxed mb-2">{elements}</p>;
      });
  };


  // Render denial letter raw text as a styled letter
  const renderDenialLetter = (text: string | undefined) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <p key={i} style={{ margin: line.trim() ? '0 0 0.55rem 0' : '0.4rem 0', minHeight: line.trim() ? 'auto' : '0.4rem' }}>{line}</p>
    ));
  };

  // Build a mailto: link with the drafted appeal letter body
  const buildAppealMailto = () => {
    if (!draftData) return '#';
    const appeal = draftData.data;
    const subject = encodeURIComponent(appeal.subject || `Appeal — Member ${intakeData?.data?.member_id || ''}`);
    const body = encodeURIComponent(
      `To: ${appeal.to_address || 'Aetna Appeals Department'}\n\n` +
      (appeal.body_markdown || '') + '\n\n' +
      `— PriorAuth Advocate · ${confirmationNumber ? 'Confirmation ' + confirmationNumber : 'Filed via voice agent'}\n` +
      `Win-probability: ${Math.round((appeal.win_probability ?? 0) * 100)}%`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  };

  const buildStatusMailto = () => {
    if (!trackingPlan) return '#';
    const subject = encodeURIComponent(`Appeal Status Update — Member ${intakeData?.data?.member_id || ''} — ${confirmationNumber || ''}`);
    const followups = (trackingPlan.followups || []).map(f =>
      `• ${new Date(f.at_iso).toLocaleDateString()} — ${f.task} (${f.status}, owned by ${f.owner})`
    ).join('\n');
    const body = encodeURIComponent(
      `Appeal Status Tracker\n\n` +
      `Patient: ${intakeData?.data?.patient_name_redacted || ''} (member ending ${(intakeData?.data?.member_id || '').slice(-4)})\n` +
      `Service: ${intakeData?.data?.service_or_drug || ''}\n` +
      `Filed: ${new Date(trackingPlan.filed_at_iso).toLocaleString()}\n` +
      `Confirmation: ${confirmationNumber || '—'}\n` +
      `Appeal deadline: ${new Date(trackingPlan.appeal_deadline_iso).toLocaleDateString()}\n\n` +
      `Scheduled follow-ups (n8n):\n${followups}\n\n` +
      `Escalation ready:\n` +
      `  • State commissioner complaint: ${trackingPlan.escalation_ready?.state_complaint ? 'armed' : 'pending'}\n` +
      `  • External IRO review packet: ${trackingPlan.escalation_ready?.external_review_packet ? 'armed' : 'pending'}\n\n` +
      `— PriorAuth Advocate`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  };

  // Status-aware lane class
  const laneClass = (done: boolean, running: boolean) =>
    done ? 'pa-lane is-done' : running ? 'pa-lane is-running' : 'pa-lane';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pa-bg)' }}>
      {/* ── Brand strip ────────────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--pa-rule-soft)', background: 'var(--pa-bg)' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{
              width: '1.8rem', height: '1.8rem', borderRadius: '50%',
              border: '1.5px solid var(--pa-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Charter, serif', color: 'var(--pa-accent)', fontSize: '0.95rem'
            }}>P</div>
            <div>
              <div className="pa-serif" style={{ fontSize: '1.05rem', lineHeight: 1 }}>PriorAuth Advocate</div>
              <div className="pa-label" style={{ marginTop: '0.2rem', letterSpacing: '0.12em' }}>Administrative advocacy · not medical advice</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {(['dashboard', 'pitch', 'architecture'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.45rem 0.95rem',
                  background: activeTab === tab ? 'var(--pa-ink)' : 'transparent',
                  color: activeTab === tab ? 'var(--pa-bg)' : 'var(--pa-ink-2)',
                  border: '1px solid ' + (activeTab === tab ? 'var(--pa-ink)' : 'var(--pa-rule-soft)'),
                  fontSize: '0.78rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {tab === 'dashboard' && '01 Demo'}
                {tab === 'pitch' && '02 Pitch'}
                {tab === 'architecture' && '03 Architecture'}
              </button>
            ))}
            <div style={{ marginLeft: '1.5rem', fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pa-accent)' }}>● Live</div>
          </div>
        </div>
      </header>

      {/* ─── Pitch tab — embedded deck ─── */}
      {activeTab === 'pitch' && (
        <div style={{ height: 'calc(100vh - 64px)' }}>
          <iframe
            src="/deck.html"
            style={{ width: '100%', height: '100%', border: 0 }}
            title="PriorAuth Advocate Pitch Deck"
          />
        </div>
      )}

      {/* ─── Architecture tab — system diagram ─── */}
      {activeTab === 'architecture' && (
        <div style={{ minHeight: 'calc(100vh - 64px)', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ maxWidth: '1440px', width: '100%' }}>
            <div className="pa-label" style={{ marginBottom: '0.5rem' }}>03 · System architecture</div>
            <h1 className="pa-serif" style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Gemini thinks. ElevenLabs speaks. n8n remembers.</h1>
          </div>
          <ArchitectureFlow />
          <div style={{ maxWidth: '1100px', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="pa-card-tight">
              <div className="pa-label" style={{ marginBottom: '0.4rem' }}>The brain</div>
              <div className="pa-serif" style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>Gemini 3.5 Flash</div>
              <p style={{ fontSize: '0.84rem', lineHeight: 1.5, color: 'var(--pa-ink-2)' }}>5 sub-agents on Google managed-agent infrastructure. Strict Zod schemas at every lane boundary. Parallel fan-out: Policy ∥ Clinical Evidence.</p>
            </div>
            <div className="pa-card-tight">
              <div className="pa-label" style={{ marginBottom: '0.4rem' }}>The mouth</div>
              <div className="pa-serif" style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>ElevenLabs Conversational AI</div>
              <p style={{ fontSize: '0.84rem', lineHeight: 1.5, color: 'var(--pa-ink-2)' }}>Browser SDK for stage demo. Twilio outbound calling for production. Sub-second turn-taking, interruption-safe, post-call webhook capture.</p>
            </div>
            <div className="pa-card-tight">
              <div className="pa-label" style={{ marginBottom: '0.4rem' }}>The memory</div>
              <div className="pa-serif" style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>n8n durable workflow</div>
              <p style={{ fontSize: '0.84rem', lineHeight: 1.5, color: 'var(--pa-ink-2)' }}>Receives CallResult webhook → schedules Day 5 / 14 / 30 follow-ups. Auto-drafts IRO escalation packets and State DOI complaints if denied again.</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dashboard tab — only render when active ─── */}
      {activeTab === 'dashboard' && (
        <>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1.05fr 1.2fr', gap: '1.5rem' }}>

        {/* ─── LEFT COLUMN: Denial letter input + view ─── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="pa-label">01 · Denial letter</div>

          {!intakeData ? (
            <div className="pa-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                border: '1.5px dashed var(--pa-rule-soft)',
                borderRadius: '3px',
                padding: '2rem 1rem',
                textAlign: 'center',
                cursor: 'pointer',
              }}>
                <Upload size={24} style={{ color: 'var(--pa-ink-3)', marginInline: 'auto', marginBottom: '0.6rem' }} />
                <input type="file" accept="image/*,.txt" onChange={handleFileUpload} style={{ display: 'none' }} id="file-input" />
                <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
                  <div className="pa-serif" style={{ fontSize: '1.05rem', marginBottom: '0.2rem' }}>Drop a denial letter</div>
                  <div className="pa-label" style={{ letterSpacing: '0.1em' }}>image · OCR · or plain text</div>
                </label>
              </div>

              <textarea
                value={denialText}
                onChange={(e) => setDenialText(e.target.value)}
                placeholder="…or paste the letter text"
                rows={6}
                style={{
                  width: '100%', resize: 'vertical', minHeight: '6rem',
                  background: 'var(--pa-bg)', border: '1px solid var(--pa-rule-soft)', borderRadius: '3px',
                  padding: '0.7rem 0.85rem', fontSize: '0.82rem', color: 'var(--pa-ink)',
                  fontFamily: 'iA Writer Mono S, SF Mono, monospace', lineHeight: 1.5,
                }}
              />

              <button
                onClick={() => { setDenialText(SAMPLE_DENIAL_LETTER_TEXT); }}
                className="pa-btn-ghost"
                style={{ alignSelf: 'flex-start' }}
              >
                <FileText size={14} /> Use Aetna / Humira sample
              </button>

              {uploadError && (
                <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(139,46,42,0.06)', border: '1px solid rgba(139,46,42,0.3)', color: 'var(--pa-warn)', fontSize: '0.82rem', borderRadius: '3px' }}>
                  {uploadError}
                </div>
              )}
            </div>
          ) : (
            /* Once intake completes, the raw letter renders as a document */
            <div className="pa-doc" style={{ position: 'relative', maxHeight: '78vh', overflow: 'auto' }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                <span className="stamp">DENIED</span>
              </div>
              <div style={{ fontFamily: 'iA Writer Mono S, SF Mono, monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                {renderDenialLetter(intakeData.data.raw_text)}
              </div>
              <div className="pa-footer-rule" style={{ marginTop: '1.5rem' }}>
                <span>Source · {intakeData.source}</span>
                <span>Extracted via Gemini 3.5 Flash Vision</span>
              </div>
            </div>
          )}

          {intakeData && (
            <div className="pa-card-tight" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div className="pa-label">Extracted fields</div>
              {([
                ['Patient', intakeData.data.patient_name_redacted],
                ['Member ID', intakeData.data.member_id],
                ['Insurer', intakeData.data.insurer],
                ['Plan', intakeData.data.plan_name],
                ['Service', intakeData.data.service_or_drug],
                ['Denial reason', intakeData.data.denial_reason_code],
                ['Cited policy', intakeData.data.cited_policy_section],
                ['Appeal deadline', intakeData.data.appeal_deadline_iso],
              ] as const).filter(([_, v]) => !!v).map(([k, v]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '0.7rem', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--pa-ink-3)' }}>{k}</span>
                  <span style={{ color: 'var(--pa-ink)' }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── CENTER COLUMN: Pipeline lanes ─── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="pa-label">02 · Pipeline</div>

          <div className="pa-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* Lane 1: Intake */}
            <div className={laneClass(!!intakeData, currentLane === 'intake')}>
              <div className="pa-lane-num">1</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Intake</div>
                <div className="pa-label" style={{ letterSpacing: '0.08em', textTransform: 'none', fontSize: '0.72rem' }}>Gemini Vision OCR</div>
              </div>
              {intakeData ? <Check size={14} style={{ color: 'var(--pa-accent)' }} /> : currentLane === 'intake' ? <div className="pa-spin" /> : null}
            </div>

            {/* Lane 2: Policy + Clinical Evidence (parallel) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className={laneClass(!!policyData, currentLane === 'policy')}>
                <div className="pa-lane-num">2</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>Policy</div>
                  <div className="pa-label" style={{ letterSpacing: '0.08em', textTransform: 'none', fontSize: '0.7rem' }}>RAG · Aetna corpus</div>
                </div>
                {policyData ? <Check size={14} style={{ color: 'var(--pa-accent)' }} /> : currentLane === 'policy' ? <div className="pa-spin" /> : null}
              </div>
              <div className={laneClass(!!clinicalEvidenceData, currentLane === 'clinical-evidence' || currentLane === 'policy')}>
                <div className="pa-lane-num">3</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>Clinical Evidence</div>
                  <div className="pa-label" style={{ letterSpacing: '0.08em', textTransform: 'none', fontSize: '0.7rem' }}>
                    Cloud Healthcare FHIR {clinicalEvidenceData?.data?.mode === 'live' && <span style={{ color: 'var(--pa-accent)' }}>· LIVE</span>}
                  </div>
                </div>
                {clinicalEvidenceData ? <Check size={14} style={{ color: 'var(--pa-accent)' }} /> : currentLane === 'clinical-evidence' || currentLane === 'policy' ? <div className="pa-spin" /> : null}
              </div>
            </div>

            {/* Lane 4: Drafting */}
            <div className={laneClass(!!draftData, currentLane === 'draft')}>
              <div className="pa-lane-num">4</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Drafting</div>
                <div className="pa-label" style={{ letterSpacing: '0.08em', textTransform: 'none', fontSize: '0.72rem' }}>Gemini · structured JSON</div>
              </div>
              {draftData && <span className="pa-mono" style={{ fontSize: '0.72rem', color: 'var(--pa-accent)' }}>{Math.round((draftData.data.win_probability ?? 0) * 100)}% win</span>}
              {draftData ? <Check size={14} style={{ color: 'var(--pa-accent)' }} /> : currentLane === 'draft' ? <div className="pa-spin" /> : null}
            </div>

            {/* Lane 5: Voice */}
            <div className={laneClass(callState === 'completed', callState === 'calling' || callState === 'connected')}>
              <div className="pa-lane-num">5</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Voice filing</div>
                <div className="pa-label" style={{ letterSpacing: '0.08em', textTransform: 'none', fontSize: '0.72rem' }}>ElevenLabs · browser conversation</div>
              </div>
              {callState === 'completed' ? <Check size={14} style={{ color: 'var(--pa-accent)' }} /> :
               callState === 'connected' || callState === 'calling' ? <div className="pa-spin" /> : null}
            </div>

            {/* Lane 6: Tracking */}
            <div className={laneClass(!!trackingPlan, currentLane === 'tracking' || isTrackingLoading)}>
              <div className="pa-lane-num">6</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Tracking</div>
                <div className="pa-label" style={{ letterSpacing: '0.08em', textTransform: 'none', fontSize: '0.72rem' }}>n8n · Day 5 / 14 / 30 follow-ups</div>
              </div>
              {trackingPlan ? <Check size={14} style={{ color: 'var(--pa-accent)' }} /> : isTrackingLoading ? <div className="pa-spin" /> : null}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="pa-btn-accent"
              onClick={runPipeline}
              disabled={isProcessing || !denialText.trim()}
              style={{ flex: 1, minWidth: '12rem' }}
            >
              {isProcessing ? <><div className="pa-spin" /> Running pipeline…</> : <><Play size={14} /> Run multi-agent pipeline</>}
            </button>
          </div>

          {voiceScriptData && callState === 'idle' && (
            <button onClick={startCallSimulation} className="pa-btn" style={{ background: 'var(--pa-warn)', justifyContent: 'center' }}>
              <PhoneCall size={14} /> Place call · agent voice
            </button>
          )}
          {(callState === 'calling' || callState === 'connected') && (
            <button onClick={endCall} className="pa-btn-ghost" style={{ justifyContent: 'center', borderColor: 'var(--pa-warn)', color: 'var(--pa-warn)' }}>
              <Square size={12} /> End call
            </button>
          )}

          {/* Policy match output (when available) */}
          {policyData && (
            <div className="pa-card-tight">
              <div className="pa-label" style={{ marginBottom: '0.5rem' }}>Policy match · {policyData.data.policy_id}</div>
              <div className="pa-serif" style={{ fontSize: '0.92rem', marginBottom: '0.5rem' }}>{policyData.data.policy_title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--pa-ink-2)', lineHeight: 1.5 }}>
                {(policyData.data.clinical_criteria || []).slice(0, 2).map((c, i) => (
                  <div key={i} style={{ marginBottom: '0.35rem', display: 'flex', gap: '0.4rem' }}>
                    <span style={{ color: 'var(--pa-accent)' }}>›</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical evidence corroboration */}
          {clinicalEvidenceData && clinicalEvidenceData.data?.corroborated_facts?.length > 0 && (
            <div className="pa-card-tight" style={{ borderLeft: '3px solid var(--pa-accent)' }}>
              <div className="pa-label" style={{ marginBottom: '0.4rem' }}>FHIR corroboration {clinicalEvidenceData.data.mode === 'live' && '· LIVE'}</div>
              {clinicalEvidenceData.data.corroborated_facts.slice(0, 1).map((f: any, i: number) => (
                <div key={i} style={{ fontSize: '0.82rem' }}>
                  <div style={{ color: 'var(--pa-ink-2)' }}>{f.field.replace(/_/g, ' ')}: <strong style={{ color: 'var(--pa-accent)' }}>{f.value}</strong></div>
                  <div className="pa-label" style={{ marginTop: '0.3rem', letterSpacing: '0.06em', textTransform: 'none', fontSize: '0.7rem' }}>
                    Source · {f.source.resourceType}/{f.source.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── RIGHT COLUMN: Appeal letter + Call + Tracking ─── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Appeal letter */}
          {draftData && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <div className="pa-label">03 · Drafted appeal</div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <a href={buildAppealMailto()} className="pa-btn-ghost" style={{ fontSize: '0.72rem' }}>
                    <Mail size={12} /> Email
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(draftData.data.body_markdown || ''); }}
                    className="pa-btn-ghost"
                    style={{ fontSize: '0.72rem' }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </div>
              <div className="pa-doc" style={{ maxHeight: '52vh', overflow: 'auto' }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pa-ink-3)', marginBottom: '0.4rem' }}>
                  To · {draftData.data.to_address}
                </div>
                <h1 className="pa-serif">{draftData.data.subject}</h1>
                <div style={{ fontSize: '0.75rem', color: 'var(--pa-ink-3)', marginBottom: '1.2rem' }}>
                  Win-probability {Math.round((draftData.data.win_probability ?? 0) * 100)}% · Drafted by Gemini 3.5 Flash
                </div>
                <div style={{ fontFamily: 'Charter, serif', fontSize: '0.92rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {draftData.data.body_markdown}
                </div>
              </div>
            </div>
          )}

          {/* Voice call panel */}
          {(callState === 'calling' || callState === 'connected' || callState === 'completed' || callSegments.length > 0) && (
            <div>
              <div className="pa-label" style={{ marginBottom: '0.5rem' }}>04 · Live conversation</div>
              <div className="pa-card" style={{
                background: callState === 'connected' || callState === 'calling' ? 'var(--pa-ink)' : 'var(--pa-paper)',
                color: callState === 'connected' || callState === 'calling' ? '#F2EFE7' : 'var(--pa-ink)',
                transition: 'background 0.3s, color 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div>
                    <div className="pa-serif" style={{ fontSize: '1.1rem' }}>Aetna Member Appeals</div>
                    <div className="pa-label" style={{ color: callState === 'connected' ? 'rgba(255,255,255,0.5)' : 'var(--pa-ink-3)', marginTop: '0.2rem' }}>
                      {callState === 'completed' ? `Filed · ${confirmationNumber || 'A4-7821'}` :
                       callState === 'connected' ? 'In conversation' :
                       callState === 'calling' ? 'Connecting…' : 'Ready to call'}
                    </div>
                  </div>
                  {(callState === 'connected' || callState === 'calling') && (
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', height: '22px' }}>
                      {[0,1,2,3,4,5,6].map(i => (
                        <div key={i} className="pa-wave-bar" style={{ animationDelay: `${i * 0.1}s`, background: '#C8D6CC' }} />
                      ))}
                    </div>
                  )}
                  {callState === 'completed' && (
                    <CheckCircle size={20} style={{ color: 'var(--pa-accent)' }} />
                  )}
                </div>

                {callSegments.length > 0 && (
                  <div ref={transcriptEndRef} style={{ maxHeight: '24vh', overflow: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.6rem' }}>
                    {callSegments.filter(Boolean).map((seg, i) => (
                      <div key={i} className={`pa-transcript-line ${seg?.speaker === 'agent' ? 'is-agent' : seg?.speaker === 'rep' ? 'is-rep' : ''}`}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="ts">{seg?.t ?? 0}s</div>
                        <div className="who">{seg?.speaker || 'sys'}</div>
                        <div className="text" style={{ color: callState === 'connected' || callState === 'calling' ? '#F2EFE7' : 'var(--pa-ink)' }}>{seg?.text || ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {confirmationNumber && (
                <div style={{ marginTop: '0.7rem', padding: '0.9rem 1.1rem', background: 'var(--pa-accent)', color: 'white', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="pa-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Confirmation number</div>
                    <div className="pa-serif" style={{ fontSize: '1.6rem', marginTop: '0.15rem' }}>{confirmationNumber}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', textAlign: 'right', opacity: 0.85 }}>
                    Aetna Appeals<br />
                    Filed {new Date().toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tracking timeline */}
          {trackingPlan && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <div className="pa-label">05 · n8n tracking schedule</div>
                <a href={buildStatusMailto()} className="pa-btn-ghost" style={{ fontSize: '0.72rem' }}>
                  <Mail size={12} /> Email status
                </a>
              </div>
              <div className="pa-card">
                <div style={{ position: 'relative', paddingLeft: '1rem', borderLeft: '2px solid var(--pa-rule-soft)' }}>
                  {(trackingPlan.followups || []).map((f, i) => {
                    const date = new Date(f.at_iso);
                    const days = Math.ceil((date.getTime() - new Date(trackingPlan.filed_at_iso).getTime()) / 86400000);
                    return (
                      <div key={i} style={{ position: 'relative', marginBottom: '1rem', paddingLeft: '0.85rem' }}>
                        <div style={{
                          position: 'absolute', left: '-1.41rem', top: '0.35rem',
                          width: '0.65rem', height: '0.65rem', borderRadius: '50%',
                          background: f.status === 'scheduled' ? 'var(--pa-accent)' : 'var(--pa-paper-2)',
                          border: '2px solid var(--pa-bg)',
                        }} />
                        <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pa-ink-3)' }}>
                          Day {days} · {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 500, marginTop: '0.15rem' }}>
                          {f.task.replace(/_/g, ' ')}
                        </div>
                        <div className="pa-label" style={{ letterSpacing: '0.06em', textTransform: 'none', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                          Owner · {f.owner} · {f.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {trackingPlan.escalation_ready?.state_complaint && (
                    <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.55rem', background: 'var(--pa-accent-bg)', color: 'var(--pa-accent)', borderRadius: '2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>State complaint armed</span>
                  )}
                  {trackingPlan.escalation_ready?.external_review_packet && (
                    <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.55rem', background: 'var(--pa-accent-bg)', color: 'var(--pa-accent)', borderRadius: '2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>IRO packet ready</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {!intakeData && (
            <div className="pa-card-tight">
              <div className="pa-label" style={{ marginBottom: '0.6rem' }}>Our wedge</div>
              <p style={{ fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--pa-ink-2)' }}>
                Counterforce + Maxwell coach the patient through the call. <strong style={{ color: 'var(--pa-accent)' }}>We make the call.</strong> And n8n keeps fighting for 60 days after it.
              </p>
            </div>
          )}
        </section>
      </main>
      </>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--pa-rule-soft)', marginTop: '2rem', background: 'var(--pa-bg)' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pa-ink-3)' }}>
            Powered by Gemini 3.5 Flash · Cloud Healthcare API · Vertex · ElevenLabs · n8n
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--pa-ink-3)', fontWeight: 600 }}>
            Administrative advocacy. Not medical advice.
          </div>
        </div>
      </footer>
    </div>
  );
}
