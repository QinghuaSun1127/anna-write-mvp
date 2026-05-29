import type { Draft, PublishSettings, RequirementCard } from "../types";
import { draftPlainText, draftToMarkdown } from "./draft";

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "annawrite-draft";
}

export function buildExportContent(draft: Draft, settings: PublishSettings, cards: RequirementCard[]) {
  const lines: string[] = [];
  if (settings.includeMetadata) {
    lines.push(`Author: ${settings.authorNameDisplay || "Not shown"}`);
    lines.push(`Date: ${settings.dateDisplay}`);
    if (settings.includeVersionNumber) lines.push(`Draft version: ${draft.version}`);
    lines.push("");
  }
  if (settings.subtitle) {
    lines.push(settings.subtitle);
    lines.push("");
  }
  if (settings.includeRequirementSummary) {
    lines.push("Requirement summary");
    cards.slice(0, 8).forEach((card) => lines.push(`- ${card.title}: ${card.content}`));
    lines.push("");
  }
  if (settings.includeAuthorStyleNote) {
    lines.push("Author/style note included in workspace metadata.");
    lines.push("");
  }
  lines.push(draftPlainText(draft));
  return lines.join("\n");
}

export function downloadTxt(draft: Draft, settings: PublishSettings, cards: RequirementCard[]) {
  const title = settings.documentTitle || draft.title;
  downloadBlob(`${slug(title)}.txt`, "text/plain;charset=utf-8", buildExportContent(draft, settings, cards));
}

export function downloadMarkdown(draft: Draft, settings: PublishSettings, cards: RequirementCard[]) {
  const title = settings.documentTitle || draft.title;
  const extra = buildExportContent(draft, settings, cards).replace(draftPlainText(draft), "").trim();
  const body = `${extra ? `${extra}\n\n` : ""}${draftToMarkdown(draft)}`;
  downloadBlob(`${slug(title)}.md`, "text/markdown;charset=utf-8", body);
}

export function downloadHtml(draft: Draft, settings: PublishSettings, cards: RequirementCard[]) {
  const title = settings.documentTitle || draft.title;
  const paragraphs = draft.blocks
    .map((block) => `<p>${block.sentences.map((sentence) => sentence.text).join(" ")}</p>`)
    .join("\n");
  const summary = settings.includeRequirementSummary
    ? `<section><h2>Requirement summary</h2><ul>${cards.slice(0, 8).map((card) => `<li><strong>${card.title}</strong>: ${card.content}</li>`).join("")}</ul></section>`
    : "";
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { margin: ${settings.margins}px; font-family: ${settings.bodyFont}, serif; font-size: ${settings.bodySize}px; line-height: ${settings.lineHeight}; color: #272331; }
    h1 { font-family: ${settings.titleFont}, sans-serif; font-size: ${settings.titleSize}px; line-height: 1.15; }
    p { margin: 0 0 ${settings.paragraphSpacing}px; }
  </style>
</head>
<body>
  <article>
    <h1>${title}</h1>
    ${settings.subtitle ? `<p><em>${settings.subtitle}</em></p>` : ""}
    ${summary}
    ${paragraphs}
  </article>
</body>
</html>`;
  downloadBlob(`${slug(title)}.html`, "text/html;charset=utf-8", html);
}
