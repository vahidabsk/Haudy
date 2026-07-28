import { allAuditorReportFindings } from "./auditor-report-findings";

export interface HaudyAiContext {
  reviewType: string;
  source?: string;
  category: string;
  fieldNote: string;
  nfpa72Edition: string;
  certificateStandard?: string;
  propertyContext?: string;
}

export interface HaudyAiReference {
  role: "governing" | "referenced" | "manufacturer";
  verificationStatus: "verified" | "candidate" | "supporting" | "unable_to_verify";
  standard: string;
  edition: string;
  section: string;
  requirementSummary: string;
}

export interface HaudyAiSuggestion {
  suggestionId: string;
  finding: string;
  requiredAction: string;
  references: HaudyAiReference[];
  evidenceUsed: string[];
  reasoningSummary: string;
  limitations: string[];
  confidence: number;
  disposition: "ready_for_auditor_review" | "reference_verification_required" | "insufficient_evidence";
}

const ENDPOINT_KEY = "haudy.ai.endpoint";
const DEVICE_TOKEN_KEY = "haudy.ai.deviceToken";
const DEFAULT_ENDPOINT = "https://haudy-ai-gateway.vahidabsk.chatgpt.site";

export function haudyAiEndpoint() {
  return (localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT).replace(/\/+$/, "");
}

export function haudyAiDeviceToken() {
  return localStorage.getItem(DEVICE_TOKEN_KEY) || "";
}

export function saveHaudyAiDeviceToken(value: string) {
  const token = value.trim();
  if (token) localStorage.setItem(DEVICE_TOKEN_KEY, token);
  else localStorage.removeItem(DEVICE_TOKEN_KEY);
  return token;
}

export async function requestHaudyAiSuggestion(context: HaudyAiContext, existingFinding: string, existingRequiredAction: string) {
  try {
    const token = haudyAiDeviceToken();
    if (!token) throw new Error("Haudy AI Gateway is not configured.");
    const response = await fetch(`${haudyAiEndpoint()}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Haudy-Device-Token": token },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        ...context,
        existingFinding,
        existingRequiredAction,
        approvedExamples: localApprovedExamples(context),
      }),
    });
    if (!response.ok) throw new Error(`Haudy AI service returned ${response.status}.`);
    return await response.json() as HaudyAiSuggestion;
  } catch {
    return localVerifiedSuggestion(context);
  }
}

function localApprovedExamples(context: HaudyAiContext) {
  const category = context.category.trim().toLowerCase();
  const reviewType = context.reviewType.trim().toLowerCase();
  const edition = context.nfpa72Edition.trim();
  return allAuditorReportFindings()
    .filter((row) =>
      (!edition || row.year === edition) &&
      (!category || row.category.trim().toLowerCase() === category || row.reviewType.trim().toLowerCase() === reviewType),
    )
    .slice(0, 5)
    .map((row) => ({ finding: row.finding, requiredAction: row.requiredAction }));
}

function localVerifiedSuggestion(context: HaudyAiContext): HaudyAiSuggestion {
  const haystack = `${context.reviewType} ${context.category} ${context.fieldNote}`.toLowerCase();
  const recordDrawing = context.nfpa72Edition === "2013" && ["record drawing", "record drawings", "as built", "as-built", "riser diagram"].some((phrase) => haystack.includes(phrase));
  const runnerSections: Record<string, string> = {
    "2019": "26.3.2(6); 26.3.3",
    "2016": "26.3.2(6); 26.3.3",
    "2013": "26.3.2(6); 26.3.3",
    "2010": "26.3.2(6); 26.3.3",
    "2007": "8.3.2(6); 8.3.3",
  };
  const runner = ["runner service", "runner provision", "runner"].some((phrase) => haystack.includes(phrase)) ? runnerSections[context.nfpa72Edition] : "";
  const note = professionalFinding(context.fieldNote, context, recordDrawing ? "record-drawings-not-provided" : runner ? "central-station-contract-runner-service" : "");
  const verified = recordDrawing || Boolean(runner);
  const section = recordDrawing ? "7.5.3(2); 7.5.5.4" : runner;
  const requiredAction = recordDrawing
    ? "Provide current record drawings that accurately represent the installed fire alarm system and include the information required by the applicable edition of NFPA 72."
    : runner
      ? "Revise or supplement the central station service contract to include the required runner service provisions."
      : "Provide documentation demonstrating compliance with the applicable requirements, or correct the identified condition and submit evidence of the completed corrective action.";
  return {
    suggestionId: crypto.randomUUID(),
    finding: note,
    requiredAction,
    references: [{
      role: "governing",
      verificationStatus: verified ? "verified" : "unable_to_verify",
      standard: "NFPA 72",
      edition: context.nfpa72Edition,
      section,
      requirementSummary: recordDrawing
        ? "Required record drawings are to be delivered and retained as applicable."
        : runner
          ? "The central station service arrangement includes the required runner service provisions."
          : "No exact section in the local controlled library matched this observation.",
    }],
    evidenceUsed: [context.fieldNote],
    reasoningSummary: verified
      ? "The observation matched Haudy AI’s local controlled, edition-specific library. The private portal was not required for this verified match."
      : "Haudy AI improved the audit wording but withheld the code section because the private service was unavailable and the local controlled library had no verified match.",
    limitations: verified ? [] : ["Exact code-section verification is required before this suggestion can be accepted as complete."],
    confidence: verified ? 94 : 45,
    disposition: verified ? "ready_for_auditor_review" : "reference_verification_required",
  };
}

function professionalFinding(note: string, context: HaudyAiContext, ruleId: string) {
  if (ruleId === "central-station-contract-runner-service") {
    return "During the documentation review, it was noted that the provided central station service contract did not include provisions for the required runner service.";
  }
  if (ruleId === "record-drawings-not-provided") {
    return "During the documentation review, it was noted that record drawings for the installed fire alarm system were not provided for review.";
  }
  const normalized = note
    .replace(/^(?:during\s+(?:the\s+)?(?:documentation review|field audit|device testing|signal processing review)[,;:]?\s*)/i, "")
    .replace(/^(?:it\s+was\s+noted\s+that\s+)/i, "")
    .replace(/^(?:the\s+)?alam\b/i, "the alarm")
    .replace(/[.!?]+$/, "")
    .trim();
  const observation = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  const opening = context.source === "deviceTests"
    ? "During device testing"
    : /signal/i.test(context.reviewType) || context.source === "signalLog"
      ? "During the signal processing review"
      : /documentation/i.test(context.reviewType) || context.source === "documentation"
        ? "During the documentation review"
        : "During the field audit";
  return `${opening}, it was noted that ${observation}.`;
}
