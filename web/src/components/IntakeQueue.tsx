import fixture from "@/data/intake/extractions.json";

interface FixtureRow {
  initials: string;
  visit_date: string;
  overall: number;
  comm: number;
  clean: number;
  theme: string;
}

interface IntakeFixture {
  generated_at: string;
  batch_started_at: string;
  batch_finished_at: string;
  job_count: number;
  error_count: number;
  featured: {
    filename: string;
    extraction: Record<string, unknown>;
  };
  rows: FixtureRow[];
}

const data = fixture as IntakeFixture;

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export default function IntakeQueue() {
  return (
    <section
      aria-labelledby="intake-heading"
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="intake-heading" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Patient surveys — overnight batch
        </h2>
        <div className="text-[11px] text-zinc-500">
          Batch ran {fmtTime(data.batch_started_at)} → {fmtTime(data.batch_finished_at)} ·{" "}
          {data.job_count} processed · {data.error_count} errors
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr,1.2fr]">
        <figure className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/intake/${data.featured.filename}`}
            alt="Scanned patient experience survey, processed overnight by Gemma 4 vision"
            className="block w-full"
          />
          <figcaption className="bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Survey #1 of {data.job_count} — Gemma 4 extraction on right
          </figcaption>
        </figure>

        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Featured extraction (real Gemma 4 vision output)
            </div>
            <pre className="overflow-auto rounded bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {JSON.stringify(data.featured.extraction, null, 2)}
            </pre>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Also processed last night
            </div>
            <div className="overflow-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-[11px]">
                <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Initials</th>
                    <th className="px-2 py-1.5 font-medium">Visit</th>
                    <th className="px-2 py-1.5 font-medium">Overall</th>
                    <th className="px-2 py-1.5 font-medium">Comm</th>
                    <th className="px-2 py-1.5 font-medium">Clean</th>
                    <th className="px-2 py-1.5 font-medium">Theme</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.rows.map((r, i) => (
                    <tr key={i} className="text-zinc-700 dark:text-zinc-300">
                      <td className="px-2 py-1.5 font-mono">{r.initials}</td>
                      <td className="px-2 py-1.5">{r.visit_date}</td>
                      <td className="px-2 py-1.5">{r.overall}/5</td>
                      <td className="px-2 py-1.5">{r.comm}/5</td>
                      <td className="px-2 py-1.5">{r.clean}/5</td>
                      <td className="px-2 py-1.5 italic text-zinc-600 dark:text-zinc-400">
                        {r.theme}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Reception drops paper surveys into the intake folder during the day. Overnight, Gemma 4
        vision reads each one on-device; transcriptions are saved to the local extractions store. Images
        never leave this machine.
      </p>
    </section>
  );
}
