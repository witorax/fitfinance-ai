// Convertit du markdown (plans IA, reponses du Coach) en HTML securise.
function renderMarkdown(text) {
  if (!text) return "";
  const raw = marked.parse(text, { breaks: true });
  return DOMPurify.sanitize(raw);
}
