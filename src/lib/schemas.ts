import { z } from 'zod';

export const DenialLetterSchema = z.object({
  patient_name_redacted: z.string().nullable(),
  member_id: z.string().nullable(),
  insurer: z.string().nullable(),
  plan_name: z.string().nullable(),
  service_or_drug: z.string().nullable(),
  denial_reason_code: z.string().nullable(),
  denial_reason_text: z.string().nullable(),
  cited_policy_section: z.string().nullable(),
  appeal_deadline_iso: z.string().nullable(),
  contact_phone: z.string().nullable(),
  raw_text: z.string(),
  // Extended metadata for Live v2
  confidences: z.object({
    patient_name_redacted: z.number().nullable(),
    member_id: z.number().nullable(),
    insurer: z.number().nullable(),
    plan_name: z.number().nullable(),
    service_or_drug: z.number().nullable(),
    denial_reason_code: z.number().nullable(),
    denial_reason_text: z.number().nullable(),
    cited_policy_section: z.number().nullable(),
    appeal_deadline_iso: z.number().nullable(),
    contact_phone: z.number().nullable()
  }).optional()
});

export type DenialLetter = z.infer<typeof DenialLetterSchema>;

export const PolicyMatchSchema = z.object({
  policy_id: z.string(),
  policy_title: z.string(),
  source_url: z.string(),
  clinical_criteria: z.array(z.string()),
  pulled_clauses: z.array(z.object({
    text: z.string(),
    page: z.number()
  })),
  guideline_refs: z.array(z.object({
    source: z.string(),
    citation: z.string()
  }))
});

export type PolicyMatch = z.infer<typeof PolicyMatchSchema>;

export const AppealLetterSchema = z.object({
  to_address: z.string(),
  subject: z.string(),
  body_markdown: z.string(),
  citations: z.array(z.object({
    source: z.string(),
    claim: z.string()
  })),
  short_summary_for_voice: z.string(),
  win_probability: z.number()
});

export type AppealLetter = z.infer<typeof AppealLetterSchema>;

export const VoiceScriptSchema = z.object({
  call_goal: z.string(),
  opening_line: z.string(),
  verification_fields: z.object({
    patient_name_redacted: z.string().nullable(),
    member_id_last4: z.string().nullable(),
    service_or_drug: z.string().nullable(),
    insurer: z.string().nullable()
  }),
  ivr_strategy: z.array(z.string()),
  appeal_summary_30_sec: z.string(),
  forbidden_phrases: z.array(z.string()),
  max_call_duration_sec: z.number()
});

export type VoiceScript = z.infer<typeof VoiceScriptSchema>;

export const CallResultSchema = z.object({
  call_sid: z.string(),
  conversation_id: z.string(),
  duration_sec: z.number(),
  transcript_segments: z.array(z.object({
    speaker: z.enum(["agent", "ivr", "rep", "system"]),
    text: z.string(),
    t: z.number()
  })),
  confirmation_number: z.string().nullable(),
  status: z.enum(["filed", "callback_required", "failed"])
});

export type CallResult = z.infer<typeof CallResultSchema>;

export const TrackingPlanSchema = z.object({
  run_id: z.string(),
  filed_at_iso: z.string(),
  appeal_deadline_iso: z.string(),
  next_action_iso: z.string(),
  followups: z.array(z.object({
    at_iso: z.string(),
    task: z.enum(["status_call", "fax_refile", "state_complaint", "external_review_packet"]),
    owner: z.enum(["n8n", "user"]),
    status: z.enum(["scheduled", "waiting", "done", "blocked"])
  })),
  escalation_ready: z.object({
    state_complaint: z.boolean(),
    external_review_packet: z.boolean()
  })
});

export type TrackingPlan = z.infer<typeof TrackingPlanSchema>;
