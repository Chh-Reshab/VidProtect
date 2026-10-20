// Keeps the discussion room fresh: polls every few seconds while the page is in front (slower in the
// background), asks only "has anything changed?" (a tiny answer) and downloads the room when it has.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChat, fetchOlderChat, sendChatMessage } from './dataService';

const FAST_MS = 3000;
const SLOW_MS = 15000;

export const useChatRoom = () => {
  const [messages, setMessages] = useState([]);
  const [mutedUntil, setMutedUntil] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const version = useRef(null);
  const timer = useRef(null);
  const alive = useRef(true);

  const poll = useCallback(async () => {
    const r = await fetchChat(version.current);
    if (!alive.current) return;
    if (!r.success) { setError(r.error || 'Could not load the discussion.'); setLoading(false); return; }
    setError('');
    if (!r.unchanged) {
      version.current = r.v;
      // keep any older messages the person already scrolled back to load
      setMessages(prev => (r.messages.length ? [...prev.filter(m => m.createdAt < r.messages[0].createdAt), ...r.messages] : r.messages));
      setHasMore(r.hasMore);
      setMutedUntil(r.mutedUntil || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    const loop = async () => {
      await poll();
      if (!alive.current) return;
      timer.current = setTimeout(loop, document.hidden ? SLOW_MS : FAST_MS);
    };
    const wake = () => { if (!document.hidden) { clearTimeout(timer.current); loop(); } }; // coming back to the tab: refresh now
    loop();
    document.addEventListener('visibilitychange', wake);
    return () => { alive.current = false; clearTimeout(timer.current); document.removeEventListener('visibilitychange', wake); };
  }, [poll]);

  const send = useCallback(async (text) => {
    const r = await sendChatMessage(text);
    if (r.success) {
      version.current = null; // the next poll downloads the room, which includes other people's new messages too
      setMessages(list => (list.some(m => m.id === r.message.id) ? list : [...list, r.message]));
    } else if (r.mutedUntil) {
      setMutedUntil(r.mutedUntil);
    }
    return r;
  }, []);

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    const r = await fetchOlderChat(first.id);
    if (!alive.current || !r.success) return;
    setMessages(list => [...r.messages, ...list]);
    setHasMore(r.hasMore);
  }, [messages]);

  const refresh = useCallback(() => { version.current = null; return poll(); }, [poll]);

  return { messages, mutedUntil, hasMore, loading, error, send, loadOlder, refresh };
};
