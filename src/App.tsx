import {
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Edit3,
  FileText,
  Library,
  Loader2,
  MessageCircle,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LlmTracePanel } from "./components/LlmTracePanel";
import { ToastStack } from "./components/Toast";
import { createEmptyProject, defaultPublishSettings, emptyParameters } from "./data/seed";
import { llmService } from "./services/llmService";
import { loadStoredState, saveAuthors, saveCurrentAuthor, saveProject } from "./services/storage";
import type { Author, AuthorSample, Draft, DraftBlock, EditHistory, LlmTraceEvent, SourceType, TextSelectionRange, ToastMessage, WritingProject } from "./types";
import {
  blockFromText,
  cloneDraft,
  countWords,
  draftPlainText,
  insertDraftTextBelowRange,
  makeDraftFromParagraphs,
  replaceDraftTextRange,
  updateDraftBlockText,
} from "./utils/draft";

type Screen = "home" | "styles" | "editor";
type ExportFormat = "Plain text" | "Markdown" | "HTML" | "Word document" | "PDF" | "LinkedIn post" | "Xiaohongshu post" | "Email draft";
type ExportResult = { filename: string; content: string; mime: string; extension: string; encoding?: "utf8" | "base64" };
type ExportSaveStatus = "saved" | "downloaded" | "canceled";

interface FileSystemWritableFileStream {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandle {
  createWritable: () => Promise<FileSystemWritableFileStream>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  }
}

interface RevisionState {
  open: boolean;
  action: string;
  instruction: string;
  original: string;
  suggestion: string;
  loading: boolean;
  range: TextSelectionRange | null;
}

interface AssistantSuggestion {
  instruction: string;
  before: Draft;
  draft: Draft;
}

interface ExportReceipt {
  filename: string;
  format: ExportFormat;
  status: ExportSaveStatus;
  locationLabel: string;
  detail: string;
  copyText: string;
  savedAt: string;
}

const now = () => new Date().toISOString();

const quickChips = ["Make it shorter", "More emotional", "More professional", "More story-like", "Simpler English", "Add examples"];
const assistantPresets = [
  "Make this more natural",
  "Make it shorter",
  "Improve the opening",
  "Make the tone more academic",
  "Make it sound less AI-written",
  "Strengthen the ending",
  "Simplify the language",
  "Add more emotional detail",
];
const revisionPresets = ["More natural", "More concise", "More academic", "More emotional", "Less AI-like"];
const exportFormats: ExportFormat[] = ["Plain text", "Markdown", "HTML", "Word document", "PDF", "LinkedIn post", "Xiaohongshu post", "Email draft"];
const demoGoal = "Write a warm, clear newsletter about starting over in a new city. Make it personal, easy to read, and useful for readers who feel a little lost.";

function Background() {
  return (
    <div className="desktop-bg" aria-hidden="true">
      <div className="float-window one">
        <div className="float-header"><span className="float-dot" /><span className="float-dot" /><span className="float-dot" /></div>
        <div className="float-content"><span className="float-line w-3/4" /><span className="float-line w-11/12" /><span className="float-line w-1/2" /><span className="float-line h-16 w-4/5 rounded-2xl" /></div>
      </div>
      <div className="float-window two">
        <div className="float-header"><span className="float-dot" /><span className="float-dot" /><span className="float-dot" /></div>
        <div className="float-content"><span className="float-line w-full" /><span className="float-line w-2/3" /><span className="float-line w-4/5" /><span className="float-line w-full" /></div>
      </div>
      <div className="float-window three">
        <div className="float-header"><span className="float-dot" /><span className="float-dot" /><span className="float-dot" /></div>
        <div className="float-content"><span className="float-line w-7/12" /><span className="float-line w-11/12" /><span className="float-line w-8/12" /></div>
      </div>
    </div>
  );
}

function makeHistory(type: EditHistory["type"], before: EditHistory["before"], after: EditHistory["after"], instruction: string): EditHistory {
  return {
    id: `edit-${crypto.randomUUID()}`,
    type,
    before,
    after,
    instruction,
    timestamp: now(),
  };
}

function createBlankAuthor(): Author {
  return {
    id: `author-${crypto.randomUUID()}`,
    name: "New Style",
    description: "A clear, simple writing style.",
    bestFor: ["Essays", "Posts"],
    samples: [],
    styleSummary: "Clear, useful, and easy to read.",
    skillPrompt: "Write clearly with concrete examples and a calm tone.",
    parameters: emptyParameters,
    createdAt: now(),
    updatedAt: now(),
  };
}

function makeSample(title: string, content: string, sourceType: SourceType = "essay"): AuthorSample {
  return {
    id: `sample-${crypto.randomUUID()}`,
    title: title.trim() || "Untitled sample",
    content: content.trim(),
    sourceType,
    wordCount: countWords(content),
    uploadedAt: now(),
  };
}

function styleTags(author: Author | null) {
  if (!author) return ["clear", "simple", "default"];
  return [...author.parameters.voiceTone, ...author.bestFor].filter(Boolean).slice(0, 4);
}

function styleSummaryBullets(author: Author | null) {
  const summary = author?.styleSummary || "Clear, useful writing with a calm default voice.";
  return summary
    .split(/(?<=[.!?。！？])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function isBlankNewStyle(author: Author) {
  return author.name.trim().toLowerCase() === "new style" && author.samples.length === 0 && author.description.trim().toLowerCase() === "a clear, simple writing style.";
}

function visibleStyleAuthors(authors: Author[]) {
  let keptBlank = false;
  return authors.filter((author) => {
    if (!isBlankNewStyle(author)) return true;
    if (keptBlank) return false;
    keptBlank = true;
    return true;
  });
}

function titleFromGoal(goal: string) {
  const cleaned = goal.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled Draft";
  return cleaned.replace(/^write\s+(an?|the)?\s*/i, "").slice(0, 72).replace(/[.!?。！？]$/, "") || "Untitled Draft";
}

function sentenceBoundsAt(text: string, offset: number) {
  if (!text.trim()) return null;
  const safeOffset = Math.min(Math.max(offset, 0), Math.max(text.length - 1, 0));
  let start = safeOffset;
  while (start > 0 && !/[.!?。！？\n]/.test(text[start - 1])) start -= 1;
  let end = safeOffset;
  while (end < text.length && !/[.!?。！？\n]/.test(text[end])) end += 1;
  if (end < text.length && /[.!?。！？]/.test(text[end])) end += 1;
  while (end < text.length && /["'”’)\]\s]/.test(text[end])) end += 1;
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return start < end ? { start, end, text: text.slice(start, end) } : null;
}

function textOffsetFromPoint(container: HTMLElement, x: number, y: number) {
  const doc = container.ownerDocument;
  const rangeFromPoint =
    doc.caretRangeFromPoint?.bind(doc) ??
    ((pointX: number, pointY: number) => {
      const position = doc.caretPositionFromPoint?.(pointX, pointY);
      if (!position) return null;
      const range = doc.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    });
  const caretRange = rangeFromPoint(x, y);
  if (!caretRange) return 0;
  const prefix = doc.createRange();
  prefix.selectNodeContents(container);
  prefix.setEnd(caretRange.startContainer, caretRange.startOffset);
  return prefix.toString().length;
}

function viewportRect(rect: DOMRect) {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function exportExtension(format: ExportFormat) {
  if (format === "Word document") return "docx";
  if (format === "PDF") return "pdf";
  if (format === "Markdown") return "md";
  if (format === "HTML") return "html";
  return "txt";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function draftBlockTexts(draft: Draft) {
  return draft.blocks.map((block) => block.sentences.map((sentence) => sentence.text).join(" ").trim()).filter(Boolean);
}

function draftDiffItems(before: Draft, after: Draft) {
  const beforeBlocks = [before.title, ...draftBlockTexts(before)];
  const afterBlocks = [after.title, ...draftBlockTexts(after)];
  const max = Math.max(beforeBlocks.length, afterBlocks.length);
  const changes: Array<{ label: string; before: string; after: string }> = [];
  for (let index = 0; index < max; index += 1) {
    const beforeText = beforeBlocks[index] || "";
    const afterText = afterBlocks[index] || "";
    if (beforeText.trim() === afterText.trim()) continue;
    changes.push({
      label: index === 0 ? "Title" : `Paragraph ${index}`,
      before: beforeText,
      after: afterText,
    });
  }
  return changes;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function buildDocxBase64(draft: Draft) {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 360 },
      children: [new TextRun({ text: draft.title, bold: true, size: 36 })],
    }),
    ...draftBlockTexts(draft).map((text) => new Paragraph({
      spacing: { after: 260 },
      children: [new TextRun({ text, size: 24 })],
    })),
  ];
  const doc = new Document({
    creator: "AnnaWrite",
    description: "Draft exported from AnnaWrite",
    title: draft.title,
    sections: [{ properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children }],
  });
  return Packer.toBase64String(doc);
}

async function buildPdfBase64(draft: Draft) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 72;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pdf.internal.pageSize.getWidth() - marginX * 2;
  let y = 74;

  pdf.setFont("times", "bold");
  pdf.setFontSize(22);
  pdf.text(pdf.splitTextToSize(draft.title, maxWidth), marginX, y);
  y += 52;
  pdf.setFont("times", "normal");
  pdf.setFontSize(12);

  draftBlockTexts(draft).forEach((paragraph) => {
    const lines = pdf.splitTextToSize(paragraph, maxWidth);
    lines.forEach((line: string) => {
      if (y > pageHeight - 72) {
        pdf.addPage();
        y = 72;
      }
      pdf.text(line, marginX, y);
      y += 17;
    });
    y += 12;
  });

  const out = pdf.output("arraybuffer") as ArrayBuffer;
  return arrayBufferToBase64(out);
}

async function buildExportFile(draft: Draft, settings: WritingProject["publishSettings"], cards: WritingProject["requirementCards"], format: ExportFormat): Promise<ExportResult> {
  const extension = exportExtension(format);
  const title = settings.documentTitle || draft.title || "annawrite-draft";
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "annawrite-draft";
  const suffix =
    format === "LinkedIn post" ? "-linkedin" :
    format === "Xiaohongshu post" ? "-xiaohongshu" :
    format === "Email draft" ? "-email" :
    "";
  const filename = `${safeTitle}${suffix}.${extension}`;
  const bodyBlocks = draftBlockTexts(draft);
  const plainBody = bodyBlocks.join("\n\n");
  if (format === "Markdown") {
    const markdown = [`# ${draft.title}`, "", ...bodyBlocks].join("\n\n");
    return { filename, content: markdown, mime: "text/markdown;charset=utf-8", extension };
  }
  if (format === "Word document") {
    return {
      filename,
      content: await buildDocxBase64(draft),
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension,
      encoding: "base64",
    };
  }
  if (format === "HTML") {
    const paragraphs = bodyBlocks.map((text) => `<p>${escapeHtml(text)}</p>`).join("\n");
    return {
      filename,
      mime: "text/html;charset=utf-8",
      extension,
      content: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(draft.title)}</title><style>body{font-family:Georgia,serif;line-height:1.65;color:#272331;}article{max-width:760px;margin:40px auto;}h1{font-family:Arial,sans-serif;font-size:28px;}p{margin:0 0 14px;}</style></head><body><article><h1>${escapeHtml(draft.title)}</h1>${paragraphs}</article></body></html>`,
    };
  }
  if (format === "PDF") {
    return { filename, content: await buildPdfBase64(draft), mime: "application/pdf", extension, encoding: "base64" };
  }
  const body = [draft.title, "", plainBody].join("\n\n");
  return { filename, content: body, mime: "text/plain;charset=utf-8", extension };
}

function exportBlob(file: ExportResult) {
  return new Blob([file.encoding === "base64" ? base64ToBytes(file.content) : file.content], { type: file.mime });
}

function triggerBrowserDownload(file: ExportResult, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function saveExportFile(file: ExportResult): Promise<{ status: ExportSaveStatus; locationLabel: string; detail: string }> {
  const blob = exportBlob(file);
  const picker = window.showSaveFilePicker;
  if (picker) {
    try {
      const mime = file.mime.split(";")[0] || "application/octet-stream";
      const handle = await picker({
        suggestedName: file.filename,
        types: [{ description: `${file.extension.toUpperCase()} file`, accept: { [mime]: [`.${file.extension}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return {
        status: "saved",
        locationLabel: "Saved with system dialog",
        detail: "The file was saved to the location you chose.",
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          status: "canceled",
          locationLabel: "Export canceled",
          detail: "No file was saved because the save dialog was canceled.",
        };
      }
      // Fall through to browser download when the picker exists but is blocked by the host.
    }
  }

  triggerBrowserDownload(file, blob);
  return {
    status: "downloaded",
    locationLabel: "Browser download",
    detail: "Your browser or Anna host controls the final location. Check Downloads if no save prompt appeared.",
  };
}

export default function App() {
  const stored = useMemo(() => loadStoredState(), []);
  const [authors, setAuthors] = useState<Author[]>(stored.authors);
  const [currentAuthorId, setCurrentAuthorId] = useState<string | null>(stored.currentAuthorId);
  const [project, setProject] = useState<WritingProject>(stored.project);
  const [screen, setScreen] = useState<Screen>(stored.project.draft?.blocks.length ? "editor" : "home");
  const [writingGoal, setWritingGoal] = useState(stored.project.brief);
  const [quickDirectives, setQuickDirectives] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<TextSelectionRange | null>(null);
  const [revision, setRevision] = useState<RevisionState>({ open: false, action: "", instruction: "", original: "", suggestion: "", loading: false, range: null });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantSuggestion, setAssistantSuggestion] = useState<AssistantSuggestion | null>(null);
  const [lastExport, setLastExport] = useState<ExportReceipt | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("Markdown");
  const [selectedStyleDetails, setSelectedStyleDetails] = useState<string | null>(currentAuthorId);
  const [styleEditOpen, setStyleEditOpen] = useState(false);
  const [sampleDraft, setSampleDraft] = useState({ title: "", content: "", sourceType: "essay" as SourceType });
  const [sampleViewer, setSampleViewer] = useState<AuthorSample | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [llmTraces, setLlmTraces] = useState<LlmTraceEvent[]>([]);
  const [llmConnecting, setLlmConnecting] = useState(true);
  const documentRef = useRef<HTMLDivElement | null>(null);
  const suppressSelectionCaptureRef = useRef(false);

  const currentAuthor = useMemo(() => authors.find((author) => author.id === currentAuthorId) ?? null, [authors, currentAuthorId]);
  const selectedStyle = useMemo(() => authors.find((author) => author.id === selectedStyleDetails) ?? currentAuthor, [authors, selectedStyleDetails, currentAuthor]);
  const activeTrace = useMemo(() => llmTraces.find((trace) => trace.status === "running"), [llmTraces]);
  const draft = project.draft;
  const hasDraft = Boolean(draft?.blocks.length);
  const llmStatusTone = activeTrace || llmConnecting ? "working" : llmService.getStatusTone();
  const llmStatusLabel = activeTrace ? "AI working" : llmConnecting ? "Connecting LLM" : llmService.getStatusLabel();

  useEffect(() => saveAuthors(authors), [authors]);
  useEffect(() => saveCurrentAuthor(currentAuthorId), [currentAuthorId]);
  useEffect(() => saveProject(project), [project]);
  useEffect(() => {
    let cancelled = false;
    setLlmConnecting(true);
    llmService.warmupRuntime()
      .catch(() => false)
      .finally(() => {
        if (cancelled) return;
        setLlmConnecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>(".workspace-body .page-scroll");
    scrollContainer?.scrollTo({ top: 0 });
  }, [screen]);

  const toast = (text: string, tone: ToastMessage["tone"] = "info") => {
    const message = { id: `toast-${crypto.randomUUID()}`, text, tone };
    setToasts((items) => [...items, message]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== message.id)), 2600);
  };

  const startLlmTrace = (name: string, input: string) => {
    const trace: LlmTraceEvent = { id: `llm-${crypto.randomUUID()}`, name, status: "running", input, startedAt: now() };
    setLlmTraces((items) => [trace, ...items].slice(0, 20));
    return trace.id;
  };

  const finishLlmTrace = (id: string, output: string, status: LlmTraceEvent["status"] = "done") => {
    setLlmTraces((items) => items.map((trace) => (trace.id === id ? { ...trace, status, output, finishedAt: now() } : trace)));
  };

  const updateProject = (patch: Partial<WritingProject>) => {
    setProject((current) => ({ ...current, ...patch, updatedAt: now() }));
  };

  const saveAuthor = (author: Author) => {
    setAuthors((items) => items.map((item) => (item.id === author.id ? author : item)));
  };

  const setAuthor = (authorId: string | null) => {
    setCurrentAuthorId(authorId);
    setSelectedStyleDetails(authorId);
    updateProject({ authorId });
    toast(authorId ? "Style selected" : "Default style selected", "success");
  };

  const syncDraftFromEditor = (sourceDraft = project.draft) => {
    if (!sourceDraft) return null;
    let next = sourceDraft;
    documentRef.current?.querySelectorAll<HTMLElement>("[data-block-id]").forEach((node) => {
      const blockId = node.dataset.blockId;
      if (!blockId) return;
      next = updateDraftBlockText(next, blockId, node.innerText.trim());
    });
    return next;
  };

  const generateDraftFromGoal = async () => {
    const goal = writingGoal.trim() || "Write a short reflective essay about a quiet change in daily life.";
    const nextProject: WritingProject = {
      ...createEmptyProject(currentAuthorId),
      brief: goal,
      title: titleFromGoal(goal),
      writingType: project.writingType || "Article",
      channel: project.channel || "Blog",
      language: project.language || "English",
      lengthTarget: project.lengthTarget || "Medium",
      tone: project.tone || "Natural",
      mustInclude: quickDirectives.join("; "),
      authorId: currentAuthorId,
      publishSettings: {
        ...defaultPublishSettings,
        documentTitle: titleFromGoal(goal),
        authorNameDisplay: currentAuthor?.name ?? "",
      },
      updatedAt: now(),
    };
    setBusy(true);
    const traceId = startLlmTrace("generateDraft", `${currentAuthor?.name ?? "Default Style"} · ${goal.slice(0, 120)}`);
    try {
      const nextDraft = await llmService.generateDraft(nextProject, currentAuthor);
      finishLlmTrace(traceId, `${llmService.getProviderLabel()} · ${nextDraft.blocks.length} paragraphs`);
      setProject({
        ...nextProject,
        title: nextDraft.title,
        draft: nextDraft,
        publishSettings: { ...nextProject.publishSettings, documentTitle: nextDraft.title },
        updatedAt: now(),
      });
      setIsModified(false);
      setSelectedRange(null);
      setScreen("editor");
      toast("Draft ready", "success");
    } catch (error) {
      finishLlmTrace(traceId, error instanceof Error ? error.message : "Draft generation failed.", "error");
      toast("Draft failed", "warning");
    } finally {
      setBusy(false);
    }
  };

  const startBlankDraft = () => {
    const title = titleFromGoal(writingGoal) || "Untitled Draft";
    const nextDraft = makeDraftFromParagraphs(title, [""]);
    updateProject({
      brief: writingGoal,
      title,
      draft: nextDraft,
      authorId: currentAuthorId,
      publishSettings: { ...project.publishSettings, documentTitle: title, authorNameDisplay: currentAuthor?.name ?? "" },
    });
    setIsModified(false);
    setScreen("editor");
  };

  const newWriting = () => {
    setProject(createEmptyProject(currentAuthorId));
    setWritingGoal("");
    setQuickDirectives([]);
    setSelectedRange(null);
    setAssistantSuggestion(null);
    setIsModified(false);
    setScreen("home");
  };

  const updateDraftTitle = (title: string) => {
    if (!project.draft) return;
    updateProject({
      title,
      draft: { ...project.draft, title, updatedAt: now() },
      publishSettings: { ...project.publishSettings, documentTitle: title },
    });
    setIsModified(true);
  };

  const updateBlockFromEditor = (blockId: string, text: string) => {
    if (!project.draft) return;
    updateProject({ draft: updateDraftBlockText(project.draft, blockId, text) });
    setIsModified(true);
  };

  const fillDemo = () => {
    const demoAuthor = authors[0]?.id ?? null;
    setCurrentAuthorId(demoAuthor);
    setSelectedStyleDetails(demoAuthor);
    updateProject({
      authorId: demoAuthor,
      writingType: "Newsletter",
      channel: "Email",
      language: "English",
      lengthTarget: "Medium",
      tone: "Warm",
      avoid: "Avoid corporate language. Keep the sentences natural.",
      brief: demoGoal,
    });
    setWritingGoal(demoGoal);
    setQuickDirectives(["More emotional", "Simpler English", "Add examples"]);
    setAdvancedOpen(false);
    toast("Demo filled", "success");
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectedRange(null);
      return;
    }
    const rawText = selection.toString();
    const text = rawText.trim();
    if (!text) {
      setSelectedRange(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE ? (range.startContainer as Element) : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE ? (range.endContainer as Element) : range.endContainer.parentElement;
    const startBlock = startElement?.closest<HTMLElement>("[data-block-id]");
    const endBlock = endElement?.closest<HTMLElement>("[data-block-id]");
    if (!startBlock || !endBlock || startBlock !== endBlock || !documentRef.current?.contains(startBlock)) {
      setSelectedRange(null);
      return;
    }
    const preStart = document.createRange();
    preStart.selectNodeContents(startBlock);
    preStart.setEnd(range.startContainer, range.startOffset);
    const preEnd = document.createRange();
    preEnd.selectNodeContents(startBlock);
    preEnd.setEnd(range.endContainer, range.endOffset);
    const rect = range.getBoundingClientRect();
    const rects = Array.from(range.getClientRects())
      .filter((item) => item.width > 2 && item.height > 2)
      .map(viewportRect);
    setSelectedRange({
      blockId: startBlock.dataset.blockId || "",
      start: preStart.toString().length,
      end: preEnd.toString().length,
      text,
      source: "native",
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      rects,
    });
  };

  const selectSentenceFromClick = (blockId: string, blockElement: HTMLElement, clientX: number, clientY: number) => {
    const blockText = blockElement.innerText;
    if (!blockText.trim()) return;
    const offset = textOffsetFromPoint(blockElement, clientX, clientY);
    const bounds = sentenceBoundsAt(blockText, offset);
    if (!bounds) return;
    suppressSelectionCaptureRef.current = true;
    window.getSelection()?.removeAllRanges();
    window.setTimeout(() => {
      suppressSelectionCaptureRef.current = false;
    }, 220);
    setSelectedRange({
      blockId,
      start: bounds.start,
      end: bounds.end,
      text: bounds.text.trim(),
      source: "sentence",
    });
  };

  useEffect(() => {
    let timer = 0;
    const handleSelectionChange = () => {
      if (suppressSelectionCaptureRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(captureSelection, 90);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  });

  const openRevision = (action: string, instruction = "") => {
    if (!selectedRange) {
      toast("Select text first", "warning");
      return;
    }
    setRevision({ open: true, action, instruction, original: selectedRange.text, suggestion: "", loading: false, range: selectedRange });
  };

  const generateRevision = async (state = revision) => {
    if (!state.range || !project.draft) return;
    const liveDraft = syncDraftFromEditor(project.draft) ?? project.draft;
    const liveProject = { ...project, draft: liveDraft };
    const instruction = state.instruction.trim() || state.action || "Improve this selected text";
    setRevision((current) => ({ ...current, loading: true, suggestion: "" }));
    const traceId = startLlmTrace("rewriteSelectedRange", `${instruction} · ${state.original.slice(0, 120)}`);
    try {
      const result = await llmService.rewriteSelectedRange(liveProject, currentAuthor, state.original, instruction);
      finishLlmTrace(traceId, `${llmService.getProviderLabel()} · selected suggestion`);
      setRevision((current) => ({ ...current, loading: false, suggestion: result.replacement_text }));
    } catch (error) {
      finishLlmTrace(traceId, error instanceof Error ? error.message : "Revision failed.", "error");
      setRevision((current) => ({ ...current, loading: false }));
      toast("Revision failed", "warning");
    }
  };

  const replaceSelectedText = () => {
    if (!project.draft || !revision.range || !revision.suggestion.trim()) return;
    const before = cloneDraft(project.draft);
    const after = replaceDraftTextRange(before, revision.range, revision.suggestion.trim());
    const edit = makeHistory("selected_rewrite", before, after, revision.instruction || revision.action);
    updateProject({ draft: after, versions: [edit, ...project.versions] });
    setRevision({ open: false, action: "", instruction: "", original: "", suggestion: "", loading: false, range: null });
    setSelectedRange(null);
    setIsModified(true);
    toast("Replaced selected text", "success");
  };

  const insertSuggestionBelow = () => {
    if (!project.draft || !revision.range || !revision.suggestion.trim()) return;
    const before = cloneDraft(project.draft);
    const after = insertDraftTextBelowRange(before, revision.range, revision.suggestion.trim());
    const edit = makeHistory("selected_rewrite", before, after, `Insert below: ${revision.instruction || revision.action}`);
    updateProject({ draft: after, versions: [edit, ...project.versions] });
    setRevision({ open: false, action: "", instruction: "", original: "", suggestion: "", loading: false, range: null });
    setSelectedRange(null);
    setIsModified(true);
    toast("Inserted suggestion", "success");
  };

  const runAssistant = async (instruction: string) => {
    if (!project.draft) {
      toast("Create a draft first", "warning");
      return;
    }
    const finalInstruction = instruction.trim();
    if (!finalInstruction) return;
    const liveDraft = syncDraftFromEditor(project.draft) ?? project.draft;
    const liveProject = { ...project, draft: liveDraft };
    setProject(liveProject);
    setAssistantInput("");

    if (selectedRange) {
      const nextState: RevisionState = { open: true, action: finalInstruction, instruction: finalInstruction, original: selectedRange.text, suggestion: "", loading: true, range: selectedRange };
      setRevision(nextState);
      await generateRevision(nextState);
      return;
    }

    setBusy(true);
    const traceId = startLlmTrace("assistant.refineDraft", finalInstruction);
    try {
      const next = await llmService.refineWholeDraft(liveProject, currentAuthor, finalInstruction);
      finishLlmTrace(traceId, `${llmService.getProviderLabel()} · preview ready`);
      setAssistantSuggestion({ instruction: finalInstruction, before: liveDraft, draft: { ...next, id: liveDraft.id, version: liveDraft.version + 1 } });
      toast("Preview ready", "success");
    } catch (error) {
      finishLlmTrace(traceId, error instanceof Error ? error.message : "Assistant failed.", "error");
      toast("Assistant failed", "warning");
    } finally {
      setBusy(false);
    }
  };

  const applyAssistantSuggestion = () => {
    if (!assistantSuggestion || !project.draft) return;
    const before = cloneDraft(project.draft);
    const edit = makeHistory("full_rewrite", before, assistantSuggestion.draft, assistantSuggestion.instruction);
    updateProject({ draft: assistantSuggestion.draft, versions: [edit, ...project.versions] });
    setAssistantSuggestion(null);
    setIsModified(true);
    toast("Draft updated", "success");
  };

  const undoLastEdit = () => {
    const [lastEdit, ...remaining] = project.versions;
    if (!lastEdit) {
      toast("No edits to undo", "warning");
      return;
    }
    updateProject({ draft: lastEdit.before, versions: remaining });
    setAssistantSuggestion(null);
    setRevision({ open: false, action: "", instruction: "", original: "", suggestion: "", loading: false, range: null });
    setSelectedRange(null);
    setIsModified(true);
    toast("Last AI edit undone", "success");
  };

  const createAuthor = () => {
    const author = createBlankAuthor();
    setAuthors((items) => [...items, author]);
    setSelectedStyleDetails(author.id);
    setStyleEditOpen(true);
  };

  const deleteAuthor = (authorId: string) => {
    setAuthors((items) => items.filter((author) => author.id !== authorId));
    if (currentAuthorId === authorId) setAuthor(null);
    setSelectedStyleDetails(null);
    toast("Style deleted", "warning");
  };

  const addSampleToStyle = () => {
    if (!selectedStyle || !sampleDraft.content.trim()) return;
    saveAuthor({ ...selectedStyle, samples: [...selectedStyle.samples, makeSample(sampleDraft.title, sampleDraft.content, sampleDraft.sourceType)], updatedAt: now() });
    setSampleDraft({ title: "", content: "", sourceType: "essay" });
    toast("Sample added", "success");
  };

  const analyzeAuthor = async (author: Author) => {
    if (!author.samples.length) {
      toast("Add a sample first", "warning");
      return;
    }
    setBusy(true);
    const traceId = startLlmTrace("generateAuthorSkill", `${author.name} · ${author.samples.length} samples`);
    try {
      const result = await llmService.generateAuthorSkill(author, author.samples);
      finishLlmTrace(traceId, `${llmService.getProviderLabel()} · style updated`);
      saveAuthor({
        ...author,
        styleSummary: result.style_summary,
        skillPrompt: result.skill_prompt,
        parameters: {
          ...author.parameters,
          structureHabits: result.structure_habits,
          voiceTone: result.voice.split(",").map((item) => item.trim()).filter(Boolean),
          sentenceRhythm: result.sentence_rhythm,
          openingPatterns: result.opening_patterns,
          transitionPatterns: result.transition_patterns,
          emotionCurve: result.emotion_curve,
          detailDensity: result.detail_density,
          dialogueTendency: result.dialogue_style,
          imageryMetaphorTendency: result.imagery_and_metaphor,
          pacingStyle: result.pacing,
          avoidList: result.avoid,
          recommendedRules: result.recommended_rules,
        },
        updatedAt: now(),
      });
      toast("Style analyzed", "success");
    } catch (error) {
      finishLlmTrace(traceId, error instanceof Error ? error.message : "Style analysis failed.", "error");
      toast("Style analysis failed", "warning");
    } finally {
      setBusy(false);
    }
  };

  const exportCurrentFormat = async () => {
    if (!project.draft) return;
    const liveDraft = syncDraftFromEditor(project.draft) ?? project.draft;
    const settings = {
      ...defaultPublishSettings,
      ...project.publishSettings,
      documentTitle: liveDraft.title,
      format: exportFormat === "Plain text" || ["LinkedIn post", "Xiaohongshu post", "Email draft"].includes(exportFormat) ? "TXT" : exportFormat === "Markdown" ? "Markdown" : "HTML",
    } as typeof project.publishSettings;
    setProject((current) => ({ ...current, draft: liveDraft, publishSettings: settings, updatedAt: now() }));
    const file = await buildExportFile(liveDraft, settings, project.requirementCards, exportFormat);
    const saved = await saveExportFile(file);
    if (saved.status === "canceled") {
      toast("Export canceled", "info");
      return;
    }
    const copyText = file.encoding === "base64" ? [liveDraft.title, "", draftBlockTexts(liveDraft).join("\n\n")].join("\n\n") : file.content;
    setLastExport({
      filename: file.filename,
      format: exportFormat,
      status: saved.status,
      locationLabel: saved.locationLabel,
      detail: saved.detail,
      copyText,
      savedAt: now(),
    });
    setExportOpen(false);
    setIsModified(false);
    toast(saved.status === "saved" ? `Saved: ${file.filename}` : `Download started: ${file.filename}`, "success");
  };

  const openExportModal = () => setExportOpen(true);

  return (
    <>
      <Background />
      <main className="app-shell">
        <section className="app-window app-window-light" aria-label="AnnaWrite workspace">
          <header className="minimal-header">
            <button className="app-lockup" onClick={() => setScreen("home")}>
              <span className="app-icon"><PenLine size={18} /></span>
              <span>
                <strong>AnnaWrite</strong>
                <small>{currentAuthor?.name ?? "Default Style"}</small>
              </span>
            </button>
            <nav className="minimal-nav">
              <span className={`llm-status-pill ${llmStatusTone}`}>{llmStatusLabel}</span>
              <button className={`btn ${screen === "styles" ? "btn-ghost" : "btn-secondary"}`} onClick={() => {
                setStyleEditOpen(false);
                setScreen("styles");
              }}>
                <Library size={14} />
                Styles
              </button>
              <button className="btn btn-secondary" onClick={newWriting}>
                <Plus size={14} />
                New
              </button>
              {!hasDraft ? (
                <button className="btn btn-primary" onClick={generateDraftFromGoal} disabled={busy}>
                  <Sparkles size={14} />
                  Generate
                </button>
              ) : null}
            </nav>
          </header>

          <div className="workspace-body">
            {busy ? (
              <div className="busy veil">
                <Loader2 className="animate-spin text-violet" size={28} />
                <strong>Working...</strong>
              </div>
            ) : null}

            {screen === "styles" ? (
              <StylePicker
                authors={authors}
                currentAuthorId={currentAuthorId}
                selectedStyle={selectedStyle}
                styleEditOpen={styleEditOpen}
                sampleDraft={sampleDraft}
                onSetAuthor={setAuthor}
                onSelectDetails={setSelectedStyleDetails}
                onCreateAuthor={createAuthor}
                onDeleteAuthor={deleteAuthor}
                onSaveAuthor={saveAuthor}
                onAnalyzeAuthor={analyzeAuthor}
                onSetStyleEditOpen={setStyleEditOpen}
                onSampleDraftChange={setSampleDraft}
                onAddSample={addSampleToStyle}
                onOpenSample={setSampleViewer}
                onStartWriting={() => setScreen("home")}
              />
            ) : screen === "editor" && draft ? (
              <EditorScreen
                project={project}
                currentAuthor={currentAuthor}
                selectedRange={selectedRange}
                documentRef={documentRef}
                isModified={isModified}
                exportFormat={exportFormat}
                lastExport={lastExport}
                canUndo={project.versions.length > 0}
                lastEditType={project.versions[0]?.type}
                assistantOpen={assistantOpen}
                assistantInput={assistantInput}
                assistantSuggestion={assistantSuggestion}
                onTitleChange={updateDraftTitle}
                onBlockBlur={updateBlockFromEditor}
                onCaptureSelection={captureSelection}
                onSelectSentenceFromClick={selectSentenceFromClick}
                onOpenRevision={openRevision}
                onClearSelection={() => setSelectedRange(null)}
                onUndoLastEdit={undoLastEdit}
                onExportCurrentFormat={exportCurrentFormat}
                onExportFormatChange={setExportFormat}
                onAssistantOpenChange={setAssistantOpen}
                onAssistantInputChange={setAssistantInput}
                onRunAssistant={runAssistant}
                onApplyAssistant={applyAssistantSuggestion}
                onCancelAssistant={() => setAssistantSuggestion(null)}
                onBackHome={() => setScreen("home")}
              />
            ) : (
              <HomeScreen
                authors={authors}
                currentAuthor={currentAuthor}
                currentAuthorId={currentAuthorId}
                writingGoal={writingGoal}
                quickDirectives={quickDirectives}
                advancedOpen={advancedOpen}
                project={project}
                hasDraft={hasDraft}
                onSetAuthor={setAuthor}
                onOpenStyles={() => setScreen("styles")}
                onGoalChange={setWritingGoal}
                onToggleDirective={(chip) => setQuickDirectives((items) => (items.includes(chip) ? items.filter((item) => item !== chip) : [...items, chip]))}
                onAdvancedOpenChange={setAdvancedOpen}
                onProjectChange={updateProject}
                onDemo={fillDemo}
                onGenerate={generateDraftFromGoal}
                onBlank={startBlankDraft}
                onContinue={() => setScreen("editor")}
              />
            )}

            <LlmTracePanel traces={llmTraces} activeTrace={activeTrace} />
            <ToastStack messages={toasts} />
          </div>
        </section>
      </main>

      {revision.open ? (
        <RevisionModal
          revision={revision}
          onChange={(patch) => setRevision((current) => ({ ...current, ...patch }))}
          onGenerate={() => generateRevision()}
          onReplace={replaceSelectedText}
          onInsertBelow={insertSuggestionBelow}
          onClose={() => setRevision({ open: false, action: "", instruction: "", original: "", suggestion: "", loading: false, range: null })}
        />
      ) : null}

      {exportOpen ? (
        <ExportFormatModal
          format={exportFormat}
          onFormatChange={setExportFormat}
          onClose={() => setExportOpen(false)}
          onConfirm={exportCurrentFormat}
        />
      ) : null}

      {sampleViewer ? <SampleModal sample={sampleViewer} onClose={() => setSampleViewer(null)} /> : null}
    </>
  );
}

function HomeScreen({
  authors,
  currentAuthor,
  currentAuthorId,
  writingGoal,
  quickDirectives,
  advancedOpen,
  project,
  hasDraft,
  onSetAuthor,
  onOpenStyles,
  onGoalChange,
  onToggleDirective,
  onAdvancedOpenChange,
  onProjectChange,
  onDemo,
  onGenerate,
  onBlank,
  onContinue,
}: {
  authors: Author[];
  currentAuthor: Author | null;
  currentAuthorId: string | null;
  writingGoal: string;
  quickDirectives: string[];
  advancedOpen: boolean;
  project: WritingProject;
  hasDraft: boolean;
  onSetAuthor: (id: string | null) => void;
  onOpenStyles: () => void;
  onGoalChange: (value: string) => void;
  onToggleDirective: (chip: string) => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onProjectChange: (patch: Partial<WritingProject>) => void;
  onDemo: () => void;
  onGenerate: () => void;
  onBlank: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="home-screen page-scroll">
      <section className="home-hero">
        <div>
          <span className="eyebrow">Style</span>
          <h1>Choose a style. Start writing.</h1>
        </div>
        <div className="style-row">
          <button className={`style-pill ${currentAuthorId === null ? "active" : ""}`} onClick={() => onSetAuthor(null)}>
            <strong>Default</strong>
            <small>Clear / simple</small>
          </button>
          {visibleStyleAuthors(authors).slice(0, 3).map((author) => (
            <button className={`style-pill ${currentAuthorId === author.id ? "active" : ""}`} key={author.id} onClick={() => onSetAuthor(author.id)}>
              <strong>{author.name}</strong>
              <small>{styleTags(author).slice(0, 2).join(" / ")}</small>
            </button>
          ))}
          <button className="style-pill more" onClick={onOpenStyles}>
            <Library size={15} />
            More styles
          </button>
        </div>
      </section>

      <section className="writing-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="eyebrow">Goal</span>
            <h2>What do you want to write?</h2>
          </div>
          {hasDraft ? (
            <button className="btn btn-secondary" onClick={onContinue}>
              <FileText size={14} />
              Recent draft
            </button>
          ) : null}
        </div>
        <textarea
          className="goal-input"
          value={writingGoal}
          onChange={(event) => onGoalChange(event.target.value)}
          placeholder="Write a short reflective essay about loneliness in the city."
        />
        <div className="quick-chip-row">
          {quickChips.map((chip) => (
            <button className={`chip ${quickDirectives.includes(chip) ? "active" : ""}`} key={chip} onClick={() => onToggleDirective(chip)}>
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button className="advanced-toggle" onClick={() => onAdvancedOpenChange(!advancedOpen)}>
            Optional settings
            <ChevronDown size={15} className={advancedOpen ? "rotate-180 transition" : "transition"} />
          </button>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onDemo}><Wand2 size={14} />Demo</button>
            <button className="btn btn-secondary" onClick={onBlank}>Start blank</button>
            <button className="btn btn-primary" onClick={onGenerate}>
              <Sparkles size={14} />
              Generate draft
            </button>
          </div>
        </div>
        {advancedOpen ? (
          <div className="advanced-grid">
            <label><span className="field-label">Length</span><select className="field-input" value={project.lengthTarget} onChange={(event) => onProjectChange({ lengthTarget: event.target.value })}><option>Short</option><option>Medium</option><option>Long</option></select></label>
            <label><span className="field-label">Language</span><select className="field-input" value={project.language} onChange={(event) => onProjectChange({ language: event.target.value })}><option>English</option><option>Chinese</option><option>Bilingual</option></select></label>
            <label><span className="field-label">Type</span><select className="field-input" value={project.writingType} onChange={(event) => onProjectChange({ writingType: event.target.value })}><option>Article</option><option>Essay</option><option>Story</option><option>Newsletter</option><option>Blog</option><option>LinkedIn post</option></select></label>
            <label><span className="field-label">Extra constraints</span><input className="field-input" value={project.avoid} onChange={(event) => onProjectChange({ avoid: event.target.value })} placeholder="No hype, simple English..." /></label>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StylePicker({
  authors,
  currentAuthorId,
  selectedStyle,
  styleEditOpen,
  sampleDraft,
  onSetAuthor,
  onSelectDetails,
  onCreateAuthor,
  onDeleteAuthor,
  onSaveAuthor,
  onAnalyzeAuthor,
  onSetStyleEditOpen,
  onSampleDraftChange,
  onAddSample,
  onOpenSample,
  onStartWriting,
}: {
  authors: Author[];
  currentAuthorId: string | null;
  selectedStyle: Author | null;
  styleEditOpen: boolean;
  sampleDraft: { title: string; content: string; sourceType: SourceType };
  onSetAuthor: (id: string | null) => void;
  onSelectDetails: (id: string | null) => void;
  onCreateAuthor: () => void;
  onDeleteAuthor: (id: string) => void;
  onSaveAuthor: (author: Author) => void;
  onAnalyzeAuthor: (author: Author) => void;
  onSetStyleEditOpen: (open: boolean) => void;
  onSampleDraftChange: (draft: { title: string; content: string; sourceType: SourceType }) => void;
  onAddSample: () => void;
  onOpenSample: (sample: AuthorSample) => void;
  onStartWriting: () => void;
}) {
  const shownAuthors = visibleStyleAuthors(authors);

  return (
    <div className="page-scroll style-screen">
      <div className="section-head">
        <div>
          <span className="eyebrow">Styles</span>
          <h1>Choose a style</h1>
          <p>Pick one voice, then start writing.</p>
        </div>
        <button className="btn btn-secondary" onClick={onCreateAuthor}><Plus size={14} />New</button>
      </div>
      <div className="style-layout">
        <div className="style-card-grid">
          <AuthorStyleCard author={null} active={currentAuthorId === null} onUse={() => onSetAuthor(null)} onView={() => onSelectDetails(null)} />
          {shownAuthors.map((author) => (
            <AuthorStyleCard
              key={author.id}
              author={author}
              active={currentAuthorId === author.id}
              onUse={() => onSetAuthor(author.id)}
              onView={() => onSelectDetails(author.id)}
              onEdit={() => {
                onSelectDetails(author.id);
                onSetStyleEditOpen(true);
              }}
            />
          ))}
        </div>
        <aside className="style-detail">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2>{selectedStyle?.name ?? "Default Style"}</h2>
              <p>{selectedStyle?.description ?? "Clean, simple writing for most drafts."}</p>
            </div>
            {selectedStyle ? <button className="icon-button" onClick={() => onSetStyleEditOpen(!styleEditOpen)} aria-label="Edit style"><Edit3 size={15} /></button> : null}
          </div>
          <div className="mt-4 grid gap-2">
            {styleSummaryBullets(selectedStyle).map((item) => <div className="mini-bullet" key={item}>{item}</div>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {styleTags(selectedStyle).map((tag) => <span className="chip active" key={tag}>{tag}</span>)}
          </div>
          <button className="btn btn-primary mt-5 w-full" onClick={() => {
            onSetAuthor(selectedStyle?.id ?? null);
            onStartWriting();
          }}>
            <Check size={14} />
            Use this style and start writing
          </button>
          {selectedStyle ? (
            <>
              <div className="mt-5">
                <h3 className="detail-title">Sample texts</h3>
                <div className="mt-2 grid gap-2">
                  {selectedStyle.samples.slice(0, 4).map((sample) => (
                    <button className="sample-link" key={sample.id} onClick={() => onOpenSample(sample)}>
                      <BookOpen size={14} />
                      {sample.title}
                    </button>
                  ))}
                  {!selectedStyle.samples.length ? <p className="tiny-muted">No samples yet.</p> : null}
                </div>
              </div>
              {!styleEditOpen ? (
                <button className="btn btn-secondary mt-4 w-full" onClick={() => onSetStyleEditOpen(true)}>
                  <Edit3 size={14} />
                  Edit style
                </button>
              ) : null}
              {styleEditOpen ? (
                <div className="style-edit">
                  <h3>Edit style</h3>
                  <input className="field-input" value={selectedStyle.name} onChange={(event) => onSaveAuthor({ ...selectedStyle, name: event.target.value, updatedAt: now() })} />
                  <textarea className="field-input min-h-[70px]" value={selectedStyle.description} onChange={(event) => onSaveAuthor({ ...selectedStyle, description: event.target.value, updatedAt: now() })} />
                  <input className="field-input" value={sampleDraft.title} onChange={(event) => onSampleDraftChange({ ...sampleDraft, title: event.target.value })} placeholder="Sample title" />
                  <textarea className="field-input min-h-[92px]" value={sampleDraft.content} onChange={(event) => onSampleDraftChange({ ...sampleDraft, content: event.target.value })} placeholder="Paste a sample..." />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-secondary" onClick={onAddSample}>Add sample</button>
                    <button className="btn btn-ghost" onClick={() => onAnalyzeAuthor(selectedStyle)}><Sparkles size={14} />Analyze</button>
                    <button className="btn btn-danger" onClick={() => onDeleteAuthor(selectedStyle.id)}>Delete</button>
                    <button className="btn btn-secondary" onClick={() => onSetStyleEditOpen(false)}>Done</button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function AuthorStyleCard({ author, active, onUse, onView, onEdit }: { author: Author | null; active: boolean; onUse: () => void; onView: () => void; onEdit?: () => void }) {
  return (
    <article className={`author-style-card ${active ? "active" : ""}`}>
      {onEdit ? <button className="card-edit" onClick={onEdit} aria-label="Edit style"><Edit3 size={14} /></button> : null}
      <h3>{author?.name ?? "Default Style"}</h3>
      <p>{author?.description ?? "Clear, natural writing for quick drafts."}</p>
      <div className="tag-row">{styleTags(author).map((tag) => <span key={tag}>{tag}</span>)}</div>
      <div className="card-actions">
        <button className="btn btn-primary" onClick={onUse}>Use this style</button>
        <button className="btn btn-secondary" onClick={onView}>View samples</button>
      </div>
    </article>
  );
}

function EditorScreen({
  project,
  currentAuthor,
  selectedRange,
  documentRef,
  isModified,
  exportFormat,
  lastExport,
  canUndo,
  lastEditType,
  assistantOpen,
  assistantInput,
  assistantSuggestion,
  onTitleChange,
  onBlockBlur,
  onCaptureSelection,
  onSelectSentenceFromClick,
  onOpenRevision,
  onClearSelection,
  onUndoLastEdit,
  onExportCurrentFormat,
  onExportFormatChange,
  onAssistantOpenChange,
  onAssistantInputChange,
  onRunAssistant,
  onApplyAssistant,
  onCancelAssistant,
  onBackHome,
}: {
  project: WritingProject;
  currentAuthor: Author | null;
  selectedRange: TextSelectionRange | null;
  documentRef: React.RefObject<HTMLDivElement | null>;
  isModified: boolean;
  exportFormat: ExportFormat;
  lastExport: ExportReceipt | null;
  canUndo: boolean;
  lastEditType?: EditHistory["type"];
  assistantOpen: boolean;
  assistantInput: string;
  assistantSuggestion: AssistantSuggestion | null;
  onTitleChange: (title: string) => void;
  onBlockBlur: (blockId: string, text: string) => void;
  onCaptureSelection: () => void;
  onSelectSentenceFromClick: (blockId: string, blockElement: HTMLElement, clientX: number, clientY: number) => void;
  onOpenRevision: (action: string, instruction?: string) => void;
  onClearSelection: () => void;
  onUndoLastEdit: () => void;
  onExportCurrentFormat: () => void;
  onExportFormatChange: (format: ExportFormat) => void;
  onAssistantOpenChange: (open: boolean) => void;
  onAssistantInputChange: (value: string) => void;
  onRunAssistant: (instruction: string) => void;
  onApplyAssistant: () => void;
  onCancelAssistant: () => void;
  onBackHome: () => void;
}) {
  const draft = project.draft;
  const clickTimerRef = useRef<number | null>(null);
  if (!draft) return null;

  const queueSentenceSelection = (blockId: string, element: HTMLElement, clientX: number, clientY: number) => {
    if ((window.getSelection()?.toString() ?? "").trim()) return;
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      onSelectSentenceFromClick(blockId, element, clientX, clientY);
      clickTimerRef.current = null;
    }, 260);
  };

  const cancelSentenceSelection = () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
    window.setTimeout(onCaptureSelection, 60);
  };

  return (
    <div className="editor-shell">
      <div className="editor-topbar">
        <button className="btn btn-secondary" onClick={onBackHome}>Home</button>
        <div className="editor-title-meta">
          <strong>{currentAuthor?.name ?? "Default Style"}</strong>
          <span>{isModified ? "Modified" : "Saved locally"}</span>
        </div>
        <button className="btn btn-secondary" onClick={onUndoLastEdit} disabled={!canUndo}>
          <Undo2 size={14} />
          Undo AI edit
        </button>
      </div>
      <div className="editor-grid">
        <main className="doc-canvas" onMouseUp={onCaptureSelection} onKeyUp={onCaptureSelection}>
          <article className="word-page" ref={documentRef}>
            <input className="doc-title" value={draft.title} onChange={(event) => onTitleChange(event.target.value)} />
            <div className="doc-meta">{currentAuthor?.name ?? "Default Style"} · {project.language || "English"}</div>
            {draft.blocks.map((block) => (
              <p
                key={block.id}
                data-block-id={block.id}
                className="doc-paragraph"
                contentEditable
                suppressContentEditableWarning
                onClick={(event) => {
                  if (event.detail > 1) return;
                  queueSentenceSelection(block.id, event.currentTarget, event.clientX, event.clientY);
                }}
                onDoubleClick={(event) => {
                  cancelSentenceSelection();
                  window.setTimeout(onCaptureSelection, 80);
                }}
                onBlur={(event) => onBlockBlur(block.id, event.currentTarget.innerText)}
              >
                {renderParagraphText(block, selectedRange)}
              </p>
            ))}
          </article>
          {selectedRange ? (
            <SelectionToolbar range={selectedRange} onOpenRevision={onOpenRevision} onClear={onClearSelection} />
          ) : null}
        </main>
        <aside className="editor-sidebar">
          <div className="sidebar-card">
            <h3>Output</h3>
            <select className="field-input" value={exportFormat} onChange={(event) => onExportFormatChange(event.target.value as ExportFormat)}>
              {exportFormats.map((format) => <option key={format}>{format}</option>)}
            </select>
            <button className="btn btn-primary w-full" onClick={onExportCurrentFormat}><Download size={14} />Save / Download {exportFormat}</button>
            <p className="tiny-muted">Choose a save location when prompted. Otherwise check browser Downloads.</p>
          </div>
          {lastExport ? <ExportReceiptCard receipt={lastExport} onDownloadAgain={onExportCurrentFormat} /> : null}
          <div className="sidebar-card">
            <h3>Document</h3>
            <div className="info-row"><span>Words</span><strong>{countWords(draftPlainText(draft))}</strong></div>
            <div className="info-row"><span>Version</span><strong>v{draft.version}</strong></div>
            <div className="info-row"><span>Style</span><strong>{currentAuthor?.name ?? "Default"}</strong></div>
            {canUndo ? <div className="info-row"><span>Last AI edit</span><strong>{lastEditType === "full_rewrite" ? "Full draft" : "Selected text"}</strong></div> : null}
          </div>
          <details className="sidebar-card">
            <summary>Format options</summary>
            <p className="tiny-muted mt-3">Clean document defaults are applied. More controls can stay hidden until needed.</p>
          </details>
        </aside>
      </div>
      <FloatingAIAssistant
        open={assistantOpen}
        input={assistantInput}
        suggestion={assistantSuggestion}
        selectedText={selectedRange?.text}
        onOpenChange={onAssistantOpenChange}
        onInputChange={onAssistantInputChange}
        onRun={onRunAssistant}
        onApply={onApplyAssistant}
        onCancel={onCancelAssistant}
      />
    </div>
  );
}

function renderParagraphText(block: DraftBlock, selectedRange: TextSelectionRange | null) {
  const text = block.sentences.map((sentence) => sentence.text).join(" ");
  if (selectedRange?.source !== "sentence" || selectedRange.blockId !== block.id) return text;

  const start = Math.max(0, Math.min(selectedRange.start, text.length));
  const end = Math.max(start, Math.min(selectedRange.end, text.length));
  if (start === end) return text;

  return (
    <>
      {text.slice(0, start)}
      <span className="selected-sentence-inline">{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}

function ExportReceiptCard({ receipt, onDownloadAgain }: { receipt: ExportReceipt; onDownloadAgain: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(receipt.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="sidebar-card export-receipt">
      <span className="eyebrow">Exported</span>
      <strong>{receipt.filename}</strong>
      <div className="info-row"><span>Format</span><strong>{receipt.format}</strong></div>
      <div className="info-row"><span>Method</span><strong>{receipt.status === "saved" ? "Saved" : "Downloaded"}</strong></div>
      <p><b>{receipt.locationLabel}</b><br />{receipt.detail}</p>
      <button className="btn btn-secondary w-full" onClick={copyText}>
        <Clipboard size={14} />
        {copied ? "Copied text" : "Copy text"}
      </button>
      <button className="btn btn-secondary w-full" onClick={onDownloadAgain}>
        <Download size={14} />
        Download again
      </button>
    </div>
  );
}

function SelectionToolbar({ range, onOpenRevision, onClear }: { range: TextSelectionRange; onOpenRevision: (action: string, instruction?: string) => void; onClear: () => void }) {
  return (
    <div className="selection-toolbar">
      <button onClick={() => onOpenRevision("Rewrite")}>Rewrite</button>
      <button onClick={() => onOpenRevision("Shorten selected")}>Shorten</button>
      <button onClick={() => onOpenRevision("Expand selected")}>Expand</button>
      <button onClick={() => onOpenRevision("Improve")}>Improve</button>
      <button onClick={() => onOpenRevision("Change tone")}>Tone</button>
      <button className="icon-mini" onClick={onClear}><X size={13} /></button>
    </div>
  );
}

function FloatingAIAssistant({ open, input, suggestion, selectedText, onOpenChange, onInputChange, onRun, onApply, onCancel }: {
  open: boolean;
  input: string;
  suggestion: AssistantSuggestion | null;
  selectedText?: string;
  onOpenChange: (open: boolean) => void;
  onInputChange: (value: string) => void;
  onRun: (instruction: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return (
      <button className="assistant-fab" onClick={() => onOpenChange(true)}>
        <MessageCircle size={18} />
        AI Assistant
      </button>
    );
  }
  return (
    <section className="assistant-panel">
      <div className="assistant-head">
        <strong>AI Assistant</strong>
        <button className="icon-button" onClick={() => onOpenChange(false)}><X size={14} /></button>
      </div>
      {selectedText ? <div className="selected-note">Selected: {selectedText.slice(0, 90)}{selectedText.length > 90 ? "..." : ""}</div> : null}
      <div className="assistant-presets">
        {assistantPresets.map((preset) => <button key={preset} onClick={() => onRun(preset)}>{preset}</button>)}
      </div>
      {suggestion ? (
        <div className="assistant-preview">
          <span className="eyebrow">Diff preview</span>
          <strong>{suggestion.draft.title}</strong>
          <DraftDiffPreview before={suggestion.before} after={suggestion.draft} />
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={onApply}>Apply changes</button>
            <button className="btn btn-secondary" onClick={() => onRun(suggestion.instruction)}><RefreshCw size={14} />Regenerate</button>
            <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      ) : null}
      <form className="assistant-input" onSubmit={(event) => {
        event.preventDefault();
        onRun(input);
      }}>
        <input value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="Ask AI to revise this draft..." />
        <button type="submit"><Send size={15} /></button>
      </form>
    </section>
  );
}

function DraftDiffPreview({ before, after }: { before: Draft; after: Draft }) {
  const changes = draftDiffItems(before, after);
  if (!changes.length) return <p>No visible text changes. Try regenerating with a stronger instruction.</p>;
  return (
    <div className="draft-diff">
      {changes.slice(0, 3).map((change) => (
        <article key={change.label}>
          <span>{change.label}</span>
          <div className="diff-before">{change.before || "Empty"}</div>
          <div className="diff-after">{change.after || "Empty"}</div>
        </article>
      ))}
      {changes.length > 3 ? <small>+ {changes.length - 3} more changed sections</small> : null}
    </div>
  );
}

function RevisionModal({ revision, onChange, onGenerate, onReplace, onInsertBelow, onClose }: {
  revision: RevisionState;
  onChange: (patch: Partial<RevisionState>) => void;
  onGenerate: () => void;
  onReplace: () => void;
  onInsertBelow: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop revision-backdrop">
      <section className="revision-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Revise</span>
            <h2>{revision.action || "Selected text"}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="compare-grid">
          <div><span>Original</span><p>{revision.original}</p></div>
          <div>
            <span>{revision.suggestion ? "AI Suggestion · preview" : "AI Suggestion"}</span>
            <p>{revision.loading ? "Generating..." : revision.suggestion || "Generate a suggestion first."}</p>
          </div>
        </div>
        <textarea className="field-input" value={revision.instruction} onChange={(event) => onChange({ instruction: event.target.value })} placeholder="How should AI revise this sentence?" />
        <div className="quick-chip-row">
          {revisionPresets.map((preset) => <button className="chip" key={preset} onClick={() => onChange({ instruction: preset })}>{preset}</button>)}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={onGenerate} disabled={revision.loading}>{revision.suggestion ? "Try again" : "Generate"}</button>
          <button className="btn btn-secondary" onClick={onInsertBelow} disabled={!revision.suggestion}>Insert below</button>
          <button className="btn btn-primary" onClick={onReplace} disabled={!revision.suggestion}>Replace selected text</button>
        </div>
      </section>
    </div>
  );
}

function ExportFormatModal({ format, onFormatChange, onClose, onConfirm }: { format: ExportFormat; onFormatChange: (format: ExportFormat) => void; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="export-modal">
        <div className="modal-head">
          <div><span className="eyebrow">Export</span><h2>Choose format</h2></div>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="export-grid">
          {exportFormats.map((item) => (
            <button className={format === item ? "active" : ""} key={item} onClick={() => onFormatChange(item)}>
              <FileText size={18} />
              {item}
            </button>
          ))}
        </div>
        <p className="export-path">AnnaWrite will open a save dialog when the host allows it. If not, the file is sent to the browser download flow.</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Save / Download</button>
        </div>
      </section>
    </div>
  );
}

function SampleModal({ sample, onClose }: { sample: AuthorSample; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="sample-modal">
        <div className="modal-head">
          <div><span className="eyebrow">{sample.sourceType}</span><h2>{sample.title}</h2></div>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <pre>{sample.content}</pre>
      </section>
    </div>
  );
}
