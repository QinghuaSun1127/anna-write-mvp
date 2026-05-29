import { ArrowDown, ArrowUp, ChevronRight, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import type { Author, RequirementCard, WritingProject } from "../types";

interface RequirementsPageProps {
  project: WritingProject;
  currentAuthor: Author | null;
  onProjectChange: (patch: Partial<WritingProject>) => void;
  onRegenerateCard: (card: RequirementCard) => void;
  onGenerateDraft: () => void;
  busy: boolean;
}

const priorityClasses = {
  high: "bg-rose-50 text-rose-700 border-rose-100",
  medium: "bg-violet-50 text-violet border-violet-100",
  low: "bg-slate-50 text-slate-600 border-slate-100",
};

export function RequirementsPage({ project, currentAuthor, onProjectChange, onRegenerateCard, onGenerateDraft, busy }: RequirementsPageProps) {
  const sortedCards = [...project.requirementCards].sort((a, b) => a.order - b.order);

  const updateCards = (cards: RequirementCard[]) => {
    onProjectChange({ requirementCards: cards.map((card, order) => ({ ...card, order })) });
  };

  const updateCard = (cardId: string, patch: Partial<RequirementCard>) => {
    updateCards(sortedCards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)));
  };

  const moveCard = (index: number, direction: -1 | 1) => {
    const next = [...sortedCards];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateCards(next);
  };

  const deleteCard = (cardId: string) => {
    updateCards(sortedCards.filter((card) => card.id !== cardId));
  };

  const addCard = () => {
    updateCards([
      ...sortedCards,
      {
        id: `card-${crypto.randomUUID()}`,
        type: "custom",
        title: "Custom requirement",
        content: "Add a specific requirement for this draft.",
        authorLink: currentAuthor ? `Check against ${currentAuthor.name}'s operating manual.` : "Use the default writer.",
        priority: "medium",
        order: sortedCards.length,
        editable: true,
      },
    ]);
  };

  return (
    <div className="page-scroll">
      <section className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[32px] font-extrabold leading-tight tracking-normal text-ink">Review requirements</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              AnnaWrite plans before drafting. Edit, regenerate, delete, or reorder cards until the writing standard is clear.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={addCard}>
              <Plus size={14} />
              Add card
            </button>
            <button className="btn btn-primary" onClick={onGenerateDraft} disabled={busy || sortedCards.length === 0}>
              <Sparkles size={14} />
              Create draft
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_.82fr]">
          <div className="glass rounded-[22px] p-4">
            <span className="field-label">Working title</span>
            <input
              className="field-input text-lg font-extrabold"
              value={project.requirementTitle}
              onChange={(event) => onProjectChange({ requirementTitle: event.target.value })}
              placeholder="Generated title appears here"
            />
            <p className="mt-3 text-xs leading-5 text-muted">
              Author context: {currentAuthor ? `${currentAuthor.name} · ${currentAuthor.styleSummary}` : "No selected author; requirements use a default writer."}
            </p>
          </div>
          <div className="glass rounded-[22px] p-4">
            <span className="field-label">Brief signal</span>
            <p className="line-clamp-4 text-sm leading-6 text-graphite">{project.brief || "No brief captured yet."}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {sortedCards.map((card, index) => (
            <article className="glass rounded-[20px] p-4 transition hover:-translate-y-0.5" key={card.id}>
              <div className="grid gap-3 md:grid-cols-[34px_minmax(0,1fr)_auto]">
                <div className="grid gap-1">
                  <button className="icon-button" onClick={() => moveCard(index, -1)} aria-label="Move up">
                    <ArrowUp size={14} />
                  </button>
                  <button className="icon-button" onClick={() => moveCard(index, 1)} aria-label="Move down">
                    <ArrowDown size={14} />
                  </button>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)_120px]">
                    <label>
                      <span className="field-label">Type</span>
                      <input className="field-input" value={card.type} onChange={(event) => updateCard(card.id, { type: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Title</span>
                      <input className="field-input font-bold" value={card.title} onChange={(event) => updateCard(card.id, { title: event.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Priority</span>
                      <select className="field-input" value={card.priority} onChange={(event) => updateCard(card.id, { priority: event.target.value as RequirementCard["priority"] })}>
                        <option>high</option>
                        <option>medium</option>
                        <option>low</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    <span className="field-label">Requirement</span>
                    <textarea className="field-input min-h-[86px]" value={card.content} onChange={(event) => updateCard(card.id, { content: event.target.value })} />
                  </label>
                  <label>
                    <span className="field-label">Author-style link</span>
                    <input className="field-input" value={card.authorLink} onChange={(event) => updateCard(card.id, { authorLink: event.target.value })} />
                  </label>
                </div>
                <div className="flex flex-row gap-2 md:flex-col">
                  <span className={`rounded-full border px-2 py-1 text-center text-[10px] font-extrabold ${priorityClasses[card.priority]}`}>{card.priority}</span>
                  <button className="icon-button" onClick={() => onRegenerateCard(card)} aria-label="Regenerate card">
                    <RefreshCw size={14} />
                  </button>
                  <button className="icon-button text-rose-700" onClick={() => deleteCard(card.id)} aria-label="Delete card">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
