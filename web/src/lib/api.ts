import type {
  AgentEvent,
  EvaluationMetrics,
  PipelineOutput,
  SampleComplaint,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ──────────────────────────────────────────────
// SSE streaming analysis
// ──────────────────────────────────────────────

export async function* analyzeComplaint(
  narrative: string,
  metadata: { company?: string; state?: string; product?: string }
): AsyncGenerator<AgentEvent> {
  const response = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ narrative, metadata }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (raw && raw !== "[DONE]") {
          try {
            yield JSON.parse(raw) as AgentEvent;
          } catch {
            // skip malformed line
          }
        }
      }
    }
  }
}

// ──────────────────────────────────────────────
// Simple (non-streaming) analysis
// ──────────────────────────────────────────────

export async function analyzeComplaintSimple(
  narrative: string,
  metadata: { company?: string; state?: string; product?: string }
): Promise<PipelineOutput> {
  const response = await fetch(`${BASE_URL}/api/analyze-simple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ narrative, metadata }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<PipelineOutput>;
}

// ──────────────────────────────────────────────
// Sample complaints
// ──────────────────────────────────────────────

export async function getSampleComplaints(): Promise<SampleComplaint[]> {
  const response = await fetch(`${BASE_URL}/api/sample-complaints`);
  if (!response.ok) throw new Error(`Failed to load samples: ${response.status}`);
  return response.json() as Promise<SampleComplaint[]>;
}

// ──────────────────────────────────────────────
// Evaluation metrics
// ──────────────────────────────────────────────

export async function getEvaluation(): Promise<EvaluationMetrics> {
  const response = await fetch(`${BASE_URL}/api/evaluation`);
  if (!response.ok) throw new Error(`Failed to load evaluation: ${response.status}`);
  return response.json() as Promise<EvaluationMetrics>;
}

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}
