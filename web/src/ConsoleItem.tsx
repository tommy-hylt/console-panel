import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FiChevronRight, FiChevronDown, FiArrowUp, FiArrowDown, 
  FiChevronsUp, FiChevronsDown, FiX, FiSend, FiRefreshCw,
  FiExternalLink, FiType, FiCommand
} from 'react-icons/fi';
import type { WindowInfo } from './api';
import { captureWindow, foregroundWindow, typeText, pressKey, killWindow } from './api';

// Refresh intervals
const EXPANDED_REFRESH_MS = 2000;    // 2 seconds when expanded
const THUMBNAIL_REFRESH_MS = 15000; // 15 seconds in grid mode

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
  index: number; // For staggering refresh
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
  index,
}: ConsoleItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'none' | 'text' | 'key'>('none');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const initialLoadRef = useRef(false);

  // Should capture when expanded OR in thumbnail mode
  const shouldCapture = expanded || thumbnailMode;

  // Get refresh interval based on mode
  const getRefreshInterval = useCallback(() => {
    if (expanded) return EXPANDED_REFRESH_MS;
    if (thumbnailMode) return THUMBNAIL_REFRESH_MS;
    return EXPANDED_REFRESH_MS;
  }, [expanded, thumbnailMode]);

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
    // Schedule next refresh
    refreshTimeoutRef.current = setTimeout(refreshCapture, getRefreshInterval()) as unknown as number;
  }, [shouldCapture, winInfo.handle, getRefreshInterval]);

  useEffect(() => {
    if (shouldCapture) {
      // Stagger initial load
      const staggerDelay = thumbnailMode && !expanded ? index * 1000 : 0;

      if (!initialLoadRef.current || expanded) {
        initialLoadRef.current = true;
        refreshTimeoutRef.current = setTimeout(refreshCapture, staggerDelay) as unknown as number;
      }
    } else {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      initialLoadRef.current = false;
    }
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [shouldCapture, expanded, thumbnailMode, index, refreshCapture]);

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

  const toggleExpanded = () => setExpanded(!expanded);

  const isActuallyExpanded = expanded || thumbnailMode;

  return (
    <div className="console-card">
      <div className="card-header" onClick={toggleExpanded}>
        {!thumbnailMode && (expanded ? <FiChevronDown /> : <FiChevronRight />)}
        <span className="card-title" style={{ marginLeft: thumbnailMode ? 0 : 8 }}>{winInfo.title}</span>
        <span className="card-handle">{winInfo.handle}</span>

        <div className="card-actions" onClick={e => e.stopPropagation()}>
          <button onClick={handleForeground} title="Bring to Foreground">
            <FiExternalLink />
          </button>
          {!thumbnailMode && (
            <>
              <button onClick={onMoveTop} disabled={isFirst} title="Move to Top">
                <FiChevronsUp />
              </button>
              <button onClick={onMoveUp} disabled={isFirst} title="Move Up">
                <FiArrowUp />
              </button>
              <button onClick={onMoveDown} disabled={isLast} title="Move Down">
                <FiArrowDown />
              </button>
              <button onClick={onMoveBottom} disabled={isLast} title="Move to Bottom">
                <FiChevronsDown />
              </button>
            </>
          )}
          <button onClick={handleKill} className="danger" title="Close Window">
            <FiX />
          </button>
        </div>
      </div>

      {isActuallyExpanded && (
        <div className="card-content">
          <div className="screenshot-container">
            {imageUrl ? (
              <img src={imageUrl} alt="Console Preview" />
            ) : (
              <div style={{ color: '#64748b', fontSize: '14px' }}>
                <FiRefreshCw className="spin" style={{ marginRight: 8 }} />
                Loading Preview...
              </div>
            )}
          </div>

          {!thumbnailMode && (
            <>
              <div className="action-bar">
                <button onClick={() => { setInputMode(inputMode === 'text' ? 'none' : 'text'); setInputValue(''); }}>
                  <FiType style={{ marginRight: 8 }} /> Input Text
                </button>
                <button onClick={() => { setInputMode(inputMode === 'key' ? 'none' : 'key'); setInputValue(''); }}>
                  <FiCommand style={{ marginRight: 8 }} /> Press Key
                </button>
              </div>

              {inputMode !== 'none' && (
                <div className="input-section">
                  {inputMode === 'text' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Enter text to type..."
                        rows={3}
                      />
                      <button onClick={handleSendText} disabled={loading || !inputValue.trim()} className="primary">
                        <FiSend />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Key (e.g., enter, ctrl+c)"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendKey(); }}
                      />
                      <button onClick={handleSendKey} disabled={loading || !inputValue.trim()} className="primary">
                        <FiSend />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}