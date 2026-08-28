import { Fragment } from "react";

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="rounded bg-secondary px-1 py-0.5 text-primary">
          {part.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Minimal renderer for the Markdown subset the model returns. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-2" />;

        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
          const level = heading[1].length;
          const cls =
            level <= 2
              ? "mt-6 text-lg font-bold text-foreground"
              : "mt-4 text-base font-semibold text-foreground";
          return (
            <h3 key={i} className={cls}>
              {inline(heading[2])}
            </h3>
          );
        }

        const checkbox = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line.trim());
        if (checkbox)
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="mt-0.5 h-3.5 w-3.5 shrink-0 border border-primary/70" />
              <span>{inline(checkbox[2])}</span>
            </div>
          );

        const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
        if (bullet)
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="text-primary">—</span>
              <span>{inline(bullet[1])}</span>
            </div>
          );

        const numbered = /^(\d+[.)])\s+(.*)$/.exec(line.trim());
        if (numbered)
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="text-primary">{numbered[1]}</span>
              <span>{inline(numbered[2])}</span>
            </div>
          );

        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}
