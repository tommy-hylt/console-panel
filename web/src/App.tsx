import { useState, useEffect, useCallback, useRef } from 'react';
import { FiPlus, FiRefreshCw, FiGrid, FiList } from 'react-icons/fi';
import type { WindowInfo } from './api';
import { listWindows, newConsole } from './api';
import { ConsoleItem } from './ConsoleItem';
import './App.css';

const STARRED_KEY = 'consolepanel-starred';
const MAX_STARRED = 20;
const ANIM_DURATION = 500;

function loadStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore corrupt localStorage */ }
  return new Set();
}

function saveStarred(set: Set<string>) {
  localStorage.setItem(STARRED_KEY, JSON.stringify([...set]));
}

function App() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnailMode, setThumbnailMode] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(loadStarred);
  const [animating, setAnimating] = useState<{ handle: string; direction: 'star' | 'unstar' } | null>(null);
  // For unstar: after exit completes, this triggers enter animation at the item's natural position
  const [enteringHandle, setEnteringHandle] = useState<string | null>(null);
  const enterRef = useRef<HTMLDivElement>(null);

  // Scroll to entering item when unstar enter phase begins
  useEffect(() => {
    if (enteringHandle) {
      requestAnimationFrame(() => {
        enterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [enteringHandle]);

  const toggleStar = useCallback((handle: string) => {
    if (animating || enteringHandle) return;
    const direction = starred.has(handle) ? 'unstar' : 'star';
    setAnimating({ handle, direction });

    if (direction === 'star') {
      // Star: exit + enter play simultaneously, scroll to entering duplicate at top
      requestAnimationFrame(() => {
        setTimeout(() => {
          enterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
      setTimeout(() => {
        setStarred(prev => {
          const next = new Set(prev);
          if (next.size >= MAX_STARRED) {
            const first = next.values().next().value;
            if (first !== undefined) next.delete(first);
          }
          next.add(handle);
          saveStarred(next);
          return next;
        });
        setAnimating(null);
      }, ANIM_DURATION);
    } else {
      // Unstar: sequential — exit first, then commit + enter at natural position
      setTimeout(() => {
        setStarred(prev => {
          const next = new Set(prev);
          next.delete(handle);
          saveStarred(next);
          return next;
        });
        setAnimating(null);
        setEnteringHandle(handle);
        setTimeout(() => setEnteringHandle(null), ANIM_DURATION);
      }, ANIM_DURATION);
    }
  }, [animating, enteringHandle, starred]);

  const fetchWindows = useCallback(async () => {
    try {
      const list = await listWindows();
      setWindows((prev) => {
        const prevHandles = new Map(prev.map((w) => [w.handle, w]));
        const newList: WindowInfo[] = [];
        for (const pw of prev) {
          const found = list.find((w) => w.handle === pw.handle);
          if (found) newList.push(found);
        }
        for (const w of list) {
          if (!prevHandles.has(w.handle)) newList.push(w);
        }
        return newList;
      });
    } catch (e) {
      console.error('Failed to fetch windows:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWindows();
    const interval = setInterval(fetchWindows, 5000);
    return () => clearInterval(interval);
  }, [fetchWindows]);

  const removeWindow = (handle: string) => {
    setWindows((prev) => prev.filter((w) => w.handle !== handle));
  };

  const handleNewConsole = async () => {
    const title = prompt('Console title (optional):');
    await newConsole(title || undefined);
    setTimeout(fetchWindows, 500);
  };

  // Split windows into starred and normal, maintaining original order
  const starredWindows = windows.filter(w => starred.has(w.handle));
  const normalWindows = windows.filter(w => !starred.has(w.handle));

  const renderItems = () => {
    const items: React.ReactNode[] = [];
    let idx = 0;

    // Starred section
    for (const w of starredWindows) {
      const isExiting = animating?.handle === w.handle && animating.direction === 'unstar';
      items.push(
        <div key={w.handle} className={isExiting ? 'anim-item-exit' : undefined}>
          <ConsoleItem
            winInfo={w}
            isStarred
            onToggleStar={() => toggleStar(w.handle)}
            onRemove={() => removeWindow(w.handle)}
            thumbnailMode={thumbnailMode}
            index={idx++}
          />
        </div>
      );
    }

    // Entering duplicate for star animation (appears at end of starred section)
    if (animating?.direction === 'star') {
      const w = windows.find(x => x.handle === animating.handle);
      if (w) {
        items.push(
          <div key={`anim-${w.handle}`} ref={enterRef} className="anim-item-enter">
            <ConsoleItem
              winInfo={w}
              isStarred
              onToggleStar={() => {}}
              onRemove={() => {}}
              thumbnailMode={thumbnailMode}
              index={idx++}
            />
          </div>
        );
      }
    }

    // Normal section
    for (const w of normalWindows) {
      const isExiting = animating?.handle === w.handle && animating.direction === 'star';
      const isEntering = enteringHandle === w.handle;
      items.push(
        <div
          key={w.handle}
          className={isExiting ? 'anim-item-exit' : isEntering ? 'anim-item-enter' : undefined}
          ref={isEntering ? enterRef : undefined}
        >
          <ConsoleItem
            winInfo={w}
            isStarred={false}
            onToggleStar={() => toggleStar(w.handle)}
            onRemove={() => removeWindow(w.handle)}
            thumbnailMode={thumbnailMode}
            index={idx++}
          />
        </div>
      );
    }

    return items;
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>ConsolePanel</h1>
        <div className="controls">
          <button
            onClick={() => setThumbnailMode(!thumbnailMode)}
            title={thumbnailMode ? 'List view' : 'Thumbnail view'}
          >
            {thumbnailMode ? <FiList style={{ marginRight: 8 }} /> : <FiGrid style={{ marginRight: 8 }} />}
            {thumbnailMode ? 'List View' : 'Grid View'}
          </button>
          <button onClick={fetchWindows}>
            <FiRefreshCw style={{ marginRight: 8 }} /> Refresh
          </button>
          <button onClick={handleNewConsole} className="primary">
            <FiPlus style={{ marginRight: 8 }} /> New Console
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
      ) : windows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          No windows found
        </div>
      ) : (
        <div className={thumbnailMode ? "windows-grid" : "windows-list"}>
          {renderItems()}
        </div>
      )}
    </div>
  );
}

export default App;
