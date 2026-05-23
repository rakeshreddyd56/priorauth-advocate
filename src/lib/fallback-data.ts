import { DenialLetter, PolicyMatch, AppealLetter, VoiceScript, CallResult, TrackingPlan } from './schemas';

export const SAMPLE_DENIAL_LETTER_TEXT = `Aetna PPO
Attn: Prior Authorization Appeals
P.O. Box 14079
Lexington, KY 40512

Date: May 18, 2026
Patient Name: R. R.
Member ID: AET994125821
Plan Name: Aetna Choice PPO (Group #88412)
Date of Birth: January 25, 1980

RE: PRIOR AUTHORIZATION DENIAL FOR HUMIRA (adalimumab) 40 mg SC q2w
Prescriber: Dr. M. Patel, Gastroenterology
Diagnosis: Crohn's disease

Dear Patient,

We have reviewed the prior authorization request submitted by your physician, Dr. M. Patel, for Humira (adalimumab) 40 mg SC q2w for the treatment of Crohn's disease.

At this time, we are unable to approve this request because the clinical criteria under Aetna Medical Policy 0341 — Adalimumab for Crohn's Disease have not been fully met.

DENIAL REASON CODE: PA-MED-NECESSITY
DENIAL REASON: Aetna clinical guidelines require that the patient must have tried and failed an adequate trial of at least 12 weeks of an immunomodulator (such as azathioprine or 6-mercaptopurine) before Humira can be approved, unless contraindicated. The submitted records show the patient's azathioprine trial was documented as only 8 weeks, which is less than the required 12-week minimum.

CITED POLICY SECTION: Aetna Medical Policy 0341 — Adalimumab for Crohn's Disease.

If you disagree with this decision, you or your provider have the right to file an administrative appeal. Your appeal must be submitted within 180 days of this notice (Appeal Deadline: November 14, 2026).

Please contact Aetna Appeals Department at +18005550142 to file a verbal administrative appeal or for further assistance.

Sincerely,
Medical Review Division
Aetna PPO`;

export const MOCK_DENIAL_LETTER: DenialLetter = {
  patient_name_redacted: "R. R.",
  member_id: "AET994125821",
  insurer: "Aetna PPO",
  plan_name: "Aetna Choice PPO (Group #88412)",
  service_or_drug: "Humira (adalimumab) 40 mg SC q2w",
  denial_reason_code: "PA-MED-NECESSITY",
  denial_reason_text: "Aetna clinical guidelines require that the patient must have tried and failed an adequate trial of at least 12 weeks of an immunomodulator (such as azathioprine or 6-mercaptopurine) before Humira can be approved, unless contraindicated. The submitted records show the patient's azathioprine trial was documented as only 8 weeks, which is less than the required 12-week minimum.",
  cited_policy_section: "Aetna Medical Policy 0341 — Adalimumab for Crohn's Disease",
  appeal_deadline_iso: "2026-11-14T17:00:00Z",
  contact_phone: "+18005550142",
  raw_text: SAMPLE_DENIAL_LETTER_TEXT
};

export const MOCK_POLICY_MATCH: PolicyMatch = {
  policy_id: "AET-CPB-0341",
  policy_title: "Aetna Clinical Policy Bulletin 0341: Adalimumab for Crohn's Disease",
  source_url: "https://www.aetna.com/cpb/medical/data/300_399/0341.html",
  clinical_criteria: [
    "Diagnosis of moderate to severe Crohn's disease",
    "Trial and failure of at least a 12-week course of an immunomodulator (e.g. azathioprine, 6-mercaptopurine) OR documented intolerance/contraindication",
    "Prescribed by or in consultation with a gastroenterologist"
  ],
  pulled_clauses: [
    {
      text: "Adalimumab is considered medically necessary for the treatment of moderate to severe Crohn's disease when the patient has had an inadequate response to, or is intolerant to, an immunomodulator (e.g. azathioprine) for a minimum of 12 weeks.",
      page: 1
    }
  ],
  guideline_refs: [
    {
      source: "ACG Crohn's Guidelines",
      citation: "American College of Gastroenterology clinical guidelines for management of Crohn's disease"
    }
  ]
};

export const MOCK_APPEAL_LETTER: AppealLetter = {
  to_address: "Aetna PPO\nAttn: Prior Authorization Appeals\nP.O. Box 14079\nLexington, KY 40512",
  subject: "Administrative Appeal: Prior Auth Denial for Humira - Patient: R. R. (Member ID: AET994125821)",
  body_markdown: `Dear Aetna Appeals Committee,

I am writing to submit a formal administrative appeal regarding the prior authorization denial for **Humira (adalimumab) 40 mg SC q2w**, under Denial Reason Code **PA-MED-NECESSITY** (Aetna Medical Policy 0341).

The denial letter states that the patient did not meet the criteria because there was no documentation of a full 12-week trial of an immunomodulator. We are appealing this administrative decision on the grounds of **documented medical exception due to immunomodulator intolerance**.

### Summary of Appeal Grounds:
1. **Immunomodulator Intolerance Exception:**
   Under Aetna Medical Policy **0341**, a 12-week immunomodulator trial (e.g., azathioprine) is waived if the patient has a documented intolerance or contraindication. The patient, R. R., was prescribed azathioprine by Dr. M. Patel, but experienced severe gastrointestinal intolerance, preventing the completion of the 12-week course. The trial was halted after **8 weeks** for patient safety.
   
2. **Established Diagnosis:**
   The patient has a confirmed diagnosis of **Crohn's disease** under care of Dr. M. Patel, satisfying the diagnosis criteria of Aetna Medical Policy 0341.

We request that you immediately reverse this administrative denial and approve the prescribed prior authorization for Humira, as the medical record supports the exception criteria defined in your own clinical policies.

Sincerely,
PriorAuth Advocate
*(On behalf of R. R.)*`,
  citations: [
    {
      source: "Aetna Medical Policy 0341, Page 1",
      claim: "Immunomodulator trial is waived if the patient has a documented intolerance or contraindication."
    },
    {
      source: "Clinical Evidence EHR (Dr. M. Patel, DocumentReference)",
      claim: "Patient R. R. completed 8 weeks of azathioprine 100mg daily, stopped due to intolerance."
    }
  ],
  short_summary_for_voice: "This is an administrative prior auth appeal for R. R., Member ID ending 5821. Humira was denied under code PA-MED-NECESSITY for an incomplete 12-week azathioprine trial. The patient has a documented medical exception for azathioprine intolerance after 8 weeks, which satisfies the exception criteria under Aetna Medical Policy 0341. We request immediate reversal of this administrative denial.",
  win_probability: 0.92
};

export const MOCK_VOICE_SCRIPT: VoiceScript = {
  call_goal: "File administrative appeal for R. R. (Humira prior auth denial PA-MED-NECESSITY) based on azathioprine intolerance exception.",
  opening_line: "Hello, I am calling on behalf of member ID ending 5821 to file an administrative appeal of a prior authorization denial dated May 18, 2026.",
  verification_fields: {
    patient_name_redacted: "R. R.",
    member_id_last4: "5821",
    service_or_drug: "Humira (adalimumab)",
    insurer: "Aetna PPO"
  },
  ivr_strategy: [
    "Press 2 for Provider Services",
    "Press 4 for Appeals",
    "Provide Member ID AET994125821 when prompted"
  ],
  appeal_summary_30_sec: "This is an administrative appeal for member R. R., ID AET994125821, regarding Humira. The denial code is PA-MED-NECESSITY. The denial cited lack of a 12-week azathioprine trial. However, the patient's medical records document complete azathioprine intolerance after 8 weeks, which satisfies Aetna Medical Policy 0341 exception criteria. Please register this verbal appeal and provide a confirmation number.",
  forbidden_phrases: [
    "I recommend treatment",
    "medical advice",
    "diagnosis",
    "dosage advice",
    "you should",
    "as your doctor"
  ],
  max_call_duration_sec: 180
};

export const MOCK_CALL_RESULT: CallResult = {
  call_sid: "CA-9941-5821-ab99-bc7821",
  conversation_id: "conv-11a-22b-33c",
  duration_sec: 82,
  transcript_segments: [
    { speaker: "system", text: "Initiating outbound call to Aetna Appeals Department (+18005550142)...", t: 0 },
    { speaker: "ivr", text: "Thank you for calling Aetna. For members, press 1. For provider offices, press 2.", t: 4 },
    { speaker: "agent", text: "[System sends DTMF: 2]", t: 7 },
    { speaker: "ivr", text: "Please speak or enter the member identification number.", t: 11 },
    { speaker: "agent", text: "[System sends DTMF: 994125821#]", t: 16 },
    { speaker: "ivr", text: "Got it. To check status or file a prior auth appeal, press 4.", t: 20 },
    { speaker: "agent", text: "[System sends DTMF: 4]", t: 23 },
    { speaker: "ivr", text: "Connecting you to an appeals coordinator.", t: 26 },
    { speaker: "rep", text: "Thank you for calling Aetna Prior Auth Appeals, this is Sarah. May I have your name and call details?", t: 35 },
    { speaker: "agent", text: "Hello, I am calling on behalf of member ID ending 5821 to file an administrative appeal of a prior authorization denial dated May 18, 2026. The patient initials are R. R. and member ID is AET994125821.", t: 37 },
    { speaker: "rep", text: "Thank you. Let me pull up the record... Yes, I see Humira was denied due to an incomplete 12-week azathioprine trial. What is the basis of your appeal?", t: 50 },
    { speaker: "agent", text: "The patient experienced severe azathioprine intolerance, preventing them from completing the 12-week course. Under Aetna Medical Policy 0341, the 12-week trial requirement is waived if there is documented intolerance. The intolerance was noted after 8 weeks by Dr. Patel.", t: 60 },
    { speaker: "rep", text: "I see Dr. Patel's documentation here of azathioprine intolerance at 8 weeks. I will submit this verbal appeal for clinical override. Your appeal reference number is A4-7821.", t: 72 },
    { speaker: "agent", text: "Thank you, Sarah. I have noted confirmation number A4-7821. We appreciate your help.", t: 78 },
    { speaker: "rep", text: "You're welcome. Have a good day.", t: 82 }
  ],
  confirmation_number: "A4-7821",
  status: "filed"
};

export const MOCK_TRACKING_PLAN: TrackingPlan = {
  run_id: "run-aetna-humira-5821",
  filed_at_iso: "2026-05-23T18:48:00Z",
  appeal_deadline_iso: "2026-11-14T17:00:00Z",
  next_action_iso: "2026-05-28T09:00:00Z",
  followups: [
    {
      at_iso: "2026-05-28T09:00:00Z",
      task: "status_call",
      owner: "n8n",
      status: "scheduled"
    },
    {
      at_iso: "2026-06-06T09:00:00Z",
      task: "fax_refile",
      owner: "user",
      status: "waiting"
    },
    {
      at_iso: "2026-11-15T09:00:00Z",
      task: "state_complaint",
      owner: "user",
      status: "waiting"
    }
  ],
  escalation_ready: {
    state_complaint: false,
    external_review_packet: false
  }
};
