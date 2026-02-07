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
