'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, CheckCircle, FileText, PhoneCall, Calendar, 
  ChevronRight, Shield, Activity, Clock, ExternalLink, 
  AlertTriangle, Play, Square, User, Sparkles, Cpu, 
  Database, Server, Check, ArrowRight
} from 'lucide-react';
import { SAMPLE_DENIAL_LETTER_TEXT } from '@/lib/fallback-data';
import { DenialLetter, PolicyMatch, AppealLetter, VoiceScript, CallResult, TrackingPlan } from '@/lib/schemas';

export default function Home() {
  // Input states
  const [denialText, setDenialText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Pipeline states
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLane, setCurrentLane] = useState<'idle' | 'intake' | 'policy' | 'draft' | 'voice' | 'tracking'>('idle');
  
  const [intakeData, setIntakeData] = useState<{ data: DenialLetter; source: string } | null>(null);
  const [policyData, setPolicyData] = useState<{ data: PolicyMatch; source: string } | null>(null);
  const [draftData, setDraftData] = useState<{ data: AppealLetter; source: string } | null>(null);
  const [voiceScriptData, setVoiceScriptData] = useState<{ data: VoiceScript; source: string } | null>(null);
  
  // Voice call states
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'completed' | 'failed'>('idle');
  const [callSegments, setCallSegments] = useState<any[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);

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

      // Step 2: Policy
      setCurrentLane('policy');
      const policyRes = await fetch('/api/run/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intakeVal)
      });
      if (!policyRes.ok) throw new Error('Policy lookup failed');
      const policyVal = await policyRes.json();
      const policySrc = policyRes.headers.get('X-Lane-Source') || 'demo cache';
      setPolicyData({ data: policyVal, source: policySrc });
      await new Promise(r => setTimeout(r, 1200));

      // Step 3: Draft
      setCurrentLane('draft');
      const draftRes = await fetch('/api/run/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ denial: intakeVal, policy: policyVal })
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

  // Dial Simulator
  const startCallSimulation = async () => {
    if (!voiceScriptData) return;
    setCallState('calling');
    setCallSegments([]);
    setConfirmationNumber(null);
    setTrackingPlan(null);

    // Call start endpoint
    try {
      const callRes = await fetch('/api/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceScript: voiceScriptData.data })
      });
      const callInitResult = await callRes.json();

      // Retrieve full segments from database to stream them in UI
      // We will pull the mock call result segments
      const webhookRes = await fetch('/api/webhooks/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_sid: callInitResult.call_sid,
          status: 'filed'
        })
      });
      const webhookResult = await webhookRes.json();
      const segments = webhookResult.callResult.transcript_segments;

      setCallSegments([]);
      let segmentIndex = 0;
      setCallState('connected');

      const interval = setInterval(() => {
        if (segmentIndex < segments.length) {
          setCallSegments(prev => [...prev, segments[segmentIndex]]);
          segmentIndex++;
          setActiveSegmentIndex(segmentIndex);
        } else {
          clearInterval(interval);
          setCallState('completed');
          setConfirmationNumber(webhookResult.callResult.confirmation_number);
          
          // Step 5: Trigger Tracking Plan Retrieval
          retrieveTrackingPlan(webhookResult.callResult);
        }
      }, 2500); // Display segment every 2.5s

      (window as any).__dialInterval = interval;
    } catch (err) {
      console.error(err);
      setCallState('failed');
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

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              PriorAuth Advocate
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              I/O Hackathon '26
            </span>
          </div>
          <p className="text-slate-400 mt-2 text-sm max-w-xl">
            Automating insurer prior authorization appeals via managed multi-agent workflows. 
            <span className="block text-indigo-400 font-medium mt-1">
              "Gemini thinks. ElevenLabs speaks. n8n remembers."
            </span>
          </p>
        </div>

        {/* Product Chips */}
        <div className="flex flex-wrap gap-2 max-w-md md:justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Gemini 3.5 Flash
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            Managed Agents
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            Vertex AI Vector Search
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
            <Server className="w-3.5 h-3.5 text-pink-400" />
            Firestore & Cloud Run
          </div>
        </div>
      </header>

      {/* Safety Boundary Banner */}
      <div className="mb-6 bg-slate-950 border border-indigo-900/30 rounded-xl p-4 flex items-start gap-3 glass-panel">
        <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-slate-200">Non-Negotiable Safety Boundary:</strong> Administrative advocacy, not medical advice. Never recommend a treatment, diagnosis, dose, medication change, or clinical decision. The prescribing physician has already established the care regime. PriorAuth Advocate only reads insurer paperwork, quotes policy language, drafts administrative appeal letters, files appeals by simulated voice IVR, and monitors response deadlines.
        </div>
      </div>

      {/* Core Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column: Lane tracker, input zone */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Five Stable Status Lanes */}
          <div className="rounded-xl glass-panel p-5 border border-slate-800 glass-panel-glow">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Pipeline Execution Lanes
            </h2>
            <div className="space-y-4">
              {/* Lane 1: Intake */}
              <div className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                intakeData ? 'bg-indigo-950/20 border-indigo-500/30' : 
                currentLane === 'intake' ? 'bg-slate-900 border-indigo-500/50 animate-pulse' : 
                'bg-slate-950/40 border-slate-900'
              }`}>
                <div className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    intakeData ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'
                  }`}>
                    1
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Intake Analysis</h3>
                    <p className="text-[10px] text-slate-400">Gemini Vision OCR extraction</p>
                  </div>
                </div>
                {intakeData && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {intakeData.source}
                  </span>
                )}
              </div>

              {/* Lane 2: Policy */}
              <div className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                policyData ? 'bg-indigo-950/20 border-indigo-500/30' : 
                currentLane === 'policy' ? 'bg-slate-900 border-indigo-500/50 animate-pulse' : 
                'bg-slate-950/40 border-slate-900'
              }`}>
                <div className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    policyData ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'
                  }`}>
                    2
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Policy Snippets</h3>
                    <p className="text-[10px] text-slate-400">RAG Guideline Mapping</p>
                  </div>
                </div>
                {policyData && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {policyData.source}
                  </span>
                )}
              </div>

              {/* Lane 3: Drafting */}
              <div className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                draftData ? 'bg-indigo-950/20 border-indigo-500/30' : 
                currentLane === 'draft' ? 'bg-slate-900 border-indigo-500/50 animate-pulse' : 
                'bg-slate-950/40 border-slate-900'
              }`}>
                <div className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    draftData ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'
                  }`}>
                    3
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Administrative appeal copy</h3>
                    <p className="text-[10px] text-slate-400">Drafting Exception grounds</p>
                  </div>
                </div>
                {draftData && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {draftData.source}
                  </span>
                )}
              </div>

              {/* Lane 4: Voice */}
              <div className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                callState === 'completed' ? 'bg-indigo-950/20 border-indigo-500/30' : 
                callState === 'calling' || callState === 'connected' ? 'bg-slate-900 border-indigo-500/50 animate-pulse' : 
                'bg-slate-950/40 border-slate-900'
              }`}>
                <div className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    callState === 'completed' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'
                  }`}>
                    4
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Voice Filing Call</h3>
                    <p className="text-[10px] text-slate-400">ElevenLabs speech engine</p>
                  </div>
                </div>
                {callState !== 'idle' && (
                  <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${
                    callState === 'completed' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' : 'bg-indigo-950/30 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {callState}
                  </span>
                )}
              </div>

              {/* Lane 5: Tracking */}
              <div className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                trackingPlan ? 'bg-indigo-950/20 border-indigo-500/30' : 
                isTrackingLoading ? 'bg-slate-900 border-indigo-500/50 animate-pulse' : 
                'bg-slate-950/40 border-slate-900'
              }`}>
                <div className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    trackingPlan ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'
                  }`}>
                    5
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Durable Tracking</h3>
                    <p className="text-[10px] text-slate-400">n8n calendar & monitoring</p>
                  </div>
                </div>
                {trackingPlan && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Input & Upload Zone */}
          <div className="rounded-xl glass-panel p-5 border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Denial Letter Intake</span>
              <button 
                onClick={handleUseSample}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded hover:bg-indigo-500/5 transition-all"
              >
                Use Sample Denial
              </button>
            </h2>

            {/* Upload Box */}
            <div className="border-2 border-dashed border-slate-800 rounded-lg p-4 text-center hover:border-slate-700 transition-all bg-slate-950/40 cursor-pointer relative mb-4">
              <input 
                type="file" 
                accept="image/*,text/plain" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">
                {isUploading ? 'Uploading file...' : 'Upload insurer denial letter'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Accepts images (vision OCR) or plain text</p>
            </div>

            {/* Textarea for validation & edit */}
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Raw Paperwork Text</label>
              <textarea 
                value={denialText}
                onChange={(e) => setDenialText(e.target.value)}
                placeholder="Paste insurer denial letter content here..."
                className="w-full h-40 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 font-mono resize-none"
              />
            </div>

            {uploadError && (
              <div className="mb-4 bg-red-950/20 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Run button */}
            <button
              onClick={runPipeline}
              disabled={isProcessing || !denialText.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all border border-indigo-500/20 shadow-lg shadow-indigo-600/10"
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  {currentLane === 'intake' && 'Analyzing Intake...'}
                  {currentLane === 'policy' && 'Matching Policies...'}
                  {currentLane === 'draft' && 'Drafting Appeal...'}
                  {currentLane === 'voice' && 'Generating Script...'}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Multi-Agent Pipeline
                </>
              )}
            </button>
          </div>

          {/* Wedge / Counterforce Pitch */}
          <div className="rounded-xl bg-slate-950 border border-slate-900 p-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Our Wedge</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed italic">
              "Counterforce proved patients want AI appeals. Our wedge is the managed-agent workflow that files by phone, captures a confirmation number, and arms follow-up escalation."
            </p>
          </div>

        </div>

        {/* Right column: Lane output previews & simulations */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Render Lane 1 & 2 Output: Intake & Policy Summary */}
          {intakeData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Intake Details Card */}
              <div className="rounded-xl glass-panel p-5 border border-slate-800">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Intake Fields Extracted</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                    Lane 1
                  </span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Patient Initials</span>
                    <span className="text-slate-200 font-semibold">{intakeData.data.patient_name_redacted || 'Redacted'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Member ID</span>
                    <span className="text-slate-200 font-mono">{intakeData.data.member_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Insurer</span>
                    <span className="text-slate-200 font-semibold">{intakeData.data.insurer || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Prescribed Care</span>
                    <span className="text-indigo-400 font-semibold">{intakeData.data.service_or_drug || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Denial Code</span>
                    <span className="text-red-400 font-semibold">{intakeData.data.denial_reason_code || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Appeal Deadline</span>
                    <span className="text-slate-300 font-medium">
                      {intakeData.data.appeal_deadline_iso ? new Date(intakeData.data.appeal_deadline_iso).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Matching Card */}
              {policyData && (
                <div className="rounded-xl glass-panel p-5 border border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Clinical Policy Match</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                      Lane 2
                    </span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="border-b border-slate-900 pb-2">
                      <span className="text-slate-500 block">Matched Guideline</span>
                      <a href={policyData.data.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 mt-0.5">
                        {policyData.data.policy_title}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Satisfied Criteria Exceptions</span>
                      <ul className="space-y-1">
                        {policyData.data.clinical_criteria.map((criterion, idx) => (
                          <li key={idx} className="flex gap-2 items-start text-slate-300 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{criterion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Lane 3: Drafted Appeal Letter */}
          {draftData && (
            <div className="rounded-xl glass-panel p-6 border border-slate-800">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Lane 3: Appeal Letter Generated</h3>
                    <p className="text-[10px] text-slate-400">{draftData.data.subject}</p>
                  </div>
                </div>
                
                {/* Win probability badge */}
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Appeal Strength</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {(draftData.data.win_probability * 100).toFixed(0)}% Win Prob.
                  </div>
                </div>
              </div>

              {/* Letter Preview Container */}
              <div className="bg-slate-950/60 rounded-lg p-5 border border-slate-900/60 max-h-80 overflow-y-auto mb-4 font-sans text-xs">
                {renderMarkdown(draftData.data.body_markdown)}
              </div>

              {/* Citations List */}
              <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-800 text-[11px] text-slate-400 space-y-2">
                <span className="font-semibold text-slate-300 block">Policy & File Citations:</span>
                {draftData.data.citations.map((cite, i) => (
                  <div key={i} className="flex gap-2 border-l-2 border-indigo-500 pl-3 py-0.5">
                    <div>
                      <strong className="text-slate-200 block">{cite.source}</strong>
                      <span>{cite.claim}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lane 4: Voice Call Simulator */}
          {voiceScriptData && (
            <div className="rounded-xl glass-panel p-6 border border-slate-800 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <PhoneCall className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Lane 4: Insurer Voice Filing</h3>
                    <p className="text-[10px] text-slate-400">Verbal Filing & Confirmation Capture</p>
                  </div>
                </div>

                {callState === 'idle' && (
                  <button
                    onClick={startCallSimulation}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Place Call
                  </button>
                )}
              </div>

              {/* Voice Script summary */}
              {callState === 'idle' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                      <span className="text-slate-500 block uppercase tracking-wider text-[10px] mb-1 font-semibold">Opening Line</span>
                      <p className="text-slate-300 italic">"{voiceScriptData.data.opening_line}"</p>
                    </div>
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                      <span className="text-slate-500 block uppercase tracking-wider text-[10px] mb-1 font-semibold">Call Goal</span>
                      <p className="text-slate-300">{voiceScriptData.data.call_goal}</p>
                    </div>
                  </div>
                  <div className="bg-slate-900/10 p-3 rounded-lg border border-slate-900/60 text-xs">
                    <span className="text-slate-500 block uppercase tracking-wider text-[10px] mb-1 font-semibold">IVR Navigation Strategy</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {voiceScriptData.data.ivr_strategy.map((strat, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                          {strat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Outbound call logger */}
              {callState !== 'idle' && (
                <div className="space-y-4">
                  {/* Phone Header Status */}
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-900 p-3.5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping absolute inset-0"></div>
                        <div className="w-3 h-3 rounded-full bg-indigo-500 relative"></div>
                      </div>
                      <div className="text-xs">
                        <div className="font-semibold text-slate-200">Outbound Appeal Dial</div>
                        <div className="text-slate-400 font-mono text-[10px]">
                          Dialing {intakeData?.data.contact_phone || '800-333-0633'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Audio Animation */}
                    {(callState === 'calling' || callState === 'connected') && (
                      <div className="flex items-center gap-1">
                        <span className="waveform-bar"></span>
                        <span className="waveform-bar"></span>
                        <span className="waveform-bar"></span>
                        <span className="waveform-bar"></span>
                        <span className="waveform-bar"></span>
                      </div>
                    )}

                    {callState === 'completed' && (
                      <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-500/20 px-3 py-1 rounded text-emerald-400 text-xs font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Confirmation Captured: {confirmationNumber}
                      </div>
                    )}
                  </div>

                  {/* Scrolling transcript terminal */}
                  <div className="bg-slate-950 rounded-lg border border-slate-900 p-4 h-60 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-3">
                    {callSegments.map((seg, i) => (
                      <div key={i} className={`flex gap-3 items-start pb-2 border-b border-slate-900 last:border-0 ${
                        seg.speaker === 'agent' ? 'text-indigo-400' :
                        seg.speaker === 'rep' ? 'text-teal-400' :
                        seg.speaker === 'system' ? 'text-slate-500' :
                        'text-pink-400'
                      }`}>
                        <span className="text-[10px] text-slate-600 font-medium shrink-0 pt-0.5">
                          {seg.t}s
                        </span>
                        <div>
                          <strong className="uppercase tracking-wider mr-2 text-[10px]">{seg.speaker}:</strong>
                          <span>{seg.text}</span>
                        </div>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lane 5: Tracking & Timeline */}
          {trackingPlan && (
            <div className="rounded-xl glass-panel p-6 border border-slate-800">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Lane 5: Durable Follow-up Tracking</h3>
                    <p className="text-[10px] text-slate-400">n8n Managed Timelines & Escalations</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Run ID: {trackingPlan.run_id}</span>
              </div>

              {/* Timeline layout */}
              <div className="relative border-l border-slate-800 pl-6 ml-3 space-y-6">
                
                {/* Filed Date */}
                <div className="relative">
                  <span className="absolute -left-[30px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white border-4 border-slate-950">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Verbal Appeal Filed</div>
                    <div className="text-[10px] text-slate-400">
                      Filed at: {new Date(trackingPlan.filed_at_iso).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Scheduled Followups */}
                {trackingPlan.followups.map((item, i) => (
                  <div key={i} className="relative">
                    <span className={`absolute -left-[30px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full text-white border-4 border-slate-950 ${
                      item.status === 'scheduled' ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}>
                      <Clock className="w-2.5 h-2.5" />
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 capitalize flex items-center gap-2">
                        <span>{item.task.replace('_', ' ')}</span>
                        <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded border ${
                          item.owner === 'n8n' ? 'bg-indigo-950/40 text-indigo-400 border-indigo-500/20' : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}>
                          {item.owner}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Scheduled: {new Date(item.at_iso).toLocaleDateString()} ({item.status})
                      </div>
                    </div>
                  </div>
                ))}

                {/* Appeal Deadline */}
                <div className="relative">
                  <span className="absolute -left-[30px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-red-950 text-red-400 border-2 border-red-500/20">
                    <AlertTriangle className="w-2.5 h-2.5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-red-400">Hard Appeal Expiration</div>
                    <div className="text-[10px] text-slate-400">
                      Insurer deadline: {new Date(trackingPlan.appeal_deadline_iso).toLocaleDateString()}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-slate-900 text-center text-[11px] text-slate-500 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
        <div>
          &copy; {new Date().getFullYear()} PriorAuth Advocate. Google I/O Hackathon Demo.
        </div>
        <div className="flex gap-4">
          <span className="hover:text-slate-400 transition-colors">Documentation</span>
          <span className="hover:text-slate-400 transition-colors">Privacy Policy</span>
          <span className="hover:text-slate-400 transition-colors font-semibold text-slate-400">Administrative advocacy only. Not medical advice.</span>
        </div>
      </footer>
    </div>
  );
}
