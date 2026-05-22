import "dotenv/config";
import { randomBytes } from "node:crypto";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is required. Export it or add it to a local .env file.");
}

const client = new GoogleGenAI({ apiKey });
const baseAgent = process.env.ANTIGRAVITY_BASE_AGENT ?? "antigravity-preview-05-2026";
const suffix = `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex")}`;

async function createSmokeAgent(kind, systemInstruction) {
  const id = `priorauth-${kind}-smoke-${suffix}`;

  const agent = await client.agents.create({
    id,
    base_agent: baseAgent,
    system_instruction: systemInstruction,
    base_environment: {
      type: "remote",
      sources: [
        {
          type: "inline",
          target: ".agents/AGENTS.md",
          content: systemInstruction,
        },
      ],
    },
  });

  return agent;
}

const intakeAgent = await createSmokeAgent(
  "intake",
  [
    "You are the PriorAuth Advocate intake smoke-test agent.",
    "You only extract administrative facts from synthetic prior-authorization denial text.",
    "You never provide medical advice, diagnosis, treatment recommendations, or dosing guidance.",
    "Return compact JSON with insurer, service_or_drug, denial_reason_code, and handoff_message.",
  ].join(" ")
);

const policyAgent = await createSmokeAgent(
  "policy",
  [
    "You are the PriorAuth Advocate policy smoke-test agent.",
    "You receive an intake JSON payload and return one administrative next step.",
    "You never provide medical advice, diagnosis, treatment recommendations, or dosing guidance.",
    "Return compact JSON with received_service_or_drug, administrative_next_step, and handoff_message.",
  ].join(" ")
);

const intakeInteraction = await client.interactions.create(
  {
    agent: intakeAgent.id,
    environment: "remote",
    input:
      "Synthetic denial letter: Aetna denied prior authorization for Humira refill because documentation of plan policy criteria was incomplete. Emit the administrative handoff JSON.",
  },
  { timeout: 300_000 }
);

const policyInteraction = await client.interactions.create(
  {
    agent: policyAgent.id,
    environment: "remote",
    input: `Use this intake handoff and respond with the next administrative step only: ${intakeInteraction.output_text}`,
  },
  { timeout: 300_000 }
);

console.log(
  JSON.stringify(
    {
      baseAgent,
      agents: {
        intake: intakeAgent.id,
        policy: policyAgent.id,
      },
      interactions: {
        intake: {
          id: intakeInteraction.id,
          environmentId: intakeInteraction.environment_id,
          output: intakeInteraction.output_text,
        },
        policy: {
          id: policyInteraction.id,
          environmentId: policyInteraction.environment_id,
          output: policyInteraction.output_text,
        },
      },
    },
    null,
    2
  )
);
