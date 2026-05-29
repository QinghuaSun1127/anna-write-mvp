import { ChevronRight, FileText, PenLine, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Author, WritingProject } from "../types";

interface BriefPageProps {
  project: WritingProject;
  currentAuthor: Author | null;
  authors: Author[];
  onProjectChange: (patch: Partial<WritingProject>) => void;
  onNestedChange: <K extends "commercialSettings" | "currentEventSettings" | "storySettings">(
    key: K,
    patch: Partial<WritingProject[K]>,
  ) => void;
  onSetAuthor: (authorId: string | null) => void;
  onGenerateRequirements: () => void;
  onRunDemoFlow: () => void;
  busy: boolean;
}

const writingTypes = ["Article", "Story", "Short story", "Novel chapter", "WeChat article", "Essay", "Newsletter", "Blog", "LinkedIn post", "Speech", "Script"];
const channels = ["Blog", "WeChat", "Newsletter", "LinkedIn", "Website", "Email", "Manuscript", "Internal doc"];
const languages = ["English", "Chinese", "Bilingual"];
const lengthTargets = ["Short", "Medium", "Long", "Custom"];
const tones = ["Restrained", "Emotional", "Literary", "Commercial", "Analytical", "Humorous", "Suspenseful", "Premium", "Plain"];
const outputGoals = ["Inform", "Persuade", "Entertain", "Convert", "Reflect", "Narrate", "Build authority", "Publish to WeChat"];
const emotions = ["Curiosity", "Resonance", "Urgency", "Calm", "Sadness", "Excitement", "Trust", "Tension"];
const intentions = [
  "Pure commentary / analysis",
  "Pure commercial / self-promotional",
  "Hybrid: hot topic + promotion",
  "Fictional / story-driven",
  "Personal essay / reflection",
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input className="field-input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function BriefPage({
  project,
  currentAuthor,
  authors,
  onProjectChange,
  onNestedChange,
  onSetAuthor,
  onGenerateRequirements,
  onRunDemoFlow,
  busy,
}: BriefPageProps) {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const needsCommercial = /commercial|promotion|hybrid/i.test(project.intentionType);
  const needsCurrent = /hot topic|current|commentary/i.test(project.intentionType) || project.currentEventSettings.requireSourceLinks;
  const needsStory = /story|fiction/i.test(project.intentionType) || /story|novel|chapter/i.test(project.writingType);

  const chip = (id: string, label: string, value: string, important = false) => (
    <button
      className={`chip ${openPanel === id ? "active" : ""} ${important ? "shadow-sm shadow-lavender/10" : ""}`}
      onClick={() => setOpenPanel(openPanel === id ? null : id)}
      type="button"
    >
      <span className="text-muted">{label}</span>
      {value}
    </button>
  );

  return (
    <div className="page-scroll">
      <section className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-extrabold leading-tight tracking-normal text-ink">What should AnnaWrite write?</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Start with the piece you need. The selected author can guide style, but the author library stays independent from this writing task.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={onRunDemoFlow} disabled={busy}>
              <Sparkles size={15} />
              Demo flow
            </button>
            <button className="btn btn-primary" onClick={onGenerateRequirements} disabled={busy}>
              <Sparkles size={15} />
              Requirements
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_320px]">
          <div className="glass rounded-[22px] p-3">
            <textarea
              className="field-input min-h-[190px] text-[15px]"
              value={project.brief}
              onChange={(event) => onProjectChange({ brief: event.target.value })}
              placeholder="Write a WeChat article about why requirement-first writing helps founders ship sharper essays..."
            />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <SelectField label="Writing type" value={project.writingType} options={writingTypes} onChange={(writingType) => onProjectChange({ writingType })} />
              <SelectField label="Channel" value={project.channel} options={channels} onChange={(channel) => onProjectChange({ channel })} />
              <TextField label="Audience" value={project.audience} placeholder="Founders, operators, fiction readers" onChange={(audience) => onProjectChange({ audience })} />
              <TextField label="Goal" value={project.goal} placeholder="Explain, persuade, move readers to act" onChange={(goal) => onProjectChange({ goal })} />
              <TextField label="Must include" value={project.mustInclude} placeholder="Key examples, facts, scenes, links" onChange={(mustInclude) => onProjectChange({ mustInclude })} />
              <TextField label="Avoid" value={project.avoid} placeholder="Unsupported claims, generic phrasing" onChange={(avoid) => onProjectChange({ avoid })} />
              <SelectField label="Language" value={project.language} options={languages} onChange={(language) => onProjectChange({ language })} />
              <SelectField label="Length target" value={project.lengthTarget} options={lengthTargets} onChange={(lengthTarget) => onProjectChange({ lengthTarget })} />
              {project.lengthTarget === "Custom" ? (
                <TextField label="Custom word count" value={project.customWordCount} placeholder="1600 words" onChange={(customWordCount) => onProjectChange({ customWordCount })} />
              ) : null}
              <SelectField label="Tone direction" value={project.tone} options={tones} onChange={(tone) => onProjectChange({ tone })} />
              <SelectField label="Output goal" value={project.outputGoal} options={outputGoals} onChange={(outputGoal) => onProjectChange({ outputGoal })} />
              <SelectField
                label="Reader emotion target"
                value={project.readerEmotionTarget}
                options={emotions}
                onChange={(readerEmotionTarget) => onProjectChange({ readerEmotionTarget })}
              />
              <SelectField
                label="Content intention"
                value={project.intentionType}
                options={intentions}
                onChange={(intentionType) => onProjectChange({ intentionType })}
              />
              <Field label="References">
                <textarea
                  className="field-input min-h-[76px]"
                  value={project.references}
                  placeholder="Paste source notes, links, benchmark excerpts, or reference requirements."
                  onChange={(event) => onProjectChange({ references: event.target.value })}
                />
              </Field>
            </div>

            <label className="mt-3 flex items-center gap-2 px-1 text-sm font-semibold text-graphite">
              <input
                className="h-4 w-4 accent-lavender"
                type="checkbox"
                checked={project.reviewRequirementsFirst}
                onChange={(event) => onProjectChange({ reviewRequirementsFirst: event.target.checked })}
              />
              Review requirements first
            </label>
          </div>

          <aside className="grid content-start gap-3">
            <div className="glass rounded-[22px] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                <PenLine size={16} className="text-violet" />
                Current author
              </div>
              <select className="field-input" value={currentAuthor?.id ?? "none"} onChange={(event) => onSetAuthor(event.target.value === "none" ? null : event.target.value)}>
                <option value="none">No Author / Default Writer</option>
                {authors.map((author) => (
                  <option value={author.id} key={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-xs leading-5 text-muted">{currentAuthor?.styleSummary || "Generation will use a clean default writer without author-specific samples."}</p>
            </div>

            <div className="glass rounded-[22px] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                <FileText size={16} className="text-violet" />
                Optional context
              </div>
              <div className="flex flex-wrap gap-2">
                {chip("author", "Author", currentAuthor?.name ?? "Default", true)}
                {chip("type", "Type", project.writingType)}
                {chip("channel", "Channel", project.channel)}
                {chip("audience", "Audience", project.audience || "Any")}
                {chip("length", "Length", project.customWordCount || project.lengthTarget)}
                {chip("tone", "Tone", project.tone)}
                {chip("refs", "Refs", project.references ? "Attached" : "None")}
                {chip("more", "More", "Options")}
              </div>
              {openPanel ? (
                <div className="mt-3 rounded-2xl border border-white/60 bg-white/35 p-3">
                  {openPanel === "author" ? (
                    <div className="grid gap-2">
                      <span className="text-xs font-bold uppercase text-muted">Author selection</span>
                      <p className="text-xs leading-5 text-graphite">{currentAuthor?.description || "No reusable author selected for this task."}</p>
                    </div>
                  ) : openPanel === "more" ? (
                    <div className="grid gap-2">
                      <SelectField label="Output goal" value={project.outputGoal} options={outputGoals} onChange={(outputGoal) => onProjectChange({ outputGoal })} />
                      <SelectField label="Emotion target" value={project.readerEmotionTarget} options={emotions} onChange={(readerEmotionTarget) => onProjectChange({ readerEmotionTarget })} />
                    </div>
                  ) : (
                    <p className="text-xs leading-5 text-graphite">
                      {openPanel === "refs"
                        ? project.references || "No references attached yet."
                        : `${openPanel} can be adjusted in the main brief fields.`}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        {needsCommercial ? (
          <div className="mt-4 glass rounded-[22px] p-4">
            <h2 className="mb-3 text-sm font-extrabold text-ink">Commercial / hybrid settings</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <TextField
                label="Promotional subject"
                value={project.commercialSettings.promotionalSubject}
                placeholder="Product, service, founder, offer"
                onChange={(promotionalSubject) => onNestedChange("commercialSettings", { promotionalSubject })}
              />
              <SelectField
                label="Promotion visibility"
                value={project.commercialSettings.titleVisibility}
                options={["traffic-first", "balanced", "direct"]}
                onChange={(titleVisibility) => onNestedChange("commercialSettings", { titleVisibility: titleVisibility as WritingProject["commercialSettings"]["titleVisibility"] })}
              />
              <TextField
                label="Content-to-promotion ratio"
                value={project.commercialSettings.contentPromotionRatio}
                placeholder="80% content / 20% promotion"
                onChange={(contentPromotionRatio) => onNestedChange("commercialSettings", { contentPromotionRatio })}
              />
              <TextField
                label="Conversion goal"
                value={project.commercialSettings.conversionGoal}
                placeholder="Trust, lead capture, sales call"
                onChange={(conversionGoal) => onNestedChange("commercialSettings", { conversionGoal })}
              />
            </div>
          </div>
        ) : null}

        {needsCurrent ? (
          <div className="mt-4 glass rounded-[22px] p-4">
            <h2 className="mb-3 text-sm font-extrabold text-ink">Current-event safeguards</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <TextField
                label="Time window"
                value={project.currentEventSettings.timeWindow}
                placeholder="Last 30 days"
                onChange={(timeWindow) => onNestedChange("currentEventSettings", { timeWindow })}
              />
              <SelectField
                label="Source-language scope"
                value={project.currentEventSettings.sourceLanguageScope}
                options={["Chinese", "English", "Chinese + English"]}
                onChange={(sourceLanguageScope) =>
                  onNestedChange("currentEventSettings", {
                    sourceLanguageScope: sourceLanguageScope as WritingProject["currentEventSettings"]["sourceLanguageScope"],
                  })
                }
              />
              <label className="flex items-center gap-2 pt-6 text-xs font-bold text-graphite">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-lavender"
                  checked={project.currentEventSettings.requireSourceLinks}
                  onChange={(event) => onNestedChange("currentEventSettings", { requireSourceLinks: event.target.checked })}
                />
                Require source links
              </label>
              <label className="flex items-center gap-2 pt-6 text-xs font-bold text-graphite">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-lavender"
                  checked={project.currentEventSettings.noFabricatedFacts}
                  onChange={(event) => onNestedChange("currentEventSettings", { noFabricatedFacts: event.target.checked })}
                />
                No fabricated facts
              </label>
            </div>
          </div>
        ) : null}

        {needsStory ? (
          <div className="mt-4 glass rounded-[22px] p-4">
            <h2 className="mb-3 text-sm font-extrabold text-ink">Story / fiction settings</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Protagonist" value={project.storySettings.protagonist} onChange={(protagonist) => onNestedChange("storySettings", { protagonist })} />
              <TextField label="Setting" value={project.storySettings.setting} onChange={(setting) => onNestedChange("storySettings", { setting })} />
              <TextField label="Conflict" value={project.storySettings.conflict} onChange={(conflict) => onNestedChange("storySettings", { conflict })} />
              <TextField label="Theme" value={project.storySettings.theme} onChange={(theme) => onNestedChange("storySettings", { theme })} />
              <TextField label="Ending direction" value={project.storySettings.endingDirection} onChange={(endingDirection) => onNestedChange("storySettings", { endingDirection })} />
              <TextField label="POV" value={project.storySettings.pov} onChange={(pov) => onNestedChange("storySettings", { pov })} />
              <TextField label="Tense" value={project.storySettings.tense} onChange={(tense) => onNestedChange("storySettings", { tense })} />
              <TextField label="Genre" value={project.storySettings.genre} onChange={(genre) => onNestedChange("storySettings", { genre })} />
              <TextField label="Story constraints" value={project.storySettings.constraints} onChange={(constraints) => onNestedChange("storySettings", { constraints })} />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
