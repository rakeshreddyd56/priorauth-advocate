# PriorAuth Advocate

**An AI co-pilot that fights US health-insurance prior-authorization denials end-to-end.**

Built for the **Google I/O Hackathon · May 23, 2026 · San Francisco** on the Gemini 3.5 Flash managed-agents stack.

> Counterforce + Maxwell coach the patient through the call.
> **We make the call.**
> And n8n keeps fighting for 60 days after.

---

## The problem

- **60 million** Americans get a prior-authorization denial every month (KFF Jan 2026)
- **70%** give up. The average appeal is 6 hours of paperwork + 3 phone calls.
- **< 1%** of denials are appealed. Of those that are, **82%** win.
- The gap is paperwork — not medicine, not policy, not eligibility. **Just paperwork.**

That's the wedge.

## The architecture

> **Gemini thinks. ElevenLabs speaks. n8n remembers.**

Six sub-agents on **Google Vertex AI managed-agent infrastructure**, fanning out in parallel under a planner agent that enforces strict Zod contracts. One ElevenLabs voice runtime. One n8n durable workflow. Three escalation outputs (Gmail status email, IRO packet, State DOI complaint).

```
Patient → Dashboard → Managed Agents (planner)
                            ↓ fan-out
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ① Intake          ② Policy        ③ Clinical Evidence
   Gemini Vision     Gemini RAG       Cloud Healthcare API
                                       (FHIR R4 · LIVE)
        └──────────────────┼──────────────────┘
                            ▼  fan-in
                      ④ Drafting (Gemini structured JSON)
                            ▼
                      ⑤ Voice Prep (VoiceScript)
                            ▼
                      ⑥ ElevenLabs · Twilio (live call)
                            ▼
                     ⑦ n8n durable workflow
                  ┌─────────┼─────────┐
                  ▼         ▼         ▼
              Gmail     IRO packet   State DOI
              status    (Day 14)     (Day 30)
```

## Tech stack — 6 Google products + 2 best-of-breed

| Layer | Product | Role |
|---|---|---|
| 🟢 Reasoning · 5 sub-agents | **Gemini 3.5 Flash** | Intake / Policy / Drafting / Voice-Prep / Confirmation-extractor |
| 🟢 Runtime | **Vertex AI** (`vertexai: true` mode on `@google/genai`) | All Gemini calls hit `aiplatform.googleapis.com` directly. ADC auth. Verifiable in Cloud Audit Logs. |
| 🔵 Clinical data | **Cloud Healthcare API** | FHIR R4 store with synthetic Patient + DocumentReference, live HTTP pull at runtime |
| 🟢 Compute | **Cloud Run** | Backend planner + API routes (stateless) |
| 🟢 Auth | **Application Default Credentials** | No static service-account keys — complies with `iam.disableServiceAccountKeyCreation` org policy |
| 🟢 Studio | **Google AI Studio** | Prompt iteration + API key for local dev |
| 🟢 Email | **Gmail** | Patient status email — styled HTML template, fired by n8n on call completion |
| 🟠 Voice | **ElevenLabs Conversational AI** | Browser SDK + Twilio outbound. Captures full transcript + confirmation number. |
| 🌸 Durable workflow | **n8n** | Day 5 / 14 / 30 follow-up schedule. Auto-files IRO escalation + State DOI complaint. |

## Demo flow (90 seconds)

1. **Snap photo** of an Aetna denial letter → Intake Agent extracts `DenialLetter` JSON
2. **Parallel fan-out:** Policy Agent RAG-queries the Aetna CPB corpus; Clinical Evidence Agent pulls the patient's azathioprine trial note live from Cloud Healthcare FHIR R4
3. **Drafting Agent** composes the appeal letter quoting policy clauses verbatim + citing the FHIR-corroborated evidence; emits `AppealLetter` JSON with a win-probability score
4. **Voice Prep Agent** turns the appeal into a tight `VoiceScript`
5. **Voice Execution:** ElevenLabs agent has a live conversation with the appeals rep, captures the confirmation number
6. **n8n** receives the `CallResult`, schedules Day 5/14/30 follow-ups, sends the patient a Gmail status email

## Code architecture

```
src/
├── app/
│   ├── page.tsx                          # 3-tab dashboard (Demo · Pitch · Architecture)
│   ├── api/
│   │   ├── run/intake/route.ts           # Gemini Vision OCR
│   │   ├── run/policy/route.ts           # Gemini + corpus RAG → PolicyMatch
│   │   ├── run/clinical-evidence/route.ts # Live FHIR R4 pull
│   │   ├── run/draft/route.ts            # Gemini → AppealLetter
│   │   ├── run/voice-script/route.ts     # Gemini → VoiceScript
│   │   ├── call/start/route.ts           # ElevenLabs outbound-call initiation
│   │   ├── call/status/route.ts          # Polled by frontend for webhook result
│   │   ├── call/signed-url/route.ts      # Browser SDK signed URL endpoint
│   │   ├── webhooks/elevenlabs/route.ts  # Post-call webhook + confirmation extraction
│   │   └── tracking/demo/route.ts        # TrackingPlan builder
│   └── globals.css                       # ProPublica-longform design system
├── components/
│   ├── ArchitectureFlow.tsx              # Animated multi-color system walkthrough
│   └── InteractivePitch.tsx              # 11-slide presenter-mode pitch
├── lib/
│   ├── gemini.ts                         # Shared Vertex AI client
│   ├── schemas.ts                        # Zod contracts for every lane
│   ├── policy-corpus.ts                  # Local cheerio RAG over Aetna CPBs
│   ├── call-store.ts                     # In-memory CallResult store
│   ├── env.ts                            # Env var validator
│   └── prompts/                          # System instructions for each sub-agent
└── corpus/policies/                       # 3 real Aetna Clinical Policy Bulletins (HTML)

infra/
├── n8n-workflow.json                     # Importable n8n workflow (12 nodes)
└── n8n-setup.md                          # 3-minute setup guide

scripts/
├── check-env.ts                          # Env coverage check
├── seed-fhir.ts                          # Seed synthetic Patient + DocRef into FHIR store
└── test-pipeline.ts                      # E2E smoke test (6 lanes)
```

## Run it locally

```bash
# 1. Install
npm install

# 2. Auth (Application Default Credentials — no static service account keys)
gcloud auth application-default login
gcloud config set project YOUR_GCP_PROJECT_ID

# 3. Configure
cp .env.example .env
# Fill in:
#   GOOGLE_PROJECT_ID, VERTEX_LOCATION, HEALTHCARE_DATASET, HEALTHCARE_FHIR_STORE
#   ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_PHONE_NUMBER_ID
#   N8N_WEBHOOK_URL (optional — tracking works without it)

# 4. Set up infra (one time)
#   - Create Cloud Healthcare API dataset + FHIR R4 store via console.cloud.google.com/healthcare
#   - Create ElevenLabs Conversational AI agent + import Twilio number
#   - (Optional) Import infra/n8n-workflow.json into your n8n instance

# 5. Seed FHIR store with synthetic patient
npm run seed-fhir

# 6. Run
npm run dev
# → localhost:3000
```

End-to-end smoke test:

```bash
npm run test-pipeline
# Expected:
#   Intake            ✅
#   Policy            ✅
#   Clinical Evidence ✅   mode=live
#   Drafting          ✅   win=85%+
#   Voice Prep        ✅
#   Tracking          ✅
```

## Built during the hackathon (commit history is honest)

- `Initial commit from Create Next App` — Antigravity's scaffold
- `[antigravity] scaffold v1` — Antigravity built schemas, UI shell, mock API routes
- `[antigravity/wire-live-v2] task 1+5 (in-flight)` — Antigravity got Intake + ElevenLabs webhook ~90% done before hitting quota
- All subsequent `[claude/wire-live-v2]` commits — wired live integrations, fixed bugs, swapped to Vertex AI runtime, polished UI

Antigravity built the foundation; Claude wired everything live. The branch convention `antigravity/wire-live-v2` preserves attribution.

## What's real vs scaffolded

| Lane | What's real today | Notes |
|---|---|---|
| Intake | ✅ Live Gemini 3.5 Flash multimodal via Vertex AI | — |
| Policy | ✅ Live Gemini + local cheerio RAG over 3 real Aetna CPBs (1 MB total) | Vertex Vector Search swap-in available; deferred to v2 |
| Clinical Evidence | ✅ Live FHIR R4 pull from Cloud Healthcare API | Synthetic patient data (HIPAA-clean for demo) |
| Drafting | ✅ Live Gemini structured output via Vertex AI | — |
| Voice Prep | ✅ Live Gemini via Vertex AI | — |
| Voice Execution | ✅ Live ElevenLabs Conversational AI (browser SDK on stage; Twilio outbound for production) | — |
| Tracking | ✅ n8n workflow JSON + setup guide ready to import | n8n instance deployment is per-user |

## License

MIT.

## Disclaimer

**Administrative advocacy. Not medical advice.**

PriorAuth Advocate automates the paperwork fight against insurance prior-authorization denials. It does not diagnose, prescribe, or recommend treatment. The physician already prescribed; we automate the appeal.
