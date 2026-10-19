// While a learner watches a video, report screenshot shortcuts to the server and tell the page what
// the server decided ({ strikes, message, blocked, ... }) when the attempt was counted.
import { useEffect, useRef } from 'react';
import { createCaptureDetector } from './captureGuard';
import { reportCapture } from './dataService';

export const useCaptureGuard = ({ videoId, enabled, onFlagged }) => {
  const callback = useRef(onFlagged);
  useEffect(() => { callback.current = onFlagged; });

  useEffect(() => {
    if (!enabled) return undefined;
    const detector = createCaptureDetector();
    let sending = false;
    const send = async (signal) => {
      if (!signal || sending) return;
      sending = true;
      const result = await reportCapture(videoId, signal);
      sending = false;
      if (result?.counted) callback.current?.(result);
    };
    const onKeyDown = (e) => send(detector.keydown(e));
    const onKeyUp = (e) => send(detector.keyup(e));
    const onBlur = () => send(detector.blur());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [videoId, enabled]);
};
