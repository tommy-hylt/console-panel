import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiRefreshCw, FiGrid, FiList } from 'react-icons/fi';
import type { WindowInfo } from './api';
import { listWindows, newConsole } from './api';
import { ConsoleItem } from './ConsoleItem';
import './App.css';

function App() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnailMode, setThumbnailMode] = useState(false);

  const fetchWindows = useCallback(async () => {
    try {
      const list = await listWindows();
      // Keep existing order for windows that still exist, add new ones at end
      setWindows((prev) => {
        const prevHandles = new Map(prev.map((w) => [w.handle, w]));
        const newList: WindowInfo[] = [];

        // Keep order for existing windows
        for (const pw of prev) {
          const found = list.find((w) => w.handle === pw.handle);
          if (found) newList.push(found);
        }

        // Add new windows at the end
        for (const w of list) {
          if (!prevHandles.has(w.handle)) {
            newList.push(w);
          }
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

  const moveWindow = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    setWindows((prev) => {
      const next = [...prev];
      const item = next[index];

      switch (direction) {
        case 'up':
          if (index > 0) {
            next.splice(index, 1);
            next.splice(index - 1, 0, item);
          }
          break;
        case 'down':
          if (index < next.length - 1) {
            next.splice(index, 1);
            next.splice(index + 1, 0, item);
          }
          break;
        case 'top':
          next.splice(index, 1);
          next.unshift(item);
          break;
        case 'bottom':
          next.splice(index, 1);
          next.push(item);
          break;
      }

      return next;
    });
  };

  const removeWindow = (handle: string) => {
    setWindows((prev) => prev.filter((w) => w.handle !== handle));
  };

  const handleNewConsole = async () => {
    const title = prompt('Console title (optional):');
    await newConsole(title || undefined);
    setTimeout(fetchWindows, 500);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ flex: 1, margin: 0 }}>ConsolePanel</h1>
        <button
          onClick={() => setThumbnailMode(!thumbnailMode)}
          style={{ marginRight: 8 }}
          title={thumbnailMode ? 'List view' : 'Thumbnail view'}
        >
          {thumbnailMode ? <FiList /> : <FiGrid />}
        </button>
        <button onClick={fetchWindows} style={{ marginRight: 8 }}>
          <FiRefreshCw style={{ marginRight: 4 }} /> Refresh
        </button>
        <button onClick={handleNewConsole}>
          <FiPlus style={{ marginRight: 4 }} /> New Console
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
      ) : windows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          No windows found
        </div>
      ) : (
        <div>
          {windows.map((w, i) => (
            <ConsoleItem
              key={w.handle}
              winInfo={w}
              onMoveUp={() => moveWindow(i, 'up')}
              onMoveDown={() => moveWindow(i, 'down')}
              onMoveTop={() => moveWindow(i, 'top')}
              onMoveBottom={() => moveWindow(i, 'bottom')}
              onRemove={() => removeWindow(w.handle)}
              isFirst={i === 0}
              isLast={i === windows.length - 1}
              thumbnailMode={thumbnailMode}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
