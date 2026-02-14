import { useState, useEffect, useCallback, useRef } from 'react';
import { FiPlus, FiRefreshCw, FiGrid, FiList, FiClock, FiFolder } from 'react-icons/fi';
import type { WindowInfo } from './api';
import { listWindows, newConsole, listDir } from './api';
import { ConsoleItem } from './ConsoleItem';
import './App.css';

const STARRED_KEY = 'consolepanel-starred';
const NICKNAMES_KEY = 'consolepanel-nicknames';
const HISTORY_KEY = 'consolepanel-new-history';
const MAX_STARRED = 100;
const MAX_HISTORY = 100;
const ANIM_DURATION = 500;

type NewConsoleRecord = { command: string; directory: string };

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

function loadNicknames(): Map<string, string> {
  try {
    const raw = localStorage.getItem(NICKNAMES_KEY);
    if (raw) return new Map(Object.entries(JSON.parse(raw)));
  } catch { /* ignore corrupt localStorage */ }
  return new Map();
}

function saveNicknames(map: Map<string, string>) {
  localStorage.setItem(NICKNAMES_KEY, JSON.stringify(Object.fromEntries(map)));
}

function App() {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnailMode, setThumbnailMode] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(loadStarred);
  const [nicknames, setNicknames] = useState<Map<string, string>>(loadNicknames);
  const [animating, setAnimating] = useState<{ handle: string; direction: 'star' | 'unstar' } | null>(null);
  const [showNewConsoleForm, setShowNewConsoleForm] = useState(false);
  const [newCommand, setNewCommand] = useState('');
  const [newDirectory, setNewDirectory] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [newConsoleHistory, setNewConsoleHistory] = useState<NewConsoleRecord[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  });
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const [folderColumns, setFolderColumns] = useState<Array<{ parentPath: string; dirs: string[]; selected: string | null }>>([]);
  const [defaultDir, setDefaultDir] = useState('');
  const folderBrowserRef = useRef<HTMLDivElement>(null);
  // For unstar: after exit completes, this triggers enter animation at the item's natural position
  const [enteringHandle, setEnteringHandle] = useState<string | null>(null);
  const enterRef = useRef<HTMLDivElement>(null);

  // Fetch default directory (tools/ abs path) on first form open
  useEffect(() => {
    if (showNewConsoleForm && !defaultDir) {
      listDir().then(r => {
        if (r.ok && r.path) {
          setDefaultDir(r.path);
          if (!newDirectory) setNewDirectory(r.path);
        }
      });
    }
  }, [showNewConsoleForm]);

  // Build folder columns from current newDirectory path
  const buildFolderColumns = useCallback(async (dirPath: string) => {
    const sep = dirPath.includes('/') ? '/' : '\\';
    // Split path: "C:\Users\User" -> ["C:", "Users", "User"]
    const raw = dirPath.split(sep).filter(Boolean);
    if (raw.length === 0) return;

    // Rebuild accumulated paths: ["C:\", "C:\Users", "C:\Users\User"]
    const accPaths: string[] = [];
    accPaths.push(raw[0] + sep); // root: "C:\"
    for (let i = 1; i < raw.length; i++) {
      accPaths.push(accPaths[i - 1] + raw[i] + (i < raw.length - 1 ? sep : ''));
    }

    // Fetch children for each level in parallel
    const results = await Promise.all(accPaths.map(p => listDir(p)));

    const columns: Array<{ parentPath: string; dirs: string[]; selected: string | null }> = [];
    for (let i = 0; i < accPaths.length; i++) {
      const r = results[i];
      columns.push({
        parentPath: accPaths[i],
        dirs: r.ok ? r.dirs : [],
        selected: raw[i + 1] || null,
      });
    }

    setFolderColumns(columns);
    requestAnimationFrame(() => {
      if (folderBrowserRef.current) folderBrowserRef.current.scrollLeft = folderBrowserRef.current.scrollWidth;
    });
  }, []);

  const handleFolderClick = useCallback(async (columnIndex: number, folderName: string) => {
    const col = folderColumns[columnIndex];
    if (!col) return;
    const sep = col.parentPath.includes('/') ? '/' : '\\';
    const newPath = col.parentPath.endsWith(sep) ? col.parentPath + folderName : col.parentPath + sep + folderName;
    setNewDirectory(newPath);

    // Fetch children of clicked folder
    const r = await listDir(newPath);
    const newColumns = folderColumns.slice(0, columnIndex);
    newColumns.push({ ...col, selected: folderName });
    newColumns.push({ parentPath: newPath, dirs: r.ok ? r.dirs : [], selected: null });
    setFolderColumns(newColumns);
    requestAnimationFrame(() => {
      if (folderBrowserRef.current) folderBrowserRef.current.scrollLeft = folderBrowserRef.current.scrollWidth;
    });
  }, [folderColumns]);

  const toggleFolderBrowser = useCallback(async () => {
    if (!folderBrowserOpen) {
      const dir = newDirectory.trim() || defaultDir;
      if (dir) await buildFolderColumns(dir);
    }
    setFolderBrowserOpen(prev => !prev);
  }, [folderBrowserOpen, newDirectory, defaultDir, buildFolderColumns]);

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

  const setNickname = useCallback((handle: string, name: string) => {
    setNicknames(prev => {
      const next = new Map(prev);
      if (name) {
        next.set(handle, name);
      } else {
        next.delete(handle);
      }
      saveNicknames(next);
      return next;
    });
  }, []);

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
    const cmd = newCommand.trim() || undefined;
    const dir = newDirectory.trim() || undefined;
    await newConsole(undefined, cmd, dir);
    // Save to history (dedup by command+directory)
    if (cmd || dir) {
      const record: NewConsoleRecord = { command: cmd || '', directory: dir || '' };
      setNewConsoleHistory(prev => {
        const deduped = prev.filter(r => r.command !== record.command || r.directory !== record.directory);
        const next = [record, ...deduped].slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    }
    setNewCommand('');
    setNewDirectory('');
    setShowNewConsoleForm(false);
    setShowHistory(false);
    setFolderBrowserOpen(false);
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
            nickname={nicknames.get(w.handle)}
            onSetNickname={(name) => setNickname(w.handle, name)}
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
              nickname={nicknames.get(w.handle)}
              onSetNickname={() => {}}
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
            nickname={nicknames.get(w.handle)}
            onSetNickname={(name) => setNickname(w.handle, name)}
          />
        </div>
      );
    }

    return items;
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1><img src="/logo.svg" alt="" style={{ width: 28, height: 28, verticalAlign: 'middle', marginRight: 10 }} />ConsolePanel</h1>
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
          <button
            onClick={() => setShowNewConsoleForm(!showNewConsoleForm)}
            className={showNewConsoleForm ? 'new-console-btn-active' : 'primary'}
          >
            <FiPlus style={{ marginRight: 8 }} /> New Console
          </button>
        </div>
      </header>

      {showNewConsoleForm && (
        <div className="new-console-form">
          <div className="new-console-fields">
            <input
              type="text"
              value={newCommand}
              onChange={e => setNewCommand(e.target.value)}
              placeholder="cmd.exe"
              onKeyDown={e => { if (e.key === 'Enter') handleNewConsole(); }}
            />
            <div className="dir-input-row">
              <input
                type="text"
                value={newDirectory}
                onChange={e => { setNewDirectory(e.target.value); setFolderBrowserOpen(false); }}
                placeholder="Working directory"
                onKeyDown={e => { if (e.key === 'Enter') handleNewConsole(); }}
              />
              <button className="folder-toggle-btn" onClick={toggleFolderBrowser} title="Browse folders">
                <FiFolder />
              </button>
            </div>
            {folderBrowserOpen && folderColumns.length > 0 && (
              <div className="folder-browser" ref={folderBrowserRef}>
                {folderColumns.map((col, ci) => (
                  <div className="folder-column" key={ci}>
                    {col.dirs.map(d => (
                      <div
                        key={d}
                        className={'folder-column-item' + (d === col.selected ? ' selected' : '')}
                        onClick={() => handleFolderClick(ci, d)}
                      >
                        {d}
                      </div>
                    ))}
                    {col.dirs.length === 0 && <div className="folder-column-empty">Empty</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="new-console-actions">
            {newConsoleHistory.length > 0 && (
              <button className="history-btn" onClick={() => setShowHistory(!showHistory)}>
                <FiClock style={{ marginRight: 4 }} /> History
              </button>
            )}
            <button className="primary" onClick={handleNewConsole}>Create</button>
            <button onClick={() => { setShowNewConsoleForm(false); setShowHistory(false); setFolderBrowserOpen(false); }}>Cancel</button>
          </div>
          {showHistory && newConsoleHistory.length > 0 && (
            <div className="history-dropdown">
              {newConsoleHistory.map((r, i) => (
                <div
                  key={i}
                  className="history-item"
                  onClick={() => { setNewCommand(r.command); setNewDirectory(r.directory); setShowHistory(false); }}
                >
                  <span className="history-item-cmd">{r.command || 'cmd.exe'}</span>
                  {r.directory && <span className="history-item-dir">{r.directory}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
