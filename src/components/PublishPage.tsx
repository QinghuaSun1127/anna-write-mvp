import { Download, FileText } from "lucide-react";
import type { ReactNode } from "react";
import type { Author, PublishSettings, WritingProject } from "../types";

interface PublishPageProps {
  project: WritingProject;
  currentAuthor: Author | null;
  onPublishSettingsChange: (patch: Partial<PublishSettings>) => void;
  onDownload: () => void;
  onBackToDraft: () => void;
}

const formats: PublishSettings["format"][] = ["DOCX", "PDF", "TXT", "Markdown", "HTML"];
const presets = [
  "Clean essay",
  "WeChat article",
  "Manuscript",
  "Academic/simple",
  "Newsletter",
  "Story chapter",
  "Minimal TXT",
  "Markdown export",
];

const presetPatch: Record<string, Partial<PublishSettings>> = {
  "Clean essay": { bodyFont: "Georgia", titleSize: 30, bodySize: 15, lineHeight: 1.72, paragraphSpacing: 14, margins: 36 },
  "WeChat article": { bodyFont: "PingFang SC", titleSize: 28, bodySize: 16, lineHeight: 1.85, paragraphSpacing: 18, margins: 28 },
  Manuscript: { bodyFont: "Courier New", titleSize: 24, bodySize: 14, lineHeight: 2, paragraphSpacing: 12, margins: 44 },
  "Academic/simple": { bodyFont: "Times New Roman", titleSize: 26, bodySize: 14, lineHeight: 1.65, paragraphSpacing: 12, margins: 42 },
  Newsletter: { bodyFont: "Georgia", titleSize: 28, bodySize: 15, lineHeight: 1.75, paragraphSpacing: 16, margins: 34 },
  "Story chapter": { bodyFont: "Georgia", titleSize: 28, bodySize: 16, lineHeight: 1.82, paragraphSpacing: 18, margins: 40 },
  "Minimal TXT": { format: "TXT", bodyFont: "System", titleSize: 24, bodySize: 14, lineHeight: 1.55, paragraphSpacing: 10, margins: 24 },
  "Markdown export": { format: "Markdown", bodyFont: "System", titleSize: 24, bodySize: 14, lineHeight: 1.6, paragraphSpacing: 12, margins: 24 },
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function PublishPage({ project, currentAuthor, onPublishSettingsChange, onDownload, onBackToDraft }: PublishPageProps) {
  const settings = project.publishSettings;
  const draft = project.draft;
  const paragraphs = draft?.blocks.map((block) => block.sentences.map((sentence) => sentence.text).join(" ")) ?? [];

  const updateNumber = (key: keyof PublishSettings, value: string) => {
    onPublishSettingsChange({ [key]: Number(value) } as Partial<PublishSettings>);
  };

  return (
    <div className="page-scroll">
      <section className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          <div className="glass rounded-[22px] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-ink">Publish</h1>
                <p className="mt-1 text-xs leading-5 text-muted">Format, preview, and export the finished draft.</p>
              </div>
              <button className="btn btn-secondary" onClick={onBackToDraft}>Back</button>
            </div>

            <div className="grid gap-3">
              <Field label="Output format">
                <select className="field-input" value={settings.format} onChange={(event) => onPublishSettingsChange({ format: event.target.value as PublishSettings["format"] })}>
                  {formats.map((format) => (
                    <option key={format}>{format}</option>
                  ))}
                </select>
              </Field>
              <Field label="Document title">
                <input className="field-input" value={settings.documentTitle} onChange={(event) => onPublishSettingsChange({ documentTitle: event.target.value })} />
              </Field>
              <Field label="Subtitle">
                <input className="field-input" value={settings.subtitle} onChange={(event) => onPublishSettingsChange({ subtitle: event.target.value })} />
              </Field>
              <Field label="Author name display">
                <input
                  className="field-input"
                  value={settings.authorNameDisplay}
                  placeholder={currentAuthor?.name ?? "Optional"}
                  onChange={(event) => onPublishSettingsChange({ authorNameDisplay: event.target.value })}
                />
              </Field>
              <Field label="Date display">
                <input className="field-input" value={settings.dateDisplay} onChange={(event) => onPublishSettingsChange({ dateDisplay: event.target.value })} />
              </Field>
            </div>
          </div>

          <div className="glass rounded-[22px] p-4">
            <h2 className="text-sm font-extrabold text-ink">Format presets</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  className={`chip ${settings.preset === preset ? "active" : ""}`}
                  key={preset}
                  onClick={() => onPublishSettingsChange({ preset, ...presetPatch[preset] })}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-[22px] p-4">
            <h2 className="text-sm font-extrabold text-ink">Typography & layout</h2>
            <div className="mt-3 grid gap-3">
              <Field label="Title font">
                <input className="field-input" value={settings.titleFont} onChange={(event) => onPublishSettingsChange({ titleFont: event.target.value })} />
              </Field>
              <Field label="Body font">
                <input className="field-input" value={settings.bodyFont} onChange={(event) => onPublishSettingsChange({ bodyFont: event.target.value })} />
              </Field>
              <Field label="Title size">
                <input className="field-input" type="number" value={settings.titleSize} onChange={(event) => updateNumber("titleSize", event.target.value)} />
              </Field>
              <Field label="Body size">
                <input className="field-input" type="number" value={settings.bodySize} onChange={(event) => updateNumber("bodySize", event.target.value)} />
              </Field>
              <Field label="Line height">
                <input className="field-input" type="number" step="0.05" value={settings.lineHeight} onChange={(event) => updateNumber("lineHeight", event.target.value)} />
              </Field>
              <Field label="Paragraph spacing">
                <input className="field-input" type="number" value={settings.paragraphSpacing} onChange={(event) => updateNumber("paragraphSpacing", event.target.value)} />
              </Field>
              <Field label="Page margins">
                <input className="field-input" type="number" value={settings.margins} onChange={(event) => updateNumber("margins", event.target.value)} />
              </Field>
              <Field label="Heading style">
                <input className="field-input" value={settings.headingStyle} onChange={(event) => onPublishSettingsChange({ headingStyle: event.target.value })} />
              </Field>
            </div>
          </div>

          <div className="glass rounded-[22px] p-4">
            <h2 className="text-sm font-extrabold text-ink">Include</h2>
            <div className="mt-3 grid gap-2 text-xs font-bold text-graphite">
              {[
                ["includeMetadata", "Metadata"],
                ["includeRequirementSummary", "Requirement summary"],
                ["includeAuthorStyleNote", "Author/style note"],
                ["includeVersionNumber", "Version number"],
              ].map(([key, label]) => (
                <label className="flex items-center gap-2" key={key}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-lavender"
                    checked={Boolean(settings[key as keyof PublishSettings])}
                    onChange={(event) => onPublishSettingsChange({ [key]: event.target.checked } as Partial<PublishSettings>)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button className="btn btn-primary mt-4 w-full" onClick={onDownload}>
              <Download size={14} />
              Download {settings.format}
            </button>
            {["DOCX", "PDF"].includes(settings.format) ? (
              <p className="mt-2 text-xs leading-5 text-muted">DOCX/PDF export is cleanly separated as a future integration; TXT, Markdown, and HTML download now.</p>
            ) : null}
          </div>
        </aside>

        <main className="document-preview rounded-[22px] border border-white/80 p-8" style={{ margin: 0 }}>
          <div className="mb-4 flex items-center gap-2 text-xs font-bold text-muted">
            <FileText size={14} />
            Preview · {settings.preset} · {settings.format}
          </div>
          <article
            style={{
              fontFamily: settings.bodyFont,
              fontSize: settings.bodySize,
              lineHeight: settings.lineHeight,
              padding: settings.margins,
            }}
            className="mx-auto min-h-[640px] max-w-3xl rounded-xl bg-white/80 shadow-inner"
          >
            <h1 style={{ fontFamily: settings.titleFont, fontSize: settings.titleSize, lineHeight: 1.15 }} className="mb-3 font-extrabold tracking-normal text-ink">
              {settings.documentTitle || draft?.title || "Untitled Draft"}
            </h1>
            {settings.subtitle ? <p className="italic text-muted">{settings.subtitle}</p> : null}
            {settings.includeMetadata ? (
              <p className="mb-5 text-xs text-muted">
                {settings.authorNameDisplay || currentAuthor?.name || "Author hidden"} · {settings.dateDisplay}
                {settings.includeVersionNumber && draft ? ` · v${draft.version}` : ""}
              </p>
            ) : null}
            {settings.includeRequirementSummary ? (
              <div className="mb-5 rounded-xl bg-lavender/10 p-3 text-xs leading-5 text-graphite">
                {project.requirementCards.slice(0, 5).map((card) => (
                  <div key={card.id}>
                    <strong>{card.title}:</strong> {card.content}
                  </div>
                ))}
              </div>
            ) : null}
            {paragraphs.map((paragraph, index) => (
              <p key={index} style={{ marginBottom: settings.paragraphSpacing }}>
                {paragraph}
              </p>
            ))}
          </article>
        </main>
      </section>
    </div>
  );
}
