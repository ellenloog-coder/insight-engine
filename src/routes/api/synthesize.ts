import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  source: z.string().min(20).max(60000),
  mode: z.enum(["guidance", "tool", "content", "brief"]),
  domain: z.string().max(200).optional(),
});

const MODE_PROMPTS: Record<z.infer<typeof Body>["mode"], string> = {
  guidance: `Produce ACTIONABLE QUALITY GUIDANCE from the source material only. Label every item as one of: Source-supported fact / Inference / Recommendation / Not established in source.
Sections:
1. Scope & applicable requirements (cite clause/section numbers ONLY if they appear in the source)
2. Failure modes & root causes
3. Inspection / verification checklist (checkbox list; each item must show acceptance criteria, method, and evidence label)
4. Hold points and documentation records
5. Open questions where the source is silent`,
  tool: `Produce an ENGINEERING TOOL SPECIFICATION grounded in the source material. Label every item as one of: Source-supported fact / Inference / Recommendation / Not established in source.
Sections:
1. Tool purpose and user
2. Inputs (name, unit, valid range, source of truth; label each as source-supported or recommended)
3. Calculations / decision logic (explicit formulas or rule table, step by step; if the source does not state a formula, write "Not established in source" and offer a labeled Recommendation only when useful)
4. Outputs, pass/fail thresholds and margins (do not invent thresholds)
5. Validation cases (worked example with numbers; only use values present or derivable from the source)
6. Assumptions and limits of applicability`,
  content: `Produce TECHNICAL CONTENT ready for engineering review. Label every substantive claim as one of: Source-supported fact / Inference / Recommendation / Not established in source.
Sections:
1. Headline options (3)
2. Executive summary (120 words max)
3. Body with subheads, written for practicing engineers, concrete and non-promotional
4. Key takeaways (5 bullets, each labeled with its evidence status)
5. Suggested figures/tables and what each shows`,
  brief: `Produce a RESEARCH BRIEF that is strictly evidence-grounded. Label every claim as one of: Source-supported fact / Inference / Recommendation / Not established in source.
Sections:
1. What the source establishes (with evidence quality noted per claim)
2. Standards / references invoked (only list standards actually mentioned in the source)
3. Real-world case evidence and what it proves or contradicts
4. Gaps, conflicts and uncertainty (surface conflicts instead of choosing one without justification)
5. Recommended next investigations`,
};

const SYSTEM = `You are an evidence-grounded engineering synthesis assistant.

Core rules:
- Use the provided source material as the primary evidence base.
- Never present information as a source fact unless it is explicitly supported by the source.
- Clearly distinguish:
  - Source-supported fact
  - Inference
  - Recommendation
  - Not established in source
- Do not invent standards or clause numbers, formulas, thresholds, acceptance criteria, test values, roles, responsibilities, or regulatory requirements.
- If a requested output field is not supported by the source, state "Not established in source", or provide a clearly labeled "Recommendation" only when useful.
- Do not silently fill gaps to make the deliverable look complete.
- Preserve the strength of the original source language. "may" must not become "shall"; examples must not become requirements; case-study practices must not become universal best practices.
- If sources conflict, surface the conflict instead of choosing one without justification.
- Generated outputs are drafts for engineering review, not final compliance, release, or approval decisions.
- Keep outputs specific, concise, and traceable to the supplied material.
- Output clean Markdown with the requested section headings.`;

export const Route = createFileRoute("/api/synthesize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI is not configured." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return new Response(
            JSON.stringify({ error: "Paste at least a paragraph of source material." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "google/gemini-3.7-flash",
            stream: true,
            messages: [
              { role: "system", content: SYSTEM },
              {
                role: "user",
                content: `${MODE_PROMPTS[body.mode]}

Domain / context: ${body.domain?.trim() || "infer from the source material"}

--- SOURCE MATERIAL (standards, research, case studies) ---
${body.source}`,
              },
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          let message = "The AI service failed. Please try again.";
          if (upstream.status === 429) message = "Rate limited. Wait a moment and retry.";
          if (upstream.status === 402)
            message = "AI credits are exhausted. Add credits in Lovable to continue.";
          if (upstream.status === 403) message = "AI access is blocked by workspace policy.";
          console.error("gateway error", upstream.status, detail.slice(0, 500));
          return new Response(JSON.stringify({ error: message }), {
            status: upstream.status === 402 || upstream.status === 403 ? upstream.status : 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (!data || data === "[DONE]") continue;
                  try {
                    const json = JSON.parse(data);
                    const delta = json?.choices?.[0]?.delta?.content;
                    if (typeof delta === "string" && delta)
                      controller.enqueue(encoder.encode(delta));
                  } catch {
                    /* partial frame */
                  }
                }
              }
            } catch (error) {
              console.error("stream error", error);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
