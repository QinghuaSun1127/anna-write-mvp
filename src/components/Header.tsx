import { FilePenLine, Library, Minus, Plus } from "lucide-react";
import type { Author, Stage, ViewMode } from "../types";

interface HeaderProps {
  currentAuthor: Author | null;
  writingMode: string;
  currentView: ViewMode;
  onOpenAuthors: () => void;
  onNewWriting: () => void;
  onMinimize: () => void;
}

export function Header({ currentAuthor, writingMode, currentView, onOpenAuthors, onNewWriting, onMinimize }: HeaderProps) {
  const authorLabel = currentAuthor?.name ?? "No Author";
  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/40 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b63]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f7c45a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#59d789]" />
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-lavender text-white shadow-lg shadow-violet/20">
          <FilePenLine size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold leading-tight text-ink">AnnaWrite</div>
          <div className="truncate text-xs text-muted">{authorLabel} author · {writingMode}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className={`btn ${currentView === "authors" ? "btn-ghost" : "btn-secondary"}`} onClick={onOpenAuthors}>
          <Library size={14} />
          Author
        </button>
        <button className="btn btn-secondary" onClick={onNewWriting}>
          <Plus size={14} />
          New Writing
        </button>
        <button className="icon-button" onClick={onMinimize} aria-label="Minimize">
          <Minus size={15} />
        </button>
      </div>
    </header>
  );
}

interface ProgressNavProps {
  stage: Stage;
  onStageChange: (stage: Stage) => void;
}

const stages: { id: Stage; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "requirements", label: "Requirements" },
  { id: "draft", label: "Draft" },
  { id: "publish", label: "Publish" },
];

export function ProgressNav({ stage, onStageChange }: ProgressNavProps) {
  const currentIndex = stages.findIndex((item) => item.id === stage);
  return (
    <nav className="relative border-b border-white/50 px-8 py-3" aria-label="Progress">
      <div className="absolute left-[78px] right-[78px] top-[25px] h-0.5 bg-graphite/10" />
      <div
        className="absolute left-[78px] top-[25px] h-0.5 bg-lavender transition-all"
        style={{ width: `${Math.max(0, currentIndex) * 33.333}%` }}
      />
      <div className="relative z-10 grid grid-cols-4 gap-2">
        {stages.map((item, index) => {
          const active = index <= currentIndex;
          return (
            <button
              key={item.id}
              className={`grid justify-items-center gap-1.5 text-[11px] font-bold transition ${active ? "text-violet" : "text-muted"}`}
              onClick={() => onStageChange(item.id)}
            >
              <span className={`h-3 w-3 rounded-full border-2 shadow-[0_0_0_4px_rgba(255,255,255,.48)] ${active ? "border-lavender bg-lavender" : "border-graphite/20 bg-white"}`} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
