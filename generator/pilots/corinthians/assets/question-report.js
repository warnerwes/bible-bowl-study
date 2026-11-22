import { createSuggestionSubmitter } from './suggest-core.js';
import { isLocalPreview } from './content-policy.js';

export function correctionPayload(q, text) {
  const body = String(text || '').trim();
  if (!q?.id || !body || body.length > 800) throw new Error('Please describe the issue in 1–800 characters.');
  return { authorName: 'Parish learner', kind: 'correction', book: q.book, chapter: q.chapter,
    reference: q.reference, text: `Question ${q.id}: ${body}`, answerText: q.answer.slice(0, 200) };
}

export function mountQuestionReport({ config, getQuestion }) {
  const form = document.getElementById('report-form');
  const input = document.getElementById('report-text');
  const status = document.getElementById('report-status');
  const button = document.getElementById('report-send');
  const details = document.getElementById('question-report');
  let generation = 0;
  function reset() {
    generation++;
    input.value = ''; status.textContent = ''; button.disabled = false; details.open = false;
    button.textContent = isLocalPreview(config) ? 'Copy review note' : 'Send for review';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    const attempt = generation;
    button.disabled = true;
    status.textContent = 'Preparing…';
    try {
      const payload = correctionPayload(getQuestion(), input.value);
      if (isLocalPreview(config)) {
        await navigator.clipboard.writeText(`${payload.text}\n${payload.reference}`);
        if (attempt === generation) status.textContent = 'Review note copied. Nothing was sent from this local preview.';
      } else {
        if (!config.firebase) throw new Error('Sending is unavailable. Please share this question and reference with your parish leader.');
        await createSuggestionSubmitter({ config })(payload);
        if (attempt === generation) { input.value = ''; status.textContent = 'Sent to the moderators for review. Thank you for helping make this clearer.'; }
      }
    } catch (error) {
      if (attempt === generation) status.textContent = error.message || 'Could not send. Please try again.';
    } finally { if (attempt === generation) button.disabled = false; }
  });
  reset();
  return { reset };
}
