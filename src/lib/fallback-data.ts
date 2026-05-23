import { DenialLetter, PolicyMatch, AppealLetter, VoiceScript, CallResult, TrackingPlan } from './schemas';

export const SAMPLE_DENIAL_LETTER_TEXT = `Anthem Blue Cross
Attn: Prior Authorization Appeals
P.O. Box 60007
Los Angeles, CA 90060

Date: May 15, 2026
Patient Name: Sarah Jenkins
Member ID: ANT984210332
Plan Name: Anthem Bronze PPO
Date of Birth: October 12, 1974

RE: PRIOR AUTHORIZATION DENIAL FOR REPATHA (evolocumab) 140mg/mL injection

Dear Sarah Jenkins,

We have reviewed the prior authorization request submitted by your physician, Dr. Robert Chen, MD, for Repatha (evolocumab) 140mg/mL injection.

At this time, we are unable to approve this request.

DENIAL REASON CODE: PA-402
DENIAL REASON: The request is denied because the clinical criteria for Proprotein Convertase Subtilisin/Kexin Type 9 (PCSK9) Inhibitors under Section 2.12 of the Anthem Clinical Guidelines have not been fully satisfied. Specifically, documentation was not provided to establish that the patient has tried and failed maximum tolerated statin therapy (such as atorvastatin 80mg or rosuvastatin 40mg daily) for at least 3 consecutive months, or has a documented contraindication to statins. Additionally, the submitted records did not confirm a diagnosis of Heterozygous Familial Hypercholesterolemia (HeFH) or Clinical Atherosclerotic Cardiovascular Disease (ASCVD).

CITED POLICY SECTION: Section 2.12 - Proprotein Convertase Subtilisin/Kexin Type 9 (PCSK9) Inhibitors Criteria.

If you or your provider disagree with this decision, you have the right to file an administrative appeal. Your appeal must be submitted in writing or by phone within 180 days of the date of this letter (Appeal Deadline: November 11, 2026).

Please contact Member Services at 800-333-0633 for any questions regarding this denial or to file an appeal over the phone.

Sincerely,
Medical Review Department
Anthem Blue Cross`;

export const MOCK_DENIAL_LETTER: DenialLetter = {
  patient_name_redacted: "S. Jenkins",
  member_id: "ANT984210332",
  insurer: "Anthem Blue Cross",
  plan_name: "Anthem Bronze PPO",
  service_or_drug: "Repatha (evolocumab) 140mg/mL injection",
  denial_reason_code: "PA-402",
  denial_reason_text: "The request is denied because the clinical criteria for Proprotein Convertase Subtilisin/Kexin Type 9 (PCSK9) Inhibitors under Section 2.12 of the Anthem Clinical Guidelines have not been fully satisfied. Specifically, documentation was not provided to establish that the patient has tried and failed maximum tolerated statin therapy (such as atorvastatin 80mg or rosuvastatin 40mg daily) for at least 3 consecutive months, or has a documented contraindication to statins. Additionally, the submitted records did not confirm a diagnosis of Heterozygous Familial Hypercholesterolemia (HeFH) or Clinical Atherosclerotic Cardiovascular Disease (ASCVD).",
  cited_policy_section: "Section 2.12 - Proprotein Convertase Subtilisin/Kexin Type 9 (PCSK9) Inhibitors Criteria",
  appeal_deadline_iso: "2026-11-11T17:00:00Z",
  contact_phone: "800-333-0633",
  raw_text: SAMPLE_DENIAL_LETTER_TEXT
};

export const MOCK_POLICY_MATCH: PolicyMatch = {
  policy_id: "ANT-PCSK9-2026",
  policy_title: "Anthem Clinical Guideline CG-DRUG-98: PCSK9 Inhibitors",
  source_url: "https://www.anthem.com/medicalpolicies/guidelines/gl_pw_d009821.htm",
  clinical_criteria: [
    "Must have a diagnosis of Heterozygous Familial Hypercholesterolemia (HeFH) OR Clinical Atherosclerotic Cardiovascular Disease (ASCVD)",
    "Must have tried and failed maximum tolerated statin therapy for at least 3 consecutive months, OR have a documented statin intolerance",
    "Must be used in combination with maximum tolerated statin therapy (unless contraindicated)"
  ],
  pulled_clauses: [
    {
      text: "Patient has a documented history of clinical atherosclerotic cardiovascular disease (ASCVD) OR diagnosis of heterozygous familial hypercholesterolemia (HeFH) confirmed by genetic testing or clinical criteria.",
      page: 2
    },
    {
      text: "Patient has tried and failed at least 90 days of high-intensity statin therapy (atorvastatin 40-80 mg daily or rosuvastatin 20-40 mg daily) with inadequate LDL-C reduction, or has documented complete statin intolerance (e.g., severe myalgia with elevated CK).",
      page: 3
    }
  ],
  guideline_refs: [
    {
      source: "ACC/AHA Cholesterol Guidelines",
      citation: "2018 AHA/ACC/multisociety guideline on the management of blood cholesterol"
    },
    {
      source: "NLA Scientific Statement",
      citation: "National Lipid Association recommendations for PCSK9 inhibitor use in patient care"
    }
  ]
};

export const MOCK_APPEAL_LETTER: AppealLetter = {
  to_address: "Anthem Blue Cross\nAttn: Prior Authorization Appeals\nP.O. Box 60007\nLos Angeles, CA 90060",
  subject: "Administrative Appeal: Prior Authorization Denial for Repatha (evolocumab) - Patient: S. Jenkins (Member ID: ANT984210332)",
  body_markdown: `Dear Anthem Appeals Committee,

I am writing to submit a formal administrative appeal regarding the prior authorization denial for **Repatha (evolocumab) 140mg/mL injection**, under Denial Reason Code **PA-402** (Section 2.12 of the Anthem Clinical Guidelines).

The denial letter states that the patient did not meet the criteria because there was no documentation of a 90-day trial and failure of maximum tolerated statin therapy. We are appealing this administrative decision on the grounds of **documented medical exception / complete statin intolerance**.

### Summary of Appeal Grounds:
1. **Complete Statin Intolerance Exception:**
   Under Anthem Clinical Guideline **CG-DRUG-98 (Page 3)**, a high-intensity statin trial is not required if the patient has a documented complete statin intolerance. The patient, S. Jenkins, has a documented history of **severe rhabdomyolysis and myalgias** on atorvastatin 40mg, which resulted in a creatine kinase (CK) elevation greater than 10 times the upper limit of normal. This clinical event prevents safe use of any high-intensity statin therapy.
   
2. **Established Diagnosis:**
   The patient has a confirmed clinical history of **Atherosclerotic Cardiovascular Disease (ASCVD)** following a post-myocardial infarction event, satisfying the diagnostic criteria of Section 2.12.

### Insurer Policy Matching Details:
* **Cited Policy Section:** *Section 2.12 - Proprotein Convertase Subtilisin/Kexin Type 9 (PCSK9) Inhibitors Criteria*
* **Policy Exception Clause Met:** *"Patient has tried and failed at least 90 days of high-intensity statin therapy... OR has documented complete statin intolerance (e.g. severe myalgia with elevated CK)."*

We request that you immediately reverse this administrative denial and approve the prescribed prior authorization for Repatha, as the medical record supports the exception criteria defined in your own clinical policies.

Sincerely,
PriorAuth Advocate
*(On behalf of S. Jenkins)*`,
  citations: [
    {
      source: "Anthem Policy CG-DRUG-98, Page 3",
      claim: "High-intensity statin trial is not required if there is a documented complete statin intolerance (e.g., severe myalgia with elevated CK)."
    },
    {
      source: "Patient Medical Records (Robert Chen, MD, dated 02/14/2026)",
      claim: "Patient suffered severe rhabdomyolysis and myalgias on atorvastatin 40mg, preventing any statin use."
    }
  ],
  short_summary_for_voice: "This is an administrative prior authorization appeal for S. Jenkins, Member ID ANT984210332. The prior authorization for Repatha was denied under code PA-402 for lack of a 90-day statin trial. The patient's medical records document complete statin intolerance due to rhabdomyolysis, which satisfies the exception criteria under Section 2.12 of the Anthem policy. We request immediate reversal of this administrative denial.",
  win_probability: 0.88
};

export const MOCK_VOICE_SCRIPT: VoiceScript = {
  call_goal: "File administrative appeal for S. Jenkins (Repatha prior authorization denial PA-402) by submitting verbal appeal under statin intolerance exception.",
  opening_line: "Hello, I am calling to file an administrative prior authorization appeal for a member. I have the member details ready.",
  verification_fields: {
    patient_name_redacted: "S. Jenkins",
    member_id_last4: "0332",
    service_or_drug: "Repatha (evolocumab)",
    insurer: "Anthem Blue Cross"
  },
  ivr_strategy: [
    "Press 2 for Provider Services",
    "Press 4 for Prior Authorization",
    "Say 'Representative' to bypass automated lookup if needed",
    "Provide Member ID ANT984210332 and Date of Birth October 12, 1974 when prompted"
  ],
  appeal_summary_30_sec: "This is an administrative appeal for member S. Jenkins, ID ANT984210332, regarding Repatha. The denial code is PA-402. The denial cited lack of high-intensity statin trial. The patient has a documented medical exception for complete statin intolerance due to rhabdomyolysis. This meets Section 2.12 policy guidelines for exception. Please register this verbal appeal and provide a confirmation number.",
  forbidden_phrases: [
    "I recommend the patient take",
    "In my clinical opinion",
    "The patient should be diagnosed with",
    "AI doctor",
    "medical diagnosis",
    "treatment recommendation"
  ],
  max_call_duration_sec: 180
};

export const MOCK_CALL_RESULT: CallResult = {
  call_sid: "CA-11eb-7821-bcde-332910",
  conversation_id: "conv-99a-88b-77c",
  duration_sec: 74,
  transcript_segments: [
    { speaker: "system", text: "Initiating outbound call to Anthem Prior Auth Department (800-333-0633)...", t: 0 },
    { speaker: "ivr", text: "Thank you for calling Anthem Blue Cross. For members, press 1. For providers, press 2.", t: 3 },
    { speaker: "agent", text: "[System sends DTMF: 2]", t: 6 },
    { speaker: "ivr", text: "Please enter the 9-digit Member Identification Number, excluding the three-letter prefix, followed by the pound sign.", t: 9 },
    { speaker: "agent", text: "[System sends DTMF: 984210332#]", t: 15 },
    { speaker: "ivr", text: "Thank you. For prior authorizations, press 4. For claims, press 5. For all other inquiries, please hold.", t: 19 },
    { speaker: "agent", text: "[System sends DTMF: 4]", t: 22 },
    { speaker: "ivr", text: "Connecting you to a Prior Authorization Specialist. Your call may be monitored or recorded.", t: 25 },
    { speaker: "rep", text: "Thank you for calling Anthem Prior Auth department, my name is Marcus. How can I help you today?", t: 34 },
    { speaker: "agent", text: "Hello, my name is PriorAuth Advocate, calling on behalf of member S. Jenkins, ID ANT984210332. I am calling to file a verbal administrative appeal for a Repatha denial under code PA-402.", "t": 36 },
    { speaker: "rep", text: "Can you verify the patient's date of birth and the prescribing doctor's name?", t: 46 },
    { speaker: "agent", text: "Yes, patient date of birth is October 12th, 1974. The prescribing doctor is Robert Chen, MD.", t: 50 },
    { speaker: "rep", text: "Thank you. I see the denial here was for not trying high-intensity statins. What is the basis of this appeal?", t: 55 },
    { speaker: "agent", text: "Under Section 2.12 of the Anthem clinical policy guidelines, a statin trial is not required if the patient has a documented complete statin intolerance. Sarah Jenkins experienced severe rhabdomyolysis on atorvastatin, which is documented in the medical records from Dr. Robert Chen on February 14th, 2026.", t: 60 },
    { speaker: "rep", text: "Okay, I see the exception notes now. I will submit this verbal appeal to the clinical review board. Your appeal reference number is A4-7821. It will take 15 to 30 calendar days to process. You will receive a written response.", t: 68 },
    { speaker: "agent", text: "Thank you, Marcus. I have noted confirmation number A4-7821. Have a wonderful day.", t: 72 },
    { speaker: "rep", text: "You too, goodbye.", t: 74 }
  ],
  confirmation_number: "A4-7821",
  status: "filed"
};

export const MOCK_TRACKING_PLAN: TrackingPlan = {
  run_id: "run-98ab-32ef-44cd",
  filed_at_iso: "2026-05-23T18:31:00Z",
  appeal_deadline_iso: "2026-11-11T17:00:00Z",
  next_action_iso: "2026-06-07T09:00:00Z",
  followups: [
    {
      at_iso: "2026-06-07T09:00:00Z",
      task: "status_call",
      owner: "n8n",
      status: "scheduled"
    },
    {
      at_iso: "2026-06-22T09:00:00Z",
      task: "fax_refile",
      owner: "user",
      status: "waiting"
    },
    {
      at_iso: "2026-11-12T09:00:00Z",
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
