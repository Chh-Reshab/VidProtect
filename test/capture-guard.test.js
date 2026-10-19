import { suite } from './helpers.js';
import { createCaptureDetector } from '../src/services/captureGuard.js';

const key = (code, extra = {}) => ({ code, key: extra.key || code, metaKey: false, shiftKey: false, ...extra });

suite('screenshot shortcut detector (what the player listens for)', async ({ ok }) => {
  let clock = 1_000_000;
  const fresh = () => createCaptureDetector(() => clock);

  let d = fresh();
  ok('Print Screen (keydown) is a print_screen signal', d.keydown(key('PrintScreen', { key: 'PrintScreen' })) === 'print_screen');
  d = fresh();
  ok('Windows only reports Print Screen on keyup, and that counts', d.keyup(key('PrintScreen', { key: 'PrintScreen' })) === 'print_screen');
  d = fresh();
  ok('Print Screen down then up is one signal, not two (cooldown)', d.keydown(key('PrintScreen', { key: 'PrintScreen' })) === 'print_screen' && d.keyup(key('PrintScreen', { key: 'PrintScreen' })) === null);
  clock += 5000;
  ok('...but a second press a few seconds later counts again', d.keydown(key('PrintScreen', { key: 'PrintScreen' })) === 'print_screen');

  d = fresh();
  ok('Win+Shift+S is a screenshot_shortcut', d.keydown(key('KeyS', { key: 'S', metaKey: true, shiftKey: true })) === 'screenshot_shortcut');
  for (const digit of ['Digit3', 'Digit4', 'Digit5']) {
    d = fresh();
    ok(`Cmd+Shift+${digit.slice(-1)} (macOS) is a screenshot_shortcut`, d.keydown(key(digit, { key: '#', metaKey: true, shiftKey: true })) === 'screenshot_shortcut');
  }

  d = fresh();
  ok('ordinary typing is never flagged', ['KeyS', 'KeyA', 'Space', 'ArrowLeft', 'Digit3'].every(c => d.keydown(key(c)) === null));
  ok('Shift+S alone, or Ctrl+Shift+S, is not a screenshot', d.keydown(key('KeyS', { shiftKey: true })) === null && d.keydown(key('KeyS', { shiftKey: true, ctrlKey: true })) === null);
  ok('Win+S alone (search) is not a screenshot', d.keydown(key('KeyS', { metaKey: true })) === null);

  // the OS tool takes focus right after Win/Cmd+Shift
  d = fresh();
  d.keydown(key('ShiftLeft', { key: 'Shift', metaKey: true, shiftKey: true }));
  clock += 400;
  ok('Win/Cmd+Shift held and then the window loses focus counts as a screenshot tool opening', d.blur() === 'screenshot_shortcut');
  ok('a later blur on its own does not', d.blur() === null);
  d = fresh();
  d.keydown(key('ShiftLeft', { key: 'Shift', metaKey: true, shiftKey: true }));
  clock += 4000;
  ok('a blur long after the keys is not linked to them', d.blur() === null);
  d = fresh();
  clock += 5000;
  ok('a blur with no keys before it (switching tabs) is never flagged', d.blur() === null);
  d = fresh();
  d.keydown(key('Tab', { key: 'Tab', metaKey: true, shiftKey: true }));
  clock += 300;
  ok('Cmd+Shift+Tab (switch apps backwards) is not mistaken for a screenshot', d.blur() === null);
});
