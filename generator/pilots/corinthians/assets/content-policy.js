export function isLocalPreview(config, hostname = globalThis.location?.hostname || '') {
  return config?.editorialPreview === true && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function visibleQuestions(questions, config = {}, hostname) {
  const preview = isLocalPreview(config, hostname);
  return (Array.isArray(questions) ? questions : []).filter(q => {
    if (!q || q.placeholder === true || q.reviewStatus === 'rejected') return false;
    if (preview) return q.reviewStatus === 'draft' || ['approved', 'published'].includes(q.reviewStatus);
    if (config.publicPilot === true && q.reviewStatus === 'pilot') return true;
    if (config.reviewedOnly) return ['approved', 'published'].includes(q.reviewStatus);
    // Old book packs without editorial metadata keep their existing contract.
    return q.reviewStatus == null || ['approved', 'published'].includes(q.reviewStatus);
  });
}

export function chapterKey(q) { return `${q.bookSlug || q.book || ''}:${q.chapter}`; }

export function questionsForWeek(questions, week) {
  return questions.filter(q => q.book === week.book && week.chapters.includes(q.chapter));
}

export function sessionQuestions(questions, lesson, count = 5) {
  const pool = questionsForWeek(questions, lesson);
  const preferred = (lesson.questionIds || []).map(id => pool.find(q => q.id === id)).filter(Boolean);
  if (preferred.length || lesson.chapters.length < 2) {
    return [...preferred, ...pool.filter(q => !preferred.includes(q))].slice(0, count);
  }

  const byChapter = [...new Set(lesson.chapters)].map(chapter => pool.filter(q => q.chapter === chapter));
  const ordered = [];
  for (let index = 0; ordered.length < pool.length; index += 1) {
    for (const chapter of byChapter) {
      if (chapter[index]) ordered.push(chapter[index]);
    }
  }
  return ordered.slice(0, count);
}

export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
