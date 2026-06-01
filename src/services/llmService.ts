import type {
  Author,
  AuthorAnalysisResult,
  AuthorSample,
  Draft,
  RequirementCard,
  RequirementGenerationResult,
  WritingProject,
} from "../types";
import {
  buildAuthorAnalysisPrompt,
  buildDraftPrompt,
  buildRequirementPrompt,
  buildSelectedRewritePrompt,
  buildWholeDraftRefinePrompt,
} from "./promptBuilders";
import {
  annaCompleteText,
  getAnnaRuntime,
  getAnnaRuntimeHint,
  getLastAnnaRuntimeError,
  hasAnnaRuntimeGlobal,
  isAnnaEntryPreview,
  parseJsonFromText,
} from "./annaRuntime";
import { draftPlainText, makeDraftFromParagraphs, selectedTextFromDraft } from "../utils/draft";

const wait = (ms = 520) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
let lastProvider: "anna" | "mock" = "mock";

function compact(value?: string) {
  return value?.trim() || "the central idea";
}

function isStory(project: WritingProject) {
  return /story|novel|chapter|fiction/i.test(project.writingType) || /fiction|story/i.test(project.intentionType);
}

function isWechat(project: WritingProject) {
  return /wechat/i.test(project.channel) || /wechat/i.test(project.writingType);
}

function isCommercial(project: WritingProject) {
  return /commercial|promotional|hybrid/i.test(project.intentionType);
}

function authorNudge(author: Author | null) {
  if (!author) return "Use a clear default writer: specific, useful, and calm.";
  const sampleName = author.samples[1]?.title || author.samples[0]?.title || "the uploaded samples";
  return `Adapt to ${author.name}: ${author.styleSummary} Use a visible move from ${sampleName} where it fits.`;
}

function makeCard(order: number, type: string, title: string, content: string, authorLink: string, priority: "high" | "medium" | "low" = "medium"): RequirementCard {
  return {
    id: id("card"),
    type,
    title,
    content,
    authorLink,
    priority,
    order,
    editable: true,
  };
}

async function completeJson<T>(name: string, prompt: { system: string; user: unknown }, maxTokens = 2600): Promise<T | null> {
  try {
    const text = await annaCompleteText({
      name,
      system: `${prompt.system}

Return strict JSON only. No Markdown fences. No commentary outside JSON.`,
      user: prompt.user,
      maxTokens,
    });
    if (!text) {
      lastProvider = "mock";
      return null;
    }
    lastProvider = "anna";
    return parseJsonFromText<T>(text);
  } catch (error) {
    console.warn(`[AnnaWrite] Anna LLM failed for ${name}; using mock fallback.`, error);
    lastProvider = "mock";
    return null;
  }
}

function normalizeList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function normalizeAnalysis(value: Partial<AuthorAnalysisResult>): AuthorAnalysisResult {
  return {
    style_summary: String(value.style_summary || ""),
    voice: String(value.voice || ""),
    structure_habits: normalizeList(value.structure_habits),
    sentence_rhythm: String(value.sentence_rhythm || ""),
    opening_patterns: normalizeList(value.opening_patterns),
    transition_patterns: normalizeList(value.transition_patterns),
    emotion_curve: String(value.emotion_curve || ""),
    imagery_and_metaphor: String(value.imagery_and_metaphor || ""),
    detail_density: String(value.detail_density || ""),
    dialogue_style: String(value.dialogue_style || ""),
    pacing: String(value.pacing || ""),
    avoid: normalizeList(value.avoid),
    recommended_rules: normalizeList(value.recommended_rules),
    skill_prompt: String(value.skill_prompt || ""),
  };
}

function normalizeRequirementResult(value: Partial<RequirementGenerationResult>): RequirementGenerationResult {
  const cards = Array.isArray(value.cards) ? value.cards : [];
  return {
    working_title: String(value.working_title || "Untitled writing plan"),
    core_angle: String(value.core_angle || ""),
    cards: cards.map((rawCard, order) => {
      const card = rawCard as Partial<RequirementCard> & { author_link?: string };
      return {
        id: String(card.id || id("card")),
        type: String(card.type || "requirement"),
        title: String(card.title || "Requirement"),
        content: String(card.content || ""),
        authorLink: String(card.authorLink || card.author_link || ""),
        priority: ["high", "medium", "low"].includes(String(card.priority)) ? (String(card.priority) as "high" | "medium" | "low") : "medium",
        order,
        editable: card.editable !== false,
      };
    }),
  };
}

function normalizeCard(value: Partial<RequirementCard>, fallback: RequirementCard): RequirementCard {
  const raw = value as Partial<RequirementCard> & { author_link?: string };
  return {
    ...fallback,
    id: String(raw.id || fallback.id),
    type: String(raw.type || fallback.type),
    title: String(raw.title || fallback.title),
    content: String(raw.content || fallback.content),
    authorLink: String(raw.authorLink || raw.author_link || fallback.authorLink),
    priority: ["high", "medium", "low"].includes(String(raw.priority)) ? (String(raw.priority) as "high" | "medium" | "low") : fallback.priority,
    editable: raw.editable !== false,
  };
}

function articleCards(project: WritingProject, author: Author | null) {
  const subject = compact(project.brief);
  const sample = author?.samples[1]?.title || author?.samples[0]?.title || "the selected author notes";
  const cards = [
    makeCard(0, "angle", "Core angle", `Make the piece really about ${subject}. Keep the angle specific enough that every section can answer one reader question.`, `Use the author profile as a lens; ${author ? `mirror the concrete-to-principle movement in "${sample}".` : "no author profile is selected."}`, "high"),
    makeCard(1, "title", "Title promise", `Promise a clear reader reward: ${project.goal || "a sharper way to understand the topic"}. Avoid a title that simply labels the subject.`, isWechat(project) ? "Use title lanes that combine curiosity, benefit, specificity, and trust." : "Keep the title direct and credible.", "high"),
    makeCard(2, "reader", "Reader pain point", `Assume the reader is ${project.audience || "smart but busy"} and needs the piece to reduce uncertainty quickly.`, "Open from the reader's felt problem before expanding into the larger point."),
    makeCard(3, "opening", "Opening strategy", author ? `Open with a concrete scene or friction before abstract judgment, similar to "${sample}".` : "Open with a concrete situation before explanation.", "Do not warm up for six paragraphs.", "high"),
    makeCard(4, "structure", "Structure route", "Move from hook to context, then the main argument, proof or examples, honest caveat, and a closing standard.", "Maintain the author's preferred pacing and paragraph rhythm."),
    makeCard(5, "examples", "Key examples", `Include ${project.mustInclude || "at least two concrete examples"} and make each example prove a different part of the argument.`, "Examples should feel observed rather than pasted in."),
    makeCard(6, "tension", "Emotional tension", `Target ${project.readerEmotionTarget || "trust"} without melodrama. Let the tension come from what changes if the reader ignores the point.`, "Follow the author's emotional curve; avoid sudden sales pressure."),
    makeCard(7, "evidence", "Proof needed", project.references ? "Use the provided references as the only source of specific claims." : "Avoid unsupported numbers, rankings, quotes, timelines, and current-event details.", "Keep factual claims inside the evidence actually supplied.", "high"),
    makeCard(8, "adaptation", "Author-style adaptation", author ? authorNudge(author) : "No selected author; default to clean, specific, low-fluff prose.", author ? `Use short reflective closing lines similar to "${sample}".` : "Prefer clarity over imitation."),
    makeCard(9, "avoid", "Things to avoid", `Avoid ${project.avoid || "generic phrasing, vague hype, and unsupported certainty"}.`, author?.parameters.avoidList?.join("; ") || "Do not over-polish the language."),
    makeCard(10, "standard", "Final article standard", "The final piece should feel publishable: specific promise, fast opening payoff, readable structure, and a closing that follows from the body.", "Check against the author operating manual before drafting.", "high"),
  ];

  if (isCommercial(project)) {
    cards.splice(
      7,
      0,
      makeCard(
        7,
        "conversion",
        "Commercial ratio",
        `Respect ${project.commercialSettings.contentPromotionRatio}. Promotional subject: ${project.commercialSettings.promotionalSubject || "not specified yet"}. Conversion goal: ${project.commercialSettings.conversionGoal || "soft trust"}.`,
        "Do not let the promotional layer distort the author's usual voice.",
        "high",
      ),
      makeCard(
        8,
        "cta",
        "CTA strategy",
        `Use a ${project.commercialSettings.titleVisibility} visibility strategy. The CTA should feel like a natural next step, not a pasted-on ad.`,
        "Close with the author's restraint unless the user asks for direct conversion.",
      ),
    );
  }
  return cards.map((card, index) => ({ ...card, order: index }));
}

function wechatCards(project: WritingProject, author: Author | null) {
  const base = articleCards(project, author).slice(0, 6);
  const topic = compact(project.brief);
  return [
    makeCard(0, "intention", "Intention type", `Classify this as ${project.intentionType}. The article plan must follow that strategy before titles or body are written.`, "Do not mix traffic and promotion silently.", "high"),
    makeCard(1, "title-lane", "Title lane", `Use 2-3 lanes for ${topic}: authority but clickable, trend implication, and pain point + solution.`, "Title is a conversion asset, but it must pay off honestly.", "high"),
    makeCard(2, "hook", "Hook strategy", "The first three paragraphs must deliver either a verdict, the surprising point, the scene, or why the reader should care now.", "Match the author's opening pattern instead of using loud filler.", "high"),
    makeCard(3, "curiosity", "Curiosity factor", "Open a precise curiosity gap: what changed, why it matters, or what most readers are missing.", "Curiosity must be resolved in the body."),
    makeCard(4, "benefit", "Benefit factor", `Make the benefit visible to ${project.audience || "the target reader"} in under one second.`, "Use concrete payoff rather than vague excitement."),
    makeCard(5, "specificity", "Specificity factor", "Use concrete names, scenarios, counts, or source links only when supplied. Do not invent proof.", "Specificity increases trust when it is evidence-backed.", "high"),
    makeCard(6, "emotion", "Emotional color", `Aim for ${project.readerEmotionTarget || "curiosity and trust"} without fake danger.`, "Keep emotion aligned with the author's tone."),
    makeCard(7, "trend", "Current-event angle", project.currentEventSettings.requireSourceLinks ? "If this references a current event, stop for source links before making factual claims." : "Use only references provided in the brief.", "No source links, no concrete current-event claims.", "high"),
    makeCard(8, "visibility", "Title visibility strategy", isCommercial(project) ? `Follow ${project.commercialSettings.titleVisibility}: decide how visible the promotional subject can be in the title.` : "Keep the title focused on content value.", "Do not choose the visibility strategy silently."),
    makeCard(9, "ratio", "Event vs promotion ratio", isCommercial(project) ? `Body ratio: ${project.commercialSettings.contentPromotionRatio}. Control how early and how often the promotional subject appears.` : "No promotion ratio needed unless the user changes intention.", "Ratio controls placement and tone."),
    makeCard(10, "payoff", "Opening payoff", "Do not spend six paragraphs warming up. Pay off the title in the opening.", "Use author rhythm, not empty clickbait."),
    makeCard(11, "structure", "Article structure", "Hook, concrete context, deeper shift, reader implication, practical takeaway, honest caveat, close.", "Keep sections mobile-readable."),
    makeCard(12, "guardrail", "Trust guardrails", "No fabricated metrics, rankings, quotes, capabilities, timelines, or first-ever claims.", "Strong titles still need honest payload.", "high"),
    ...base.slice(3).map((card, index) => ({ ...card, order: index + 13 })),
  ].map((card, index) => ({ ...card, order: index }));
}

function storyCards(project: WritingProject, author: Author | null) {
  const s = project.storySettings;
  const sample = author?.samples[0]?.title || "the selected samples";
  return [
    makeCard(0, "premise", "Story premise", `A ${s.genre || "story"} about ${s.protagonist || "a protagonist"} in ${s.setting || "a charged setting"}, forced to confront ${s.conflict || "a pressure they cannot avoid"}.`, `Open with a concrete image like ${sample}, not a summary.`, "high"),
    makeCard(1, "desire", "Main character desire", `Clarify what the protagonist wants on the surface and what they are avoiding underneath. Theme: ${s.theme || "unstated but emotionally present"}.`, "Desire should be visible in action."),
    makeCard(2, "conflict", "Core conflict", s.conflict || "Build conflict from a concrete external pressure and an internal refusal.", "Keep conflict scene-led, not explained.", "high"),
    makeCard(3, "arc", "Emotional arc", "Move from curiosity into pressure, then into a final image that changes how the opening is remembered.", author?.parameters.emotionCurve || "Use restraint."),
    makeCard(4, "scenes", "Scene list", "Scene 1: charged place. Scene 2: object or message changes pressure. Scene 3: relationship or choice reveals cost. Scene 4: unresolved but meaningful ending.", "Keep scene order tighter than exposition order.", "high"),
    makeCard(5, "pov", "Narrative POV", `${s.pov || "Close third-person"} in ${s.tense || "past tense"}. Stay close to perception and avoid narrator explanation.`, author?.parameters.narrativePerspective || "Keep the camera close."),
    makeCard(6, "setting", "World / setting details", s.setting || "Use concrete sensory details that reveal social pressure, history, or constraint.", "Details should carry emotion."),
    makeCard(7, "relationship", "Relationship dynamics", "Let relationships appear through gestures, withheld speech, and competing needs.", "Dialogue should be sparse unless the sample author uses it heavily."),
    makeCard(8, "symbol", "Symbol / metaphor system", "Choose one recurring object or image and let it change meaning by the ending.", author?.parameters.imageryMetaphorTendency || "Avoid heavy-handed symbols."),
    makeCard(9, "dialogue", "Dialogue style", author?.parameters.dialogueTendency || "Use dialogue only when subtext is doing real work.", "No exposition disguised as speech."),
    makeCard(10, "pacing", "Pacing rules", author?.parameters.pacingStyle || "Slow burn with clear scene turns.", "Do not rush the emotional turn."),
    makeCard(11, "ending", "Ending direction", s.endingDirection || "End on an image or action that answers emotionally without overexplaining.", "Short reflective ending if the author profile supports it.", "high"),
    makeCard(12, "imitation", "Author-style imitation rules", author ? authorNudge(author) : "Use a clear story style with concrete scenes and restrained explanation.", `Reference ${sample} for opening and detail density.`),
    makeCard(13, "forbidden", "Forbidden cliches", `Avoid ${project.avoid || "dream reveals, tidy morals, sudden speeches, and overexplained emotions"}.`, author?.parameters.avoidList.join("; ") || "Keep the ending earned."),
    makeCard(14, "revision", "Revision priorities", "After drafting, check scene specificity, emotional curve, dialogue pressure, and whether every paragraph changes the reader's understanding.", "Revise toward image and action first."),
  ];
}

export const llmService = {
  // TODO: route these functions to OpenAI, Anna-hosted LLM, or another provider when credentials are configured.
  // The UI only calls this service layer, so provider wiring should stay out of React components.
  getProviderLabel() {
    if (lastProvider === "anna") return "Anna LLM";
    if (isAnnaEntryPreview()) return getAnnaRuntimeHint();
    return hasAnnaRuntimeGlobal() ? `Mock fallback (${getLastAnnaRuntimeError() || "Anna LLM unavailable"})` : "Mock fallback";
  },

  getStatusLabel() {
    if (lastProvider === "anna") return "Anna LLM connected";
    if (isAnnaEntryPreview()) return "Preview only";
    const error = getLastAnnaRuntimeError();
    if (error) return "Mock fallback";
    if (hasAnnaRuntimeGlobal()) return "Anna LLM ready";
    return "Mock mode";
  },

  getStatusTone(): "ready" | "mock" | "fallback" {
    if (lastProvider === "anna") return "ready";
    if (isAnnaEntryPreview()) return "fallback";
    if (getLastAnnaRuntimeError()) return "fallback";
    if (hasAnnaRuntimeGlobal()) return "ready";
    return "mock";
  },

  async warmupRuntime() {
    const runtime = await getAnnaRuntime();
    return Boolean(runtime?.llm?.complete);
  },

  async analyzeAuthorSamples(author: Author, samples: AuthorSample[]): Promise<AuthorAnalysisResult> {
    const prompt = buildAuthorAnalysisPrompt(author, samples);
    const real = await completeJson<Partial<AuthorAnalysisResult>>("analyzeAuthorSamples", prompt, 2600);
    if (real) return normalizeAnalysis(real);

    await wait();
    const joined = samples.map((sample) => sample.content).join("\n\n");
    const hasDialogue = /["“”]/.test(joined);
    const hasChinese = /[\u4e00-\u9fff]/.test(joined);
    return {
      style_summary: `${author.name} tends to open from concrete material, then move into judgment. The samples suggest a ${hasChinese ? "Chinese-first" : "English-first"} rhythm with visible scene detail and restrained explanation.`,
      voice: "observant, controlled, specific, low-hype",
      structure_habits: ["Concrete opening", "Named tension", "Layered middle", "Short earned close"],
      sentence_rhythm: "Mostly medium sentences, broken by short emphasis lines when the point lands.",
      opening_patterns: ["Start with a place or product friction", "Use a specific object before a general claim", "Name what changed before explaining why"],
      transition_patterns: ["That is why", "The practical effect is", "What changes is not only"],
      emotion_curve: "Quiet curiosity becomes pressure, then resolves into a clear but understated landing.",
      imagery_and_metaphor: "Prefers tactile images, rooms, windows, weather, and remembered objects over abstract slogans.",
      detail_density: "Medium-high; detail should prove the feeling rather than decorate it.",
      dialogue_style: hasDialogue ? "Sparse and subtextual; dialogue works best when characters avoid saying the real thing." : "Rare; use only when speech changes the pressure of a scene.",
      pacing: "Measured, with each paragraph carrying one turn.",
      avoid: ["unsupported certainty", "generic hype", "overexplained emotion", "empty dramatic words"],
      recommended_rules: ["Open with something concrete", "Let the middle clarify the stake", "Close with a sentence that feels inevitable"],
      skill_prompt:
        "Operate as this author: begin with a concrete observation, keep the language specific and restrained, avoid unsupported claims, let examples carry emotion, and close with a concise line that follows from the piece.",
    };
  },

  async generateAuthorSkill(author: Author, samples: AuthorSample[]) {
    return this.analyzeAuthorSamples(author, samples);
  },

  async generateRequirementCards(project: WritingProject, author: Author | null): Promise<RequirementGenerationResult> {
    const prompt = buildRequirementPrompt(project, author);
    const real = await completeJson<Partial<RequirementGenerationResult>>("generateRequirementCards", prompt, 3600);
    if (real) return normalizeRequirementResult(real);

    await wait();
    const cards = isStory(project) ? storyCards(project, author) : isWechat(project) ? wechatCards(project, author) : articleCards(project, author);
    return {
      working_title: isStory(project)
        ? `${project.storySettings.protagonist || "Someone"} at the Edge of ${project.storySettings.setting || "the Known Place"}`
        : isWechat(project)
          ? `The Real Shift Behind ${compact(project.brief).slice(0, 44)}`
          : `A clearer way to think about ${compact(project.brief).slice(0, 54)}`,
      core_angle: isStory(project)
        ? "A scene-led draft where concrete details carry the emotional turn."
        : "A specific, reader-aware piece that pays off the opening promise without unsupported claims.",
      cards,
    };
  },

  async regenerateRequirementCard(card: RequirementCard, project: WritingProject, author: Author | null): Promise<RequirementCard> {
    const prompt = buildRequirementPrompt(project, author);
    const real = await completeJson<Partial<RequirementCard>>(
      "regenerateRequirementCard",
      {
        system: "Regenerate exactly one writing requirement card as strict JSON. Preserve the card schema.",
        user: {
          card,
          context: prompt.user,
          output_schema: {
            id: "string",
            type: "string",
            title: "string",
            content: "string",
            author_link: "string",
            priority: "high|medium|low",
            editable: true,
          },
        },
      },
      1200,
    );
    if (real) return normalizeCard(real, card);

    await wait(320);
    return {
      ...card,
      content: `${card.content} Tighten this requirement around one concrete reader payoff and one author-style constraint.`,
      authorLink: author ? `Re-check ${author.name}'s samples before drafting this section.` : "Use the default writer with clear, specific prose.",
    };
  },

  async generateDraft(project: WritingProject, author: Author | null): Promise<Draft> {
    const prompt = buildDraftPrompt(project, author, project.requirementCards);
    const real = await completeJson<{ title?: string; paragraphs?: string[] }>("generateDraft", prompt, 4200);
    if (real?.paragraphs?.length) return makeDraftFromParagraphs(String(real.title || project.requirementTitle || "Untitled Draft"), real.paragraphs.map(String));

    await wait(700);
    if (isStory(project)) {
      const protagonist = project.storySettings.protagonist || "Lin";
      const setting = project.storySettings.setting || "the old station";
      const conflict = project.storySettings.conflict || "a message that changes what can be left behind";
      return makeDraftFromParagraphs(project.requirementTitle || "The Timetable Still Clicked", [
        `${setting} had a way of making time sound mechanical. Every hour, somewhere above the empty platform, the old board clicked and rearranged itself for trains that no longer came.`,
        `${protagonist} stood under the leaking awning with one hand inside a coat pocket. The letter there had traveled farther than she had. Its paper had softened at the fold, as if it had been opened by rain instead of fingers.`,
        `The problem was not the letter. The problem was ${conflict}, and the small, unreasonable hope that a place could stay closed long enough for a person to change her mind.`,
        `Across the platform, a child drew circles in the dust with the toe of his shoe. He did not look lost. He looked like someone waiting for a sound only the building could still make.`,
        `When the loudspeaker coughed, ${protagonist} finally opened the envelope. There were only three lines inside, but the last one made the station feel occupied again.`,
        "Outside, rain moved through the rails. The board clicked once more, and this time she read the destination before it disappeared.",
      ]);
    }

    const authorLine = author ? `The selected author changes the piece in a subtle way: ${author.styleSummary}` : "With no selected author, the draft uses a clean default voice.";
    const title = project.requirementTitle || `A Better Draft for ${compact(project.brief).slice(0, 42)}`;
    const topic = compact(project.brief).split(/[.!?。！？]/)[0].trim();
    return makeDraftFromParagraphs(title, [
      `The useful starting point is not a bigger prompt. It is a clearer brief about ${topic}, plus enough context for the draft to know what kind of work it is meant to do.`,
      `${authorLine} That means the opening should not rush into explanation. It should give the reader a scene, a friction, or a clear claim before it asks for attention.`,
      `For ${project.audience || "the intended reader"}, the main reward is ${project.goal || "clarity"}. The draft has to earn that reward quickly: define the tension, show why it matters now, and avoid the kind of polished vagueness that makes generated writing feel empty.`,
      project.mustInclude
        ? `The required material is not an appendix. It belongs inside the argument: ${project.mustInclude}. Each item should do a job, either proving the point, sharpening the example, or making the reader's next step easier.`
        : "The strongest examples should be concrete enough to survive outside the paragraph. If an example cannot be pictured, tested, or remembered, it probably needs to be replaced.",
      isCommercial(project)
        ? `Because this piece has a promotional layer, the ratio matters. ${project.commercialSettings.contentPromotionRatio} should control how early the offer appears and how much space it receives. The reader should feel the content first, then understand why the next step is relevant.`
        : "The piece should stay content-first. Any recommendation or closing invitation should grow out of the argument rather than interrupt it.",
      `The ending should return to the promise in the title. Do not summarize mechanically. Land on a sentence that makes the reader feel the standard of the piece: specific, useful, and hard to confuse with a generic draft.`,
    ]);
  },

  async rewriteSelectedText(project: WritingProject, author: Author | null, selectedSentenceIds: string[], instruction: string) {
    const prompt = buildSelectedRewritePrompt(project, author, selectedSentenceIds, instruction);
    const real = await completeJson<{ replacement_text?: string; reason?: string }>("rewriteSelectedText", prompt, 900);
    if (real?.replacement_text) {
      return {
        replacement_text: String(real.replacement_text),
        reason: real.reason ? String(real.reason) : "Anna LLM selected-range edit.",
      };
    }

    await wait(420);
    const selected = selectedTextFromDraft(project.draft, selectedSentenceIds);
    const trimmed = selected.replace(/\s+/g, " ").trim();
    let replacement = trimmed;
    const lower = instruction.toLowerCase();
    if (lower.includes("short")) replacement = trimmed.split(/\s+/).slice(0, Math.max(8, Math.ceil(trimmed.split(/\s+/).length * 0.55))).join(" ") + ".";
    else if (lower.includes("expand")) replacement = `${trimmed} It also needs a visible consequence, so the reader can see what changes when that starting point is missing.`;
    else if (lower.includes("emotional")) replacement = trimmed.includes("prompt")
      ? "The useful starting point is the moment the writer stops feeling alone with a blank box."
      : `${trimmed.replace(/\.$/, "")}, with enough pressure in the image that the feeling arrives without explanation.`;
    else if (lower.includes("concrete")) replacement = trimmed.includes("prompt")
      ? "The useful starting point is a small writing desk with the brief, examples, and limits already in view."
      : `${trimmed.replace(/\.$/, "")}, grounded in one visible object or action the reader can picture.`;
    else if (lower.includes("literary")) replacement = trimmed.replace(/\.$/, "") + ", leaving the feeling to arrive after the image.";
    else if (lower.includes("clear")) replacement = `Put simply, ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
    else if (lower.includes("author")) replacement = author
      ? `${trimmed.replace(/\.$/, "")}, but held in ${author.name}'s quieter rhythm: concrete first, judgment second.`
      : trimmed;
    else replacement = `${trimmed.replace(/\.$/, "")}, sharpened around the instruction: ${instruction || "make this more specific"}.`;
    return {
      replacement_text: replacement,
      reason: "Mock local edit replaced only the selected range.",
    };
  },

  async rewriteSelectedRange(project: WritingProject, author: Author | null, selectedText: string, instruction: string) {
    const real = await completeJson<{ replacement_text?: string; reason?: string }>(
      "rewriteSelectedRange",
      {
        system:
          "You are a precise local editor. Rewrite only the selected text. Do not rewrite the full draft. Return strict JSON with replacement_text only.",
        user: {
          full_draft_for_context: draftPlainText(project.draft),
          selected_text: selectedText,
          user_revision_instruction: instruction,
          author_style_summary: author?.styleSummary ?? "No selected author.",
          author_skill_prompt: author?.skillPrompt ?? "Use a clean default writer.",
          output_format: project.publishSettings.format,
          constraints: [
            "Return only a replacement for the selected text.",
            "Preserve the meaning unless the user asks otherwise.",
            "Match the selected author style when available.",
            "Do not add explanations outside JSON.",
          ],
          expected_output: {
            replacement_text: "string",
            reason: "brief optional reason",
          },
        },
      },
      900,
    );
    if (real?.replacement_text) {
      return {
        replacement_text: String(real.replacement_text),
        reason: real.reason ? String(real.reason) : "Anna LLM selected text edit.",
      };
    }

    await wait(360);
    const trimmed = selectedText.replace(/\s+/g, " ").trim();
    const lower = instruction.toLowerCase();
    let replacement = trimmed;
    if (lower.includes("short") || lower.includes("concise")) replacement = trimmed.split(/\s+/).slice(0, Math.max(8, Math.ceil(trimmed.split(/\s+/).length * 0.58))).join(" ") + ".";
    else if (lower.includes("expand")) replacement = `${trimmed} Add one concrete consequence so the reader can see why it matters.`;
    else if (lower.includes("academic")) replacement = `In more precise terms, ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
    else if (lower.includes("emotional")) replacement = `${trimmed.replace(/\.$/, "")}, with more of the human pressure left visible.`;
    else if (lower.includes("natural") || lower.includes("ai")) replacement = trimmed.replace(/\butilize\b/gi, "use").replace(/\bin order to\b/gi, "to");
    else replacement = `${trimmed.replace(/\.$/, "")}, revised to ${instruction || "read more clearly"}.`;
    return {
      replacement_text: replacement,
      reason: "Mock selected range edit.",
    };
  },

  async refineWholeDraft(project: WritingProject, author: Author | null, instruction: string): Promise<Draft> {
    const prompt = buildWholeDraftRefinePrompt(project, author, instruction);
    const real = await completeJson<{ title?: string; paragraphs?: string[] }>("refineWholeDraft", prompt, 4200);
    if (real?.paragraphs?.length) return makeDraftFromParagraphs(String(real.title || project.draft?.title || "Untitled Draft"), real.paragraphs.map(String));

    await wait(620);
    const current = project.draft ?? (await this.generateDraft(project, author));
    const lower = instruction.toLowerCase();
    const paragraphs = current.blocks.map((block, index) => {
      const text = block.sentences.map((sentence) => sentence.text).join(" ");
      if (lower.includes("suspense") && index === 0) return `Something in the opening should feel slightly unfinished. ${text}`;
      if (lower.includes("less marketing")) return text.replace(/promotional layer/g, "practical layer").replace(/offer/g, "next step");
      if (lower.includes("example") && index === 2) return `${text} For example, one brief can become a reflective essay, a practical post, or a story chapter depending on which requirements are approved before drafting.`;
      if (lower.includes("ending") && index === current.blocks.length - 1) return "A strong ending should not wave from the doorway. It should close the room with one sentence the reader wants to keep.";
      return text;
    });
    return makeDraftFromParagraphs(current.title, paragraphs);
  },

  async generateTitles(project: WritingProject, author: Author | null) {
    const real = await completeJson<{ titles?: string[] }>(
      "generateTitles",
      {
        system: "Generate strong title options for the writing project. Return strict JSON only.",
        user: {
          selected_author: author
            ? {
                name: author.name,
                style_summary: author.styleSummary,
                skill_prompt: author.skillPrompt,
              }
            : null,
          project,
          output_schema: { titles: ["string"] },
        },
      },
      1600,
    );
    if (real?.titles?.length) return real.titles.map(String).slice(0, 12);

    await wait(320);
    const topic = compact(project.brief).replace(/\.$/, "");
    if (isWechat(project)) {
      return [
        `The Real Shift Behind ${topic}`,
        `Why ${topic} Suddenly Matters Now`,
        `I Thought ${topic} Was the Point. It Wasn't.`,
        `${topic}: The Part Most People Miss`,
        `Before You Write About ${topic}, Read This First`,
      ];
    }
    if (isStory(project)) {
      return ["The Timetable Still Clicked", "Rain at the Closed Station", "The Letter That Arrived Late", "A City No One Could Reach", "Before the Board Went Dark"];
    }
    return [
      `A Clearer Way to Write About ${topic}`,
      `The Brief Comes First, the Judgment Stays Attached`,
      `Why This Draft Needs Requirements Before Prose`,
      `From Writing Brief to Publishable Draft`,
      `${author?.name ?? "A Default Writer"} on ${topic}`,
    ];
  },

  async generatePublishVariants(project: WritingProject) {
    await wait(260);
    return {
      markdown: "Markdown version ready.",
      html: "HTML version ready.",
      txt: "Plain text version ready.",
    };
  },
};
