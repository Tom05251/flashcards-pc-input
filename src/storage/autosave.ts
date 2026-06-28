const DRAFT_KEY = "flashcards-pc-input:draft";

export function loadDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDraft(value: string) {
  localStorage.setItem(DRAFT_KEY, value);
}
