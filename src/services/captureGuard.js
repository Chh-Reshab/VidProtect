// ============================================
// Screenshot-shortcut detection for the player. A web page cannot see a screen recorder, but it can
// see these keyboard signs: the Print Screen key, Cmd+Shift+3/4/5 (macOS), Win+Shift+S (Windows).
// Feed key and blur events in; get 'print_screen', 'screenshot_shortcut' or null back. These are
// warning signs, not proof (the server treats them that way too).
// ============================================

const COOLDOWN_MS = 2000;      // one key press can raise keydown, keyup and a blur
const COMBO_WINDOW_MS = 1500;  // Win/Cmd + Shift held, then the window loses focus: a snipping tool opened

export const createCaptureDetector = (now = Date.now) => {
  let lastSignalAt = 0;
  let comboAt = 0;

  const fire = (signal) => {
    const t = now();
    if (t - lastSignalAt < COOLDOWN_MS) return null;
    lastSignalAt = t;
    return signal;
  };
  const isPrintScreen = (e) => e.key === 'PrintScreen' || e.code === 'PrintScreen';

  return {
    keydown(e) {
      if (isPrintScreen(e)) return fire('print_screen');
      if (e.metaKey && e.shiftKey) {
        if (e.code === 'KeyS' || ['Digit3', 'Digit4', 'Digit5'].includes(e.code)) return fire('screenshot_shortcut');
        comboAt = e.code === 'Tab' ? 0 : now(); // Cmd+Shift+Tab switches apps; it is not a screenshot
      }
      return null;
    },
    keyup(e) { return isPrintScreen(e) ? fire('print_screen') : null; }, // Windows reports Print Screen on keyup only
    blur() {
      if (comboAt && now() - comboAt < COMBO_WINDOW_MS) { comboAt = 0; return fire('screenshot_shortcut'); }
      return null;
    },
  };
};
