import { clearProfileSession, legacyDeviceData, deleteLegacyDeviceData } from './profile-storage.js';
import { createReaderCache } from './reader-cache.js';
import { loadConfig } from './config.js';
import { ensureFirebase } from './firebase-client.js';
import { waitForExistingSession } from './suggest-core.js';

const $ = id => document.getElementById(id);
const say = text => { $('privacy-status').textContent = text; };
$('clear-visit').addEventListener('click', () => {
  clearProfileSession({ all: true });
  createReaderCache().clearAll();
  say('This tab’s practice, notes, drafts, name, and cached reading have been cleared. Submitted contributions and your sign-in are unchanged.');
});
$('export-legacy').addEventListener('click', () => {
  const data = legacyDeviceData();
  if (!Object.keys(data).length) { say('No old device data was found.'); return; }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'bible-bowl-old-device-data.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say('Exported old device data. Store it privately.');
});
$('delete-legacy').addEventListener('click', () => {
  deleteLegacyDeviceData();
  say('Old notes, drafts, contribution name, scoreboard preference, and Corinthians results were removed from this device.');
});
$('delete-ranking').addEventListener('click', async () => {
  const button = $('delete-ranking');
  button.disabled = true;
  try {
    const config = await loadConfig();
    if (!config.firebase) throw new Error('Account actions are unavailable in the local editorial preview.');
    const firebase = await ensureFirebase(config.firebase);
    const user = await waitForExistingSession(firebase);
    if (!user) throw new Error('Open the reader and sign in to the account that owns the old entry, then return here.');
    await firebase.deleteDoc(firebase.doc(firebase.db, 'mastery', user.uid));
    say('Your old scoreboard entry has been removed.');
  } catch (error) { say(error.message || 'Could not remove the entry. Please try again.'); }
  finally { button.disabled = false; }
});
