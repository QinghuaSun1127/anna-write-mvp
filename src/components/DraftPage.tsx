import { ChevronRight, RotateCcw, Save, Sparkles, Wand2, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { Author, DraftBlock, SelectionState, WritingProject } from "../types";
import { countWords, selectedTextFromDraft } from "../utils/draft";

interface DraftPageProps {
  project: WritingProject;
  currentAuthor: Author | null;
  selection: SelectionState;
  titleOptions: string[];
  onSelectionChange: (selection: SelectionState) => void;
  onUpdateDraftTitle: (title: string) => void;
  onUpdateBlockText: (blockId: string, text: string) => void;
  onRewriteSelected: (instruction: string) => void;
  onRefineWholeDraft: (instruction: string) => void;
  onGenerateTitles: () => void;
  onApplyTitle: (title: string) => void;
  onSaveDraftAsSample: () => void;
  onGoPublish: () => void;
  onUndo: () => void;
  busy: boolean;
}

function isSameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function BlockEditor({
  block,
  selectedIds,
  onToggleSentence,
  onSelectParagraph,
  onUpdateBlockText,
}: {
  block: DraftBlock;
  selectedIds: string[];
  onToggleSentence: (sentenceId: string) => void;
  onSelectParagraph: (block: DraftBlock) => void;
  onUpdateBlockText: (blockId: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(block.sentences.map((sentence) => sentence.text).join(" "));
  const allSelected = block.sentences.length > 0 && block.sentences.every((sentence) => selectedIds.includes(sentence.id));

  return (
    <div className="group rounded-2xl border border-transparent p-2 transition hover:border-lavender/20 hover:bg-lavender/5">
      <div className="mb-2 flex items-center justify-between gap-2 opacity-80">
        <button className={`chip ${allSelected ? "active" : ""}`} onClick={() => onSelectParagraph(block)}>
          Select paragraph
        </button>
        <button
          className="chip"
          onClick={() => {
            if (editing) {
              onUpdateBlockText(block.id, draftText);
            } else {
              setDraftText(block.sentences.map((sentence) => sentence.text).join(" "));
            }
            setEditing(!editing);
          }}
        >
          {editing ? "Save paragraph" : "Edit paragraph"}
        </button>
      </div>
      {editing ? (
        <textarea className="field-input min-h-[130px]" value={draftText} onChange={(event) => setDraftText(event.target.value)} />
      ) : (
        <p className="text-[15px] leading-8 text-graphite">
          {block.sentences.map((sentence) => (
            <Fragment key={sentence.id}>
              <button type="button" className={`sentence ${selectedIds.includes(sentence.id) ? "selected" : ""}`} onClick={() => onToggleSentence(sentence.id)}>
                {sentence.text}
              </button>{" "}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}

export function DraftPage({
  project,
  currentAuthor,
  selection,
  titleOptions,
  onSelectionChange,
  onUpdateDraftTitle,
  onUpdateBlockText,
  onRewriteSelected,
  onRefineWholeDraft,
  onGenerateTitles,
  onApplyTitle,
  onSaveDraftAsSample,
  onGoPublish,
  onUndo,
  busy,
}: DraftPageProps) {
  const [selectedInstruction, setSelectedInstruction] = useState("");
  const [wholeInstruction, setWholeInstruction] = useState("");
  const draft = project.draft;
  const selectedText = useMemo(() => selectedTextFromDraft(draft, selection.sentenceIds), [draft, selection.sentenceIds]);

  const toggleSentence = (sentenceId: string) => {
    const exists = selection.sentenceIds.includes(sentenceId);
    onSelectionChange({
      sentenceIds: exists ? selection.sentenceIds.filter((id) => id !== sentenceId) : [...selection.sentenceIds, sentenceId],
    });
  };

  const selectParagraph = (block: DraftBlock) => {
    const ids = block.sentences.map((sentence) => sentence.id);
    const next = isSameSet(ids, selection.sentenceIds.filter((id) => ids.includes(id)))
      ? selection.sentenceIds.filter((id) => !ids.includes(id))
      : Array.from(new Set([...selection.sentenceIds, ...ids]));
    onSelectionChange({ sentenceIds: next });
  };

  const runSelected = (instruction: string) => {
    const finalInstruction = instruction || selectedInstruction;
    if (!finalInstruction.trim()) return;
    onRewriteSelected(finalInstruction);
    setSelectedInstruction("");
  };

  const runWhole = (instruction: string) => {
    const finalInstruction = instruction || wholeInstruction;
    if (!finalInstruction.trim()) return;
    onRefineWholeDraft(finalInstruction);
    setWholeInstruction("");
  };

  if (!draft) {
    return (
      <div className="page-scroll">
        <div className="glass mx-auto grid max-w-lg place-items-center rounded-[22px] p-8 text-center">
          <h1 className="text-2xl font-extrabold text-ink">No draft yet</h1>
          <p className="mt-2 text-sm text-muted">Generate requirements first, then create a draft.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-scroll">
      <section className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <main className="document-preview rounded-[22px] border border-white/80 p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="chip active">Draft v{draft.version}</span>
                <span className="chip">{currentAuthor?.name ?? "Default Writer"}</span>
                <span className="chip">{project.channel}</span>
                <span className="chip">{project.writingType}</span>
                <span className="chip">{countWords(draft.blocks.map((block) => block.text).join(" "))} words</span>
              </div>
              <input
                className="w-full border-0 bg-transparent text-[30px] font-extrabold leading-tight tracking-normal text-ink outline-none"
                value={draft.title}
                onChange={(event) => onUpdateDraftTitle(event.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={onGoPublish}>
              Publish
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid gap-3">
            {draft.blocks.map((block) => (
              <BlockEditor
                key={block.id}
                block={block}
                selectedIds={selection.sentenceIds}
                onToggleSentence={toggleSentence}
                onSelectParagraph={selectParagraph}
                onUpdateBlockText={onUpdateBlockText}
              />
            ))}
          </div>
        </main>

        <aside className="grid content-start gap-3">
          <div className="glass rounded-[22px] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-ink">Selected-text editor</h2>
              {selection.sentenceIds.length ? (
                <button className="icon-button" onClick={() => onSelectionChange({ sentenceIds: [] })} aria-label="Cancel selection">
                  <X size={15} />
                </button>
              ) : null}
            </div>
            <div className="max-h-32 overflow-auto rounded-2xl border border-white/70 bg-white/45 p-3 text-xs leading-5 text-graphite">
              {selectedText || "Click a sentence or select a paragraph in the draft."}
            </div>
            <textarea
              className="field-input mt-3 min-h-[78px]"
              value={selectedInstruction}
              onChange={(event) => setSelectedInstruction(event.target.value)}
              placeholder="How should this selected part be changed?"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                "Make more like Author",
                "Shorten selected",
                "Expand selected",
                "Make more emotional",
                "Make more concrete",
                "Make more literary",
                "Make clearer",
              ].map((label) => (
                <button className="btn btn-secondary justify-start" key={label} onClick={() => runSelected(label)} disabled={!selectedText || busy}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary flex-1" onClick={() => runSelected("")} disabled={!selectedText || !selectedInstruction.trim() || busy}>
                <Wand2 size={14} />
                Rewrite selected
              </button>
              <button className="btn btn-secondary" onClick={onUndo}>
                <RotateCcw size={14} />
                Undo
              </button>
            </div>
          </div>

          <div className="glass rounded-[22px] p-4">
            <h2 className="text-sm font-extrabold text-ink">Whole-draft refinement</h2>
            <p className="mt-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">Affects the whole article/story</p>
            <textarea
              className="field-input mt-3 min-h-[80px]"
              value={wholeInstruction}
              onChange={(event) => setWholeInstruction(event.target.value)}
              placeholder="Make the whole draft more suspenseful..."
            />
            <div className="mt-3 grid gap-2">
              {["Make the whole draft more suspenseful", "Strengthen the opening", "Make the ending more powerful", "Reduce marketing tone", "Add more examples", "Improve structure"].map((label) => (
                <button className="btn btn-secondary justify-start" key={label} onClick={() => runWhole(label)} disabled={busy}>
                  {label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary mt-3 w-full" onClick={() => runWhole("")} disabled={!wholeInstruction.trim() || busy}>
              <Sparkles size={14} />
              Refine whole draft
            </button>
          </div>

          <div className="glass rounded-[22px] p-4">
            <h2 className="text-sm font-extrabold text-ink">Draft actions</h2>
            <div className="mt-3 grid gap-2">
              <button className="btn btn-secondary justify-start" onClick={onGenerateTitles} disabled={busy}>
                Generate title options
              </button>
              <button className="btn btn-secondary justify-start" onClick={() => runWhole("Rewrite opening")} disabled={busy}>
                Rewrite opening
              </button>
              <button className="btn btn-secondary justify-start" onClick={() => runWhole("Rewrite ending")} disabled={busy}>
                Rewrite ending
              </button>
              <button className="btn btn-secondary justify-start" onClick={() => runWhole("Add scene or example")} disabled={busy}>
                Add scene/example
              </button>
              <button className="btn btn-secondary justify-start" onClick={() => runWhole("Improve coherence")} disabled={busy}>
                Improve coherence
              </button>
              <button className="btn btn-ghost justify-start" onClick={onSaveDraftAsSample}>
                <Save size={14} />
                Save draft as Author sample
              </button>
            </div>
            {titleOptions.length ? (
              <div className="mt-3 grid gap-2">
                {titleOptions.map((title) => (
                  <button className="rounded-2xl border border-white/70 bg-white/55 p-3 text-left text-xs font-bold leading-5 text-graphite transition hover:-translate-y-0.5" key={title} onClick={() => onApplyTitle(title)}>
                    {title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
