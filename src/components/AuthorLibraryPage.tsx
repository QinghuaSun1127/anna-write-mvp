import { BookOpen, Check, FileUp, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Author, AuthorSample, SourceType } from "../types";
import { countWords } from "../utils/draft";
import { emptyParameters } from "../data/seed";

interface AuthorLibraryPageProps {
  authors: Author[];
  currentAuthorId: string | null;
  onSetAuthor: (authorId: string | null) => void;
  onCreateAuthor: () => string;
  onSaveAuthor: (author: Author) => void;
  onDeleteAuthor: (authorId: string) => void;
  onAnalyzeAuthor: (authorId: string) => void;
  busy: boolean;
}

const sourceTypes: SourceType[] = ["article", "story", "essay", "wechat", "newsletter", "chapter", "other"];

const blankSample = {
  title: "",
  content: "",
  sourceType: "article" as SourceType,
};

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function joinList(value: string[]) {
  return value.join(", ");
}

function makeSample(input: typeof blankSample): AuthorSample {
  return {
    id: `sample-${crypto.randomUUID()}`,
    title: input.title.trim() || "Untitled sample",
    content: input.content.trim(),
    sourceType: input.sourceType,
    wordCount: countWords(input.content),
    uploadedAt: new Date().toISOString(),
  };
}

export function AuthorLibraryPage({
  authors,
  currentAuthorId,
  onSetAuthor,
  onCreateAuthor,
  onSaveAuthor,
  onDeleteAuthor,
  onAnalyzeAuthor,
  busy,
}: AuthorLibraryPageProps) {
  const [selectedId, setSelectedId] = useState(currentAuthorId ?? authors[0]?.id ?? null);
  const [sampleDraft, setSampleDraft] = useState(blankSample);
  const [openSample, setOpenSample] = useState<AuthorSample | null>(null);
  const selected = useMemo(() => authors.find((author) => author.id === selectedId) ?? authors[0] ?? null, [authors, selectedId]);

  const updateSelected = (patch: Partial<Author>) => {
    if (!selected) return;
    onSaveAuthor({ ...selected, ...patch, updatedAt: new Date().toISOString() });
  };

  const updateParameters = (patch: Partial<Author["parameters"]>) => {
    if (!selected) return;
    updateSelected({ parameters: { ...selected.parameters, ...patch } });
  };

  const addSample = () => {
    if (!selected || !sampleDraft.content.trim()) return;
    const sample = makeSample(sampleDraft);
    updateSelected({ samples: [...selected.samples, sample] });
    setSampleDraft(blankSample);
  };

  const deleteSample = (sampleId: string) => {
    if (!selected) return;
    updateSelected({ samples: selected.samples.filter((sample) => sample.id !== sampleId) });
  };

  const createAuthor = () => {
    const id = onCreateAuthor();
    setSelectedId(id);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const content = await file.text();
    setSampleDraft({
      title: file.name.replace(/\.[^.]+$/, ""),
      sourceType: file.name.endsWith(".md") ? "article" : "other",
      content,
    });
  };

  return (
    <div className="page-scroll">
      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="glass rounded-[22px] p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-normal text-ink">Authors</h1>
              <p className="mt-1 text-xs leading-5 text-muted">Reusable writing-style profiles created from samples and editable skill notes.</p>
            </div>
            <button className="icon-button" onClick={createAuthor} aria-label="Create author">
              <Plus size={16} />
            </button>
          </div>
          <div className="grid gap-2">
            <button
              className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
                currentAuthorId === null ? "border-lavender/50 bg-white/80" : "border-white/50 bg-white/40"
              }`}
              onClick={() => onSetAuthor(null)}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-ink">No Author / Default Writer</h3>
                {currentAuthorId === null ? <span className="chip active">Current</span> : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">Use a clean default writer without author-specific samples.</p>
            </button>
            {authors.map((author) => (
              <button
                key={author.id}
                className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
                  selected?.id === author.id ? "border-lavender/50 bg-white/80 shadow-soft" : "border-white/50 bg-white/42"
                }`}
                onClick={() => setSelectedId(author.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-extrabold text-ink">{author.name}</h3>
                  {currentAuthorId === author.id ? <span className="chip active">Current</span> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{author.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {author.bestFor.slice(0, 3).map((item) => (
                    <span className="rounded-full bg-white/65 px-2 py-1 text-[10px] font-bold text-graphite" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {selected ? (
          <main className="grid gap-4">
            <div className="glass rounded-[22px] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[260px] flex-1">
                  <label className="field-label">Author name</label>
                  <input className="field-input text-lg font-extrabold" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                </div>
                <div className="flex gap-2 pt-6">
                  <button className="btn btn-ghost" onClick={() => onSetAuthor(selected.id)}>
                    <Check size={14} />
                    Set current
                  </button>
                  <button className="btn btn-danger" onClick={() => onDeleteAuthor(selected.id)}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,.8fr)]">
                <label>
                  <span className="field-label">Short description</span>
                  <textarea className="field-input min-h-[88px]" value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} />
                </label>
                <label>
                  <span className="field-label">Best use cases</span>
                  <textarea
                    className="field-input min-h-[88px]"
                    value={joinList(selected.bestFor)}
                    onChange={(event) => updateSelected({ bestFor: splitList(event.target.value) })}
                    placeholder="Founder notes, stories, essays"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.parameters.voiceTone.slice(0, 5).map((item) => (
                  <span className="chip active" key={item}>
                    {item}
                  </span>
                ))}
                <span className="chip">{selected.samples.length} samples</span>
                <span className="chip">{selected.parameters.detailDensity || "detail density pending"}</span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="grid gap-4">
                <div className="glass rounded-[22px] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold text-ink">Uploaded samples</h2>
                      <p className="text-xs leading-5 text-muted">Paste or upload multiple pieces by the same author or style.</p>
                    </div>
                    <label className="btn btn-secondary">
                      <FileUp size={14} />
                      Upload text
                      <input className="hidden" type="file" accept=".txt,.md,.rtf,.html,.csv" onChange={(event) => handleFile(event.target.files?.[0])} />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[.7fr_150px]">
                    <input
                      className="field-input"
                      value={sampleDraft.title}
                      placeholder="Sample title"
                      onChange={(event) => setSampleDraft((draft) => ({ ...draft, title: event.target.value }))}
                    />
                    <select
                      className="field-input"
                      value={sampleDraft.sourceType}
                      onChange={(event) => setSampleDraft((draft) => ({ ...draft, sourceType: event.target.value as SourceType }))}
                    >
                      {sourceTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="field-input mt-3 min-h-[140px]"
                    value={sampleDraft.content}
                    placeholder="Paste the full sample text here..."
                    onChange={(event) => setSampleDraft((draft) => ({ ...draft, content: event.target.value }))}
                  />
                  <div className="mt-3 flex justify-end">
                    <button className="btn btn-primary" onClick={addSample}>
                      <Plus size={14} />
                      Add sample
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {selected.samples.map((sample) => (
                      <article className="soft-panel rounded-2xl p-3" key={sample.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-ink">{sample.title}</h3>
                            <p className="mt-1 text-xs text-muted">
                              {sample.sourceType} · {sample.wordCount} words · {new Date(sample.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button className="icon-button" onClick={() => setOpenSample(sample)} aria-label="Open sample">
                              <BookOpen size={15} />
                            </button>
                            <button className="icon-button text-rose-700" onClick={() => deleteSample(sample.id)} aria-label="Delete sample">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-graphite">{sample.content}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-[22px] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold text-ink">Generated author skill</h2>
                      <p className="text-xs leading-5 text-muted">Editable style summary and operating manual generated from samples.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => onAnalyzeAuthor(selected.id)} disabled={busy || selected.samples.length === 0}>
                      <Sparkles size={14} />
                      Analyze samples
                    </button>
                  </div>
                  <label>
                    <span className="field-label">AI-generated style summary</span>
                    <textarea className="field-input min-h-[100px]" value={selected.styleSummary} onChange={(event) => updateSelected({ styleSummary: event.target.value })} />
                  </label>
                  <label className="mt-3 block">
                    <span className="field-label">Skill prompt / writing operating manual</span>
                    <textarea className="field-input min-h-[140px]" value={selected.skillPrompt} onChange={(event) => updateSelected({ skillPrompt: event.target.value })} />
                  </label>
                </div>
              </section>

              <aside className="grid content-start gap-4">
                <div className="glass rounded-[22px] p-4">
                  <h2 className="text-base font-extrabold text-ink">Style parameters</h2>
                  <div className="mt-3 grid gap-3">
                    <label>
                      <span className="field-label">Structural habits</span>
                      <textarea
                        className="field-input min-h-[70px]"
                        value={joinList(selected.parameters.structureHabits)}
                        onChange={(event) => updateParameters({ structureHabits: splitList(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Voice / tone parameters</span>
                      <textarea
                        className="field-input min-h-[70px]"
                        value={joinList(selected.parameters.voiceTone)}
                        onChange={(event) => updateParameters({ voiceTone: splitList(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Sentence rhythm</span>
                      <input className="field-input" value={selected.parameters.sentenceRhythm} onChange={(event) => updateParameters({ sentenceRhythm: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Narrative perspective</span>
                      <input className="field-input" value={selected.parameters.narrativePerspective} onChange={(event) => updateParameters({ narrativePerspective: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Opening patterns</span>
                      <textarea
                        className="field-input min-h-[70px]"
                        value={joinList(selected.parameters.openingPatterns)}
                        onChange={(event) => updateParameters({ openingPatterns: splitList(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Transition patterns</span>
                      <textarea
                        className="field-input min-h-[70px]"
                        value={joinList(selected.parameters.transitionPatterns)}
                        onChange={(event) => updateParameters({ transitionPatterns: splitList(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Emotional curve</span>
                      <input className="field-input" value={selected.parameters.emotionCurve} onChange={(event) => updateParameters({ emotionCurve: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Detail density</span>
                      <input className="field-input" value={selected.parameters.detailDensity} onChange={(event) => updateParameters({ detailDensity: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Dialogue tendency</span>
                      <input className="field-input" value={selected.parameters.dialogueTendency} onChange={(event) => updateParameters({ dialogueTendency: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Imagery / metaphor tendency</span>
                      <input
                        className="field-input"
                        value={selected.parameters.imageryMetaphorTendency}
                        onChange={(event) => updateParameters({ imageryMetaphorTendency: event.target.value })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Pacing style</span>
                      <input className="field-input" value={selected.parameters.pacingStyle} onChange={(event) => updateParameters({ pacingStyle: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Topic boundaries</span>
                      <textarea
                        className="field-input min-h-[70px]"
                        value={joinList(selected.parameters.topicBoundaries)}
                        onChange={(event) => updateParameters({ topicBoundaries: splitList(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Avoid list</span>
                      <textarea
                        className="field-input min-h-[70px]"
                        value={joinList(selected.parameters.avoidList)}
                        onChange={(event) => updateParameters({ avoidList: splitList(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Recommended prompt rules</span>
                      <textarea
                        className="field-input min-h-[90px]"
                        value={joinList(selected.parameters.recommendedRules)}
                        onChange={(event) => updateParameters({ recommendedRules: splitList(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="field-label">Optional channel rules</span>
                      <textarea
                        className="field-input min-h-[90px]"
                        value={Object.entries(selected.parameters.channelRules)
                          .map(([channel, rules]) => `${channel}: ${rules.join("; ")}`)
                          .join("\n")}
                        onChange={(event) => {
                          const next = Object.fromEntries(
                            event.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .map((line) => {
                                const [channel, rules = ""] = line.split(":");
                                return [channel.trim(), rules.split(";").map((rule) => rule.trim()).filter(Boolean)];
                              }),
                          );
                          updateParameters({ channelRules: next });
                        }}
                      />
                    </label>
                  </div>
                </div>
              </aside>
            </div>
          </main>
        ) : (
          <div className="glass rounded-[22px] p-6">
            <h2 className="text-xl font-extrabold text-ink">Create your first author</h2>
            <p className="mt-2 text-sm text-muted">Add samples, analyze them, then reuse the generated writing profile in any draft.</p>
            <button className="btn btn-primary mt-4" onClick={createAuthor}>
              <Plus size={14} />
              Create Author
            </button>
          </div>
        )}
      </section>

      {openSample ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#eef0f5]/50 p-6 backdrop-blur-md">
          <div className="document-preview max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[22px] border border-white/80 p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-ink">{openSample.title}</h2>
                <p className="mt-1 text-xs text-muted">
                  {openSample.sourceType} · {openSample.wordCount} words
                </p>
              </div>
              <button className="icon-button" onClick={() => setOpenSample(null)} aria-label="Close sample">
                <X size={16} />
              </button>
            </div>
            <div className="whitespace-pre-wrap text-[15px] leading-8 text-graphite">{openSample.content}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function createBlankAuthor(): Author {
  const createdAt = new Date().toISOString();
  return {
    id: `author-${crypto.randomUUID()}`,
    name: "New Author",
    description: "A reusable writing-style profile created from uploaded samples.",
    bestFor: ["Articles", "Essays"],
    samples: [],
    styleSummary: "",
    skillPrompt: "",
    parameters: { ...emptyParameters, channelRules: {} },
    createdAt,
    updatedAt: createdAt,
  };
}
