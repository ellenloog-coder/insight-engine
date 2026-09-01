import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ClipboardCheck,
  Copy,
  Info,
  Loader2,
  Wrench,
  FileText,
  FlaskConical,
  Square,
} from "lucide-react";

import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Standards Synthesist — AI Research to Quality Guidance" },
      {
        name: "description",
        content:
          "Turn industry standards, technical research and case studies into inspection checklists, engineering tool specs, technical content and research briefs.",
      },
      { property: "og:title", content: "Standards Synthesist" },
      {
        property: "og:description",
        content:
          "AI-assisted workflow that converts standards, research and case studies into actionable engineering deliverables.",
      },
    ],
  }),
  component: Index,
});

const MODES = [
  {
    id: "guidance" as const,
    label: "Quality Guidance",
    shortDescription: "Turn source material into practical quality guidance and checklists.",
    whatItCreates:
      "Structured quality guidance, verification checklists, evidence requirements, decision points, and open questions.",
    bestUsedFor:
      "Quality planning, inspection planning, validation guidance, supplier quality reviews, and internal process drafting.",
    boundary:
      "Does not invent unsupported acceptance criteria, approval authority, regulatory requirements, quantitative thresholds, or mandatory controls.",
    icon: ClipboardCheck,
  },
  {
    id: "tool" as const,
    label: "Engineering Tool Specification",
    shortDescription:
      "Turn a methodology into a specification for a spreadsheet, workflow, or software tool.",
    whatItCreates:
      "Inputs, source-supported rules, derived logic, outputs, assumptions, applicability limits, and validation cases.",
    bestUsedFor:
      "Creating spreadsheets, checklists, internal workflows, decision-support tools, or software prototypes from technical methodologies.",
    boundary:
      "Only creates executable logic where the source clearly establishes the condition and outcome. Missing formulas, thresholds, approval rules, or decision logic remain undefined.",
    icon: Wrench,
  },
  {
    id: "content" as const,
    label: "Technical Content",
    shortDescription: "Turn technical material into clear, publishable content.",
    whatItCreates:
      "Headline options, executive summary, structured technical body, key takeaways, and suggested figures or tables.",
    bestUsedFor:
      "Technical articles, blogs, newsletters, knowledge-sharing content, internal training materials, and methodology explanations.",
    boundary:
      "May improve structure and explanation, but does not add unsupported technical claims, standards, thresholds, or generalize case-study practices beyond the source.",
    icon: FileText,
  },
  {
    id: "brief" as const,
    label: "Research Brief",
    shortDescription:
      "Understand what the source establishes, where gaps exist, and what needs further investigation.",
    whatItCreates:
      "Source-supported findings, evidence limitations, standards or references mentioned, case evidence, gaps, conflicts, uncertainty, and recommended next investigations.",
    bestUsedFor:
      "Early-stage research, standards review, evidence comparison, technical due diligence, and identifying knowledge gaps.",
    boundary:
      "Preserves uncertainty and evidence gaps rather than filling them with unsupported assumptions or general model knowledge.",
    icon: FlaskConical,
  },
];

type Mode = (typeof MODES)[number]["id"];

function Index() {
  const [source, setSource] = useState("");
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState<Mode>("guidance");
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const words = source.trim() ? source.trim().split(/\s+/).length : 0;

  async function run() {
    if (source.trim().length < 20) {
      setError("Paste at least a paragraph of source material.");
      return;
    }
    setError(null);
    setOutput("");
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, mode, domain: domain || undefined }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "The analysis failed. Please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError")
        setError("Connection interrupted. Please try again.");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-16">
      <header className="border-b border-border pb-8">
        <p className="label-caps">AI-assisted research workflow</p>
        <h1 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
          Standards <span className="text-primary">Synthesist</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Paste industry standards, technical research or real-world case studies. Get back
          actionable quality guidance, engineering tool specs, or publishable technical content —
          grounded in the source, with gaps and inferences flagged.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="panel p-5">
          <label className="label-caps" htmlFor="source">
            Source material
          </label>
          <Textarea
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Paste clauses from a standard, a research abstract, a field failure report, inspection notes…"
            className="mt-2 min-h-[280px] resize-y bg-background/60 font-mono text-sm"
          />
          <p className="mt-2 text-right text-xs text-muted-foreground">{words} words</p>

          <label className="label-caps mt-5 block" htmlFor="domain">
            Domain / context (optional)
          </label>
          <Input
            id="domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. structural welding, sterile packaging, EV battery assembly"
            className="mt-2 bg-background/60 text-sm"
          />

          <p className="label-caps mt-6 block">Deliverable</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              const infoOpen = openInfoId === m.id;
              return (
                <div
                  key={m.id}
                  className={`rounded-md border transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setMode(m.id)}
                      aria-pressed={active}
                      className="flex-1 p-3 text-left"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Icon
                          className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`}
                        />
                        {m.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {m.shortDescription}
                      </span>
                    </button>

                    <div className="hidden items-center pr-2 sm:flex">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={`More about ${m.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end" sideOffset={4}>
                          <ModeInfoContent mode={m} />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex items-center pr-2 sm:hidden">
                      <button
                        type="button"
                        aria-label={`More about ${m.label}`}
                        aria-expanded={infoOpen}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenInfoId(infoOpen ? null : m.id);
                        }}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {infoOpen ? (
                    <div className="border-t border-border px-3 pb-3 sm:hidden">
                      <ModeInfoContent mode={m} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={run} disabled={running} className="font-semibold">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {running ? "Synthesizing…" : "Run synthesis"}
            </Button>
            {running ? (
              <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>

        <section className="panel flex min-h-[420px] flex-col p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="label-caps">Output</p>
            {output ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(output)}
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            ) : null}
          </div>

          <div className="mt-4 flex-1 overflow-auto">
            {output ? (
              <Markdown text={output} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {running
                  ? "Reading the source and drafting…"
                  : "Your deliverable will stream here, section by section."}
              </p>
            )}
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">
        Output is source-grounded drafting support — always verify clause numbers and acceptance
        criteria against the controlling standard before release.
      </footer>
    </main>
  );
}
