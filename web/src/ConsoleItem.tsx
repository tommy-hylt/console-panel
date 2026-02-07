import { useState, useEffect, useRef, useCallback } from 'react';
import { FiChevronRight, FiChevronDown, FiArrowUp, FiArrowDown, FiChevronsUp, FiChevronsDown, FiX, FiSend, FiRefreshCw } from 'react-icons/fi';
import type { WindowInfo } from './api';
import { captureWindow, foregroundWindow, typeText, pressKey, killWindow } from './api';

interface ConsoleItemProps {
  winInfo: WindowInfo;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveTop: () => void;
  onMoveBottom: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
  thumbnailMode: boolean;
}

export function ConsoleItem({
  winInfo,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onMoveBottom,
  onRemove,
  isFirst,
  isLast,
  thumbnailMode,
}: ConsoleItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'none' | 'text' | 'key'>('none');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);

  // Should capture when expanded OR in thumbnail mode
  const shouldCapture = expanded || thumbnailMode;

  const refreshCapture = useCallback(async () => {
    if (!shouldCapture) return;
    try {
      const blob = await captureWindow(winInfo.handle);
      const url = URL.createObjectURL(blob);
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      console.error('Capture failed:', e);
    }
    // Schedule next refresh 1s after this response
    refreshTimeoutRef.current = setTimeout(refreshCapture, 1000) as unknown as number;
  }, [shouldCapture, winInfo.handle]);

  useEffect(() => {
    if (shouldCapture) {
      refreshCapture();
    } else {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
    }
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [shouldCapture]);

  const handleForeground = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await foregroundWindow(winInfo.handle);
  };

  const handleSendText = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    await typeText(winInfo.handle, inputValue);
    setInputValue('');
    setLoading(false);
  };

  const handleSendKey = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    await pressKey(winInfo.handle, inputValue);
    setInputValue('');
    setLoading(false);
  };

  const handleKill = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Close "${winInfo.title}"?`)) return;
    await killWindow(winInfo.handle);
    onRemove();
  };

  // Thumbnail view
  if (thumbnailMode && !expanded) {
    return (
      <div
        style={{
          border: '1px solid #ccc',
          marginBottom: 8,
          borderRadius: 4,
          width: '100%',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(true)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: 8, gap: 12 }}>
          {/* Thumbnail */}
          <div style={{ width: 200, flexShrink: 0 }}>
            {imageUrl ? (
              <img src={imageUrl} alt="Thumbnail" style={{ width: '100%', border: '1px solid #ddd', borderRadius: 2 }} />
            ) : (
              <div style={{ width: '100%', height: 120, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12 }}>
                Loading...
              </div>
            )}
          </div>
          {/* Info and buttons */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {winInfo.title}
            </div>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>{winInfo.handle}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={handleForeground} title="Foreground">
                <FiRefreshCw />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onMoveTop(); }} disabled={isFirst} title="Move to top">
                <FiChevronsUp />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} title="Move up">
                <FiArrowUp />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} title="Move down">
                <FiArrowDown />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onMoveBottom(); }} disabled={isLast} title="Move to bottom">
                <FiChevronsDown />
              </button>
              <button onClick={handleKill} title="Close console" style={{ color: 'red' }}>
                <FiX />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal list view
  return (
    <div style={{ border: '1px solid #ccc', marginBottom: 8, borderRadius: 4, width: '100%' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#f5f5f5',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <FiChevronDown /> : <FiChevronRight />}
        <span style={{ marginLeft: 8, flex: 1, fontWeight: 500 }}>{winInfo.title}</span>
        <span style={{ color: '#888', fontSize: 12, marginRight: 12 }}>{winInfo.handle}</span>

        {/* Ordering buttons */}
        <button onClick={(e) => { e.stopPropagation(); onMoveTop(); }} disabled={isFirst} title="Move to top">
          <FiChevronsUp />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} title="Move up">
          <FiArrowUp />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} title="Move down">
          <FiArrowDown />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMoveBottom(); }} disabled={isLast} title="Move to bottom">
          <FiChevronsDown />
        </button>
        <button onClick={handleKill} title="Close console" style={{ marginLeft: 8, color: 'red' }}>
          <FiX />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: 12 }}>
          {/* Screenshot */}
          <div style={{ marginBottom: 12, textAlign: 'center' }}>
            {imageUrl ? (
              <img src={imageUrl} alt="Console capture" style={{ maxWidth: '100%', border: '1px solid #ddd' }} />
            ) : (
              <div style={{ padding: 40, color: '#888' }}>Loading...</div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={handleForeground}>
              <FiRefreshCw style={{ marginRight: 4 }} /> Foreground
            </button>
            <button onClick={() => { setInputMode(inputMode === 'text' ? 'none' : 'text'); setInputValue(''); }}>
              Input Text
            </button>
            <button onClick={() => { setInputMode(inputMode === 'key' ? 'none' : 'key'); setInputValue(''); }}>
              Press Key
            </button>
          </div>

          {/* Input area */}
          {inputMode === 'text' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter text to type..."
                style={{ flex: 1, minHeight: 60 }}
              />
              <button onClick={handleSendText} disabled={loading}>
                <FiSend />
              </button>
            </div>
          )}

          {inputMode === 'key' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Key (e.g., enter, ctrl+c)"
                style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendKey(); }}
              />
              <button onClick={handleSendKey} disabled={loading}>
                <FiSend />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
