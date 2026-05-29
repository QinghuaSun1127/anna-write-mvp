import type { Author, AuthorSample, RequirementCard, WritingProject } from "../types";
import { draftPlainText, selectedTextFromDraft } from "../utils/draft";

const sampleExcerpt = (sample: AuthorSample) => ({
  title: sample.title,
  source_type: sample.sourceType,
  excerpt: sample.content.slice(0, 1200),
});

export function buildAuthorAnalysisPrompt(author: Author, samples: AuthorSample[]) {
  return {
    system:
      "You analyze writing samples and produce a reusable author operating manual. Return valid JSON only. Do not invent facts not visible in the samples.",
    user: {
      author_name: author.name,
      author_description: author.description,
      samples: samples.map(sampleExcerpt),
      output_schema: {
        style_summary: "string",
        voice: "string",
        structure_habits: ["string"],
        sentence_rhythm: "string",
        opening_patterns: ["string"],
        transition_patterns: ["string"],
        emotion_curve: "string",
        imagery_and_metaphor: "string",
        detail_density: "string",
        dialogue_style: "string",
        pacing: "string",
        avoid: ["string"],
        recommended_rules: ["string"],
        skill_prompt: "string",
      },
    },
  };
}

export function buildRequirementPrompt(project: WritingProject, author: Author | null) {
  return {
    system:
      "You are a precise writing strategist. Before drafting, produce an editable requirement board as valid JSON. Every card must be specific to the brief and any selected author samples.",
    user: {
      selected_author: author
        ? {
            name: author.name,
            description: author.description,
            style_summary: author.styleSummary,
            skill_prompt: author.skillPrompt,
            parameters: author.parameters,
            sample_excerpts: author.samples.map(sampleExcerpt),
          }
        : "No selected author. Use a clear default writer.",
      brief: {
        writing_brief: project.brief,
        writing_type: project.writingType,
        channel: project.channel,
        audience: project.audience,
        goal: project.goal,
        must_include: project.mustInclude,
        avoid: project.avoid,
        references: project.references,
        language: project.language,
        length_target: project.customWordCount || project.lengthTarget,
        tone: project.tone,
        output_goal: project.outputGoal,
        reader_emotion_target: project.readerEmotionTarget,
        intention_type: project.intentionType,
        commercial_settings: project.commercialSettings,
        current_event_settings: project.currentEventSettings,
        story_settings: project.storySettings,
      },
      required_schema: {
        working_title: "string",
        core_angle: "string",
        cards: [
          {
            id: "string",
            type: "string",
            title: "string",
            content: "string",
            author_link: "string",
            priority: "high|medium|low",
            editable: true,
          },
        ],
      },
      guardrails: [
        "If current-event related, require source links before asserting facts.",
        "For commercial or hybrid writing, follow the requested visibility and content-to-promotion ratio.",
        "For story writing, create scene, desire, conflict, pacing, and ending requirements.",
        "Avoid generic cards; tie notes to samples by name where possible.",
      ],
    },
  };
}

export function buildDraftPrompt(project: WritingProject, author: Author | null, cards: RequirementCard[]) {
  return {
    system:
      "You generate a complete first draft from the approved requirements. Return structured JSON with title and paragraphs. Do not add unsupported current-event facts.",
    user: {
      selected_author: author
        ? {
            name: author.name,
            style_summary: author.styleSummary,
            skill_prompt: author.skillPrompt,
            sample_excerpts: author.samples.map(sampleExcerpt),
          }
        : "No selected author. Use a clean default writer.",
      brief: project.brief,
      writing_type: project.writingType,
      channel: project.channel,
      audience: project.audience,
      goal: project.goal,
      must_include: project.mustInclude,
      avoid: project.avoid,
      references: project.references,
      requirement_cards: cards,
      length_target: project.customWordCount || project.lengthTarget,
      language: project.language,
      tone: project.tone,
      content_intention: project.intentionType,
      story_settings: project.storySettings,
      commercial_settings: project.commercialSettings,
      output_constraints: [
        "Use the author profile as style context, not as a factual source.",
        "Satisfy the approved requirement cards.",
        "Keep unverified current-event claims out unless references contain source links.",
      ],
      output_schema: {
        title: "string",
        paragraphs: ["string"],
      },
    },
  };
}

export function buildSelectedRewritePrompt(
  project: WritingProject,
  author: Author | null,
  selectedSentenceIds: string[],
  instruction: string,
) {
  return {
    system:
      "You are a precise local editor. You must only rewrite the selected text. Do not rewrite the full article. Do not add explanations. Return only valid JSON with replacement_text.",
    user: {
      full_draft_for_context: draftPlainText(project.draft),
      selected_text: selectedTextFromDraft(project.draft, selectedSentenceIds),
      selection_location_metadata: { sentence_ids: selectedSentenceIds },
      user_revision_instruction: instruction,
      author_style_summary: author?.styleSummary ?? "No selected author.",
      author_skill_prompt: author?.skillPrompt ?? "Use a clean default writer.",
      requirement_cards: project.requirementCards,
      constraints: [
        "Only rewrite the selected range.",
        "Preserve all unselected content exactly.",
        "Return only replacement text for the selected range.",
        "Match the selected author style when available.",
        "Follow current requirement cards.",
      ],
      expected_output: {
        replacement_text: "string",
        reason: "brief internal-facing reason, optional",
      },
    },
  };
}

export function buildWholeDraftRefinePrompt(project: WritingProject, author: Author | null, instruction: string) {
  return {
    system:
      "You revise the whole draft because the user explicitly requested a full-draft change. Return JSON with title and paragraphs.",
    user: {
      current_draft: draftPlainText(project.draft),
      user_feedback: instruction,
      author_style_summary: author?.styleSummary ?? "No selected author.",
      author_skill_prompt: author?.skillPrompt ?? "Use a clean default writer.",
      requirement_cards: project.requirementCards,
      output_schema: { title: "string", paragraphs: ["string"] },
    },
  };
}
