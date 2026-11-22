import { loadConfig } from './config.js';
import { createStorage } from './storage.js';
import { createState, weightedOrder, referenceFor } from './quiz-core.js';
import { createQuiz } from './quiz-render.js';
import { isLocalPreview, questionsForWeek, sessionQuestions, safeSourceUrl } from './content-policy.js';
import { passageUrl } from './passage-links.js';
import { clearProfileSession } from './profile-storage.js';
import { mountQuestionReport } from './question-report.js';

const $ = id => document.getElementById(id);
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function readLink(ref, config, label = ref) {
  const a = node('a', label, 'link-btn');
  a.href = passageUrl(ref, { provider: config.passageProvider, bibleVersion: config.bibleVersion });
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}
async function json(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Study materials could not be loaded. Please try again.');
  return res.json();
}

async function init() {
  const config = await loadConfig();
  // This parish entry point always fails closed, even if its optional config fetch failed.
  Object.assign(config, { reviewedOnly: true, profileStorage: true, hideRecallReferences: true,
    features: { ...config.features, scoreboard: false } });
  const preview = isLocalPreview(config);
  $('preview-banner').hidden = !config.editorialPreview && !config.publicPilot;
  if (config.publicPilot) $('preview-banner').textContent = config.release.notice;
  if (config.editorialPreview && !preview) throw new Error('Editorial previews run only on this computer. Open the public build for parish use.');
  const [plan, rawLesson] = await Promise.all([json('data/reading-plan.json'), json(config.lessonPath || 'data/lesson.json')]);
  const lesson = preview || rawLesson.reviewStatus === 'approved' || (config.publicPilot && rawLesson.reviewStatus === 'pilot') ? rawLesson : null;
  const state = createState();
  const storage = createStorage(config);
  let week;
  let currentLesson = null;
  let sessionLesson = null;
  const report = mountQuestionReport({ config, getQuestion: () => state.quiz[state.index] });
  const quiz = createQuiz({ state, storage, config, weightedOrder, onQuestion, onFeedback, onResults });
  await quiz.load();

  function onQuestion(q) {
    if (state.index === 0) {
      // Custom/review sessions can cross weeks; don't attach an unrelated spiritual lesson.
      sessionLesson = lesson && state.quiz.every(item => questionsForWeek([item], lesson).length) ? lesson : null;
    }
    $('together-cue').hidden = state.mode !== 'together';
    $('question-help').hidden = false;
    $('hint-text').hidden = true;
    $('hint-text').textContent = '';
    $('help-passage').href = passageUrl(referenceFor(q, config), { provider: config.passageProvider, bibleVersion: config.bibleVersion });
    $('feedback-explanation').textContent = '';
    $('question-depth').replaceChildren();
    $('next-btn').textContent = state.index === state.quiz.length - 1 ? 'Carry it with you' : 'Next question';
    report.reset();
  }

  function markAssisted() {
    if (state.answered || state.mode === 'together') return;
    state.assisted = true;
    $('q-score').textContent = 'Exploring with help · welcome here';
  }
  $('hint-btn').addEventListener('click', () => {
    markAssisted();
    const q = state.quiz[state.index];
    $('hint-text').textContent = sessionLesson?.hints?.[q.id] || 'Read the passage slowly. Who is speaking, to whom, and what reason do they give?';
    $('hint-text').hidden = false;
  });
  $('help-passage').addEventListener('click', markAssisted);
  $('help-passage').addEventListener('auxclick', markAssisted);

  function onFeedback(q) {
    $('question-help').hidden = true;
    $('feedback-explanation').textContent = q.studyGuide?.summary || 'Read the supporting passage and notice how it supports the answer.';
    const depth = $('question-depth');
    const citations = q.studyGuide?.citations || [];
    if (citations.length) depth.append(node('p', `Passage evidence: ${citations.join('; ')}`, 'source-note'));
    if (q.memoryAid?.text) {
      const details = node('details', null, 'gentle-details');
      details.append(node('summary', 'A way to remember'), node('p', q.memoryAid.text));
      depth.append(details);
    }
    if (state.mode === 'together') depth.append(node('p', 'Invite someone to explain where they found the evidence. Did another person notice something you missed?', 'help-note'));
  }

  function appendTeaching(parent, selectedLesson) {
    for (const item of selectedLesson?.teaching || []) {
      const details = node('details', null, 'gentle-details');
      details.append(node('summary', `Go deeper · ${item.title}`), node('p', item.kind, 'eyebrow'), node('p', item.text));
      const href = safeSourceUrl(item.url);
      if (href) {
        const link = node('a', item.source, 'link-btn');
        Object.assign(link, { href, target: '_blank', rel: 'noopener' });
        details.append(link);
      }
      details.append(node('p', 'Discuss this interpretation with your parish teacher. The question score does not measure anyone’s faith.', 'source-note'));
      parent.append(details);
    }
  }

  function onResults() {
    const close = $('session-close');
    close.replaceChildren();
    if (state.attempts.length) {
      if (sessionLesson?.discussion) close.append(node('h3', 'Wonder about it together'), node('p', sessionLesson.discussion));
      close.append(node('h3', 'One idea to carry with you'), node('p', sessionLesson?.takeaway || 'Return to a passage you explored. Notice one detail you would like to understand better.'));
      close.append(node('p', sessionLesson?.reflection || 'Keep your thought to yourself, share it, or pass.'));
      appendTeaching(close, sessionLesson);
    }
    close.append(node('h3', 'Make room for quiet'), node('p', 'Set the screen aside for a moment. You may close with your parish’s usual prayer or simply pause. Nothing here is timed, saved, or scored.'));
  }

  function renderGuide() {
    const guide = $('leader-guide');
    guide.hidden = !currentLesson?.guide?.length;
    $('guide-steps').replaceChildren();
    $('printable-guide').replaceChildren();
    if (guide.hidden) return;
    for (const step of currentLesson.guide) {
      const li = node('li');
      li.append(node('strong', `${step.minutes} min · ${step.title}`), node('p', step.text));
      $('guide-steps').append(li);
    }
    const print = $('printable-guide');
    if (preview) print.append(node('p', 'EDITORIAL PREVIEW — human review pending'));
    else if (config.publicPilot) print.append(node('p', config.release.notice));
    print.append(node('h1', currentLesson.title), node('p', `${week.book} ${week.chapters.join('–')}`), $('guide-steps').cloneNode(true));
    print.append(node('h2', 'Questions to explore'));
    const list = node('ol');
    for (const q of sessionQuestions(state.all, currentLesson)) {
      const li = node('li', q.question);
      li.append(node('p', `${q.answer} · ${q.reference}`), node('p', q.studyGuide?.summary || ''));
      list.append(li);
    }
    print.append(list, node('h2', 'Closing conversation'), node('p', currentLesson.discussion), node('p', currentLesson.takeaway));
    appendTeaching(print, currentLesson);
    print.querySelectorAll('details').forEach(details => { details.open = true; });
    // Avoid duplicated IDs from the printable copy.
    print.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  }

  function chooseWeek(value) {
    week = plan.weeks.find(w => w.week === Number(value)) || plan.weeks[0];
    if (!week) throw new Error('The reading plan is unavailable.');
    currentLesson = lesson?.week === week.week && lesson.book === week.book ? lesson : null;
    $('week-select').value = String(week.week);
    const url = new URL(location.href);
    url.searchParams.set('week', String(week.week));
    history.replaceState(null, '', url);
    $('week-kicker').textContent = `Week ${week.week} · ${week.book} ${week.chapters.join('–')}`;
    $('week-title').textContent = currentLesson?.title || `Read ${week.book} ${week.chapters.join('–')}`;
    $('week-introduction').textContent = currentLesson?.introduction || 'Begin with the reading. Take your time and bring your questions to the next parish gathering.';
    const links = $('week-readings');
    links.replaceChildren();
    for (const ch of week.chapters) links.append(readLink(`${week.book} ${ch}`, config, `Read chapter ${ch}`));
    $('week-gateway').href = passageUrl(`${week.book} ${week.chapters.join('-')}`, { provider: 'biblegateway', bibleVersion: config.bibleVersion });
    const questions = sessionQuestions(state.all, currentLesson || week);
    $('week-practice').disabled = $('learn-together').disabled = !questions.length;
    $('week-practice').textContent = `Explore ${questions.length || 'five'} question${questions.length === 1 ? '' : 's'}`;
    $('week-availability').textContent = questions.length
      ? `${questions.length} questions with explanations${preview ? ' · editorial preview' : config.publicPilot ? ' · parish pilot' : ''}. Start with a moment to read.`
      : 'Questions for this week are awaiting review. The reading is ready whenever you are.';
    renderGuide();
  }

  $('week-select').replaceChildren(...plan.weeks.map(w => {
    const option = node('option', `Week ${w.week} · ${w.book} ${w.chapters.join('–')}`);
    option.value = w.week;
    return option;
  }));
  $('week-select').disabled = false;
  $('week-select').addEventListener('change', event => chooseWeek(event.target.value));
  chooseWeek(new URLSearchParams(location.search).get('week') || 1);
  $('week-practice').addEventListener('click', () => quiz.startSession(sessionQuestions(state.all, currentLesson || week), 'week'));
  $('learn-together').addEventListener('click', () => quiz.startSession(sessionQuestions(state.all, currentLesson || week), 'together'));
  $('print-guide').addEventListener('click', () => window.print());
  function home() {
    $('quiz').hidden = $('results').hidden = true;
    $('setup').hidden = false;
    state.attempts = []; state.quiz = []; state.missed = []; state.score = 0;
    report.reset();
    quiz.refreshHome();
    $('week-select').focus();
  }
  $('restart-btn').addEventListener('click', home);
  $('end-visit').addEventListener('click', () => { clearProfileSession({ all: true }); home(); });
  window.addEventListener('bbs:profile-change', event => {
    storage.load();
    quiz.refreshHome();
    if (event.detail?.reason === 'account' && !(event.detail.previous === 'guest' && event.detail.anonymous)) home();
  });
}

init().catch(error => {
  const message = $('load-error');
  message.hidden = false;
  message.textContent = error.message || 'The study could not be loaded. Please refresh to try again.';
});
