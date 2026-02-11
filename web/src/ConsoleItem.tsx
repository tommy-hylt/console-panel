import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiChevronRight, FiChevronDown, FiStar,
  FiX, FiSend, FiRefreshCw,
  FiExternalLink, FiType, FiCommand, FiEdit2,
  FiCrosshair
} from 'react-icons/fi';
import type { WindowInfo } from './api';
import { captureWindow, foregroundWindow, typeText, pressKey, killWindow } from './api';

// Refresh intervals
const EXPANDED_REFRESH_MS = 2000;    // 2 seconds when expanded
const THUMBNAIL_REFRESH_MS = 15000; // 15 seconds in grid mode

interface ConsoleItemProps {
  winInfo: WindowInfo;
  isStarred: boolean;
  onToggleStar: () => void;
  onRemove: () => void;
  thumbnailMode: boolean;
  index: number; // For staggering refresh
  nickname?: string;
  onSetNickname: (name: string) => void;
}

export function ConsoleItem({
  winInfo,
  isStarred,
  onToggleStar,
  onRemove,
  thumbnailMode,
  index,
  nickname,
  onSetNickname,
}: ConsoleItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'none' | 'text' | 'key'>('none');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [keyListenMode, setKeyListenMode] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const refreshCaptureRef = useRef<() => void>(null);
  const initialLoadRef = useRef(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

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
    // Schedule next refresh via ref to avoid self-reference
    refreshTimeoutRef.current = setTimeout(() => refreshCaptureRef.current?.(), getRefreshInterval()) as unknown as number;
  }, [shouldCapture, winInfo.handle, getRefreshInterval]);
  refreshCaptureRef.current = refreshCapture;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- imageUrl intentionally excluded to avoid infinite loop
  }, [shouldCapture, expanded, thumbnailMode, index, refreshCapture]);

  const handleForeground = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await foregroundWindow(winInfo.handle);
  };

  const handleSendText = async () => {
    if (!inputValue.trim()) return;
    const value = inputValue;
    setInputValue('');
    setLoading(true);
    await typeText(winInfo.handle, value);
    setLoading(false);
  };

  const handleSendKey = async (value?: string) => {
    const v = value ?? inputValue;
    if (!v.trim()) return;
    setLoading(true);
    // Normalize: "Ctrl + C" -> "ctrl+c"
    const normalized = v.split('+').map(p => p.trim().toLowerCase()).filter(Boolean).join('+');
    await pressKey(winInfo.handle, normalized);
    setLoading(false);
  };

  const handleKeyListen = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!keyListenMode) return;
    e.preventDefault();
    // Build key name from event
    const parts: string[] = [];
    if (e.ctrlKey && e.key !== 'Control') parts.push('ctrl');
    if (e.altKey && e.key !== 'Alt') parts.push('alt');
    if (e.shiftKey && e.key !== 'Shift') parts.push('shift');
    // Ignore standalone modifier presses
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase().replace('arrow', ''));
    const keyStr = parts.join('+');
    setInputValue(keyStr);
    handleSendKey(keyStr);
  };

  const toggleKeyListenMode = () => {
    const next = !keyListenMode;
    setKeyListenMode(next);
    if (next) {
      setTimeout(() => keyInputRef.current?.focus(), 0);
    }
  };

  const handleKill = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Close "${winInfo.title}"?`)) return;
    await killWindow(winInfo.handle);
    onRemove();
  };

  const handleManualRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    // Cancel pending auto-refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    try {
      const blob = await captureWindow(winInfo.handle);
      const url = URL.createObjectURL(blob);
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      console.error('Manual refresh failed:', e);
    }
    setRefreshing(false);
    // Restart auto-refresh timer
    if (shouldCapture) {
      refreshTimeoutRef.current = setTimeout(() => refreshCaptureRef.current?.(), getRefreshInterval()) as unknown as number;
    }
  };

  const handleNicknameEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNickname(true);
    setTimeout(() => nicknameInputRef.current?.focus(), 0);
  };

  const handleNicknameSave = (value: string) => {
    onSetNickname(value.trim());
    setEditingNickname(false);
  };

  const handleNicknameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleNicknameSave(e.currentTarget.value);
    } else if (e.key === 'Escape') {
      setEditingNickname(false);
    }
  };

  const toggleExpanded = () => setExpanded(!expanded);

  const isActuallyExpanded = expanded || thumbnailMode;

  return (
    <div className="console-card">
      <div className="card-header" onClick={toggleExpanded}>
        <div className="card-title-row">
          {!thumbnailMode && (expanded ? <FiChevronDown /> : <FiChevronRight />)}
          <button className="nickname-edit-btn" onClick={handleNicknameEdit} title="Edit nickname">
            <FiEdit2 />
          </button>
          {editingNickname ? (
            <input
              ref={nicknameInputRef}
              className="nickname-edit-input"
              type="text"
              defaultValue={nickname || ''}
              placeholder="Enter nickname..."
              onBlur={(e) => handleNicknameSave(e.currentTarget.value)}
              onKeyDown={handleNicknameKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="card-title-text" style={{ marginLeft: thumbnailMode ? 0 : undefined }}>
              {nickname && <span className="card-nickname">{nickname}</span>}
              {nickname && <span style={{ color: '#525f7f', flexShrink: 0 }}>—</span>}
              <span className="card-title">{winInfo.title}</span>
            </div>
          )}
        </div>
        <div className="card-controls-row">
          <span className="card-handle">{winInfo.handle} · PID {winInfo.pid}</span>
          <div className="card-actions" onClick={e => e.stopPropagation()}>
            <button onClick={handleManualRefresh} title="Refresh capture">
              <FiRefreshCw className={refreshing ? 'spin' : ''} />
            </button>
            <button onClick={handleForeground} title="Bring to Foreground">
              <FiExternalLink />
            </button>
            <button
              onClick={onToggleStar}
              className={isStarred ? 'star-btn starred' : 'star-btn'}
              title={isStarred ? 'Unstar' : 'Star'}
            >
              <FiStar />
            </button>
            <button onClick={handleKill} className="danger" title="Close Window">
              <FiX />
            </button>
          </div>
        </div>
      </div>

      {isActuallyExpanded && (
        <div className="card-content">
          <div className="screenshot-container">
            {imageUrl ? (
              <img src={imageUrl} alt="Console Preview" />
            ) : (
              <div style={{ color: '#525f7f', fontSize: '14px' }}>
                <FiRefreshCw className="spin" style={{ marginRight: 8 }} />
                Loading Preview...
              </div>
            )}
          </div>

          {!thumbnailMode && (
            <>
              <div className="action-bar">
                <button className={inputMode === 'text' ? 'active' : ''} onClick={() => { setInputMode(inputMode === 'text' ? 'none' : 'text'); if (inputMode !== 'text') setInputValue(''); }}>
                  <FiType style={{ marginRight: 8 }} /> Input Text{loading && inputMode !== 'key' ? '...' : ''}
                </button>
                <button className={inputMode === 'key' ? 'active' : ''} onClick={() => { setInputMode(inputMode === 'key' ? 'none' : 'key'); if (inputMode !== 'key') setInputValue('enter'); }}>
                  <FiCommand style={{ marginRight: 8 }} /> Press Key{loading && inputMode !== 'text' ? '...' : ''}
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={toggleKeyListenMode}
                        className={keyListenMode ? 'active' : ''}
                        title={keyListenMode ? 'Stop listening' : 'Key listen mode'}
                        style={{ flexShrink: 0 }}
                      >
                        <FiCrosshair />
                      </button>
                      <input
                        ref={keyInputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => { if (!keyListenMode) setInputValue(e.target.value); }}
                        placeholder={keyListenMode ? 'Press any key...' : 'Key (e.g., enter, ctrl+c)'}
                        onKeyDown={(e) => {
                          if (keyListenMode) {
                            handleKeyListen(e);
                          } else if (e.key === 'Enter') {
                            handleSendKey();
                          }
                        }}
                        onBlur={() => setKeyListenMode(false)}
                        readOnly={keyListenMode}
                      />
                      <button onClick={() => handleSendKey()} disabled={loading || !inputValue.trim()} className="primary">
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