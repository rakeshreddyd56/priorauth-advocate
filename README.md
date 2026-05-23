# PriorAuth Advocate

PriorAuth Advocate is an administrative advocacy copilot for insurance prior-authorization denials: a patient or advocate uploads a denial letter, Gemini agents extract the administrative facts, match the insurer policy, draft an appeal packet, ElevenLabs/Twilio places the filing call, and n8n tracks follow-ups after the confirmation number. It does not provide medical advice, diagnosis, treatment recommendations, or dosing guidance.

## Agent Graph

```mermaid
flowchart LR
  Planner["Planner"]
  Intake["Intake agent<br/>vision extraction"]
  Policy["Policy agent<br/>RAG over insurer policy"]
  Drafting["Drafting agent<br/>appeal letter"]
  Voice["Voice prep<br/>Gemini call script"]
  Call["ElevenLabs + Twilio<br/>filing call"]
  Tracking["n8n tracking<br/>follow-ups + retries"]
  Result["Confirmation number"]
  Plan["Tracking plan"]

  Planner --> Intake
  Planner --> Policy
  Intake --> Drafting
  Policy --> Drafting
  Drafting --> Voice
  Voice --> Call
  Call --> Result
  Result --> Tracking
  Tracking --> Plan
```

## Event Boundary

Code intended for the Google I/O Hackathon project starts during the May 23, 2026 build window. Anything under `pre-event/` is scaffolding, evaluation, or a disposable smoke test used to de-risk the stack before kickoff.
