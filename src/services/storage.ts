import type { Author, WritingProject } from "../types";
import { createEmptyProject, defaultAuthors } from "../data/seed";

const AUTHORS_KEY = "annawrite:authors";
const PROJECT_KEY = "annawrite:current-project";
const CURRENT_AUTHOR_KEY = "annawrite:current-author";

export interface StoredState {
  authors: Author[];
  currentAuthorId: string | null;
  project: WritingProject;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadStoredState(): StoredState {
  const storedAuthors = readJson<Author[] | null>(AUTHORS_KEY, null);
  const authors = storedAuthors
    ? [...storedAuthors, ...defaultAuthors.filter((author) => !storedAuthors.some((stored) => stored.id === author.id))]
    : defaultAuthors;
  const currentAuthorId = readJson<string | null>(CURRENT_AUTHOR_KEY, authors[0]?.id ?? null);
  const project = readJson<WritingProject>(PROJECT_KEY, createEmptyProject(currentAuthorId));
  return { authors, currentAuthorId, project };
}

export function saveAuthors(authors: Author[]) {
  localStorage.setItem(AUTHORS_KEY, JSON.stringify(authors));
}

export function saveCurrentAuthor(authorId: string | null) {
  localStorage.setItem(CURRENT_AUTHOR_KEY, JSON.stringify(authorId));
}

export function saveProject(project: WritingProject) {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export function clearStoredState() {
  localStorage.removeItem(AUTHORS_KEY);
  localStorage.removeItem(PROJECT_KEY);
  localStorage.removeItem(CURRENT_AUTHOR_KEY);
}
