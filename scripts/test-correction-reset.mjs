const STORAGE_KEY = "bbs:stats:v1";
const CORRECTIONS_VERSION = 1;
const CORRECTED_IDS = [
  "ex17-004", "ex17-005", "ex10-002", "ex16-013", "ex09-009",
  "ex12-012", "ex16-017", "ex19-005", "ex33-004",
];
const CORRECTIONS_KEY = STORAGE_KEY + ":corrections";
const MASTERY_STREAK = 3;

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

function applyCorrectionResets(stats, localStorage) {
  let appliedVersion = 0;
  try { appliedVersion = parseInt(localStorage.getItem(CORRECTIONS_KEY), 10) || 0; } catch (e) {}
  if (appliedVersion >= CORRECTIONS_VERSION) return false;
  for (const id of CORRECTED_IDS) {
    const s = stats[id];
    if (s && s.streak >= MASTERY_STREAK) {
      s.streak = 0;
    }
  }
  localStorage.setItem(CORRECTIONS_KEY, String(CORRECTIONS_VERSION));
  return true;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const localStorage = createLocalStorage();
const stats = {
  "ex17-004": { streak: 3, wrong: 1, seen: 4 },
  "ex01-001": { streak: 3, wrong: 0, seen: 3 },
};

const firstRunApplied = applyCorrectionResets(stats, localStorage);
assert(firstRunApplied === true, "first run should apply the migration");
assert(stats["ex17-004"].streak === 0, "corrected mastered question should be reset");
assert(stats["ex01-001"].streak === 3, "non-corrected mastered question should be untouched");

const secondRunApplied = applyCorrectionResets(stats, localStorage);
assert(secondRunApplied === false, "second run should be blocked by the version guard");
assert(stats["ex17-004"].streak === 0, "second run should be a no-op");

console.log("correction reset test passed");
