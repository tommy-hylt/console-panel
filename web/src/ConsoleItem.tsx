import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiChevronRight, FiChevronDown, FiStar,
  FiX, FiSend, FiRefreshCw,
  FiExternalLink, FiType, FiCommand, FiEdit2,
  FiCrosshair, FiClock, FiTerminal
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
  const [inputMode, setInputMode] = useState<'none' | 'command' | 'text' | 'key'>('none');
  const [textValue, setTextValue] = useState('');
  const [keyValue, setKeyValue] = useState('enter');
  const [keyHistory, setKeyHistory] = useState<string[]>(['enter', 'escape']);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [keyListenMode, setKeyListenMode] = useState(false);
  const [textHistory, setTextHistory] = useState<string[]>([]);
  const [showTextHistory, setShowTextHistory] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
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

  const addToTextHistory = (text: string) => {
    setTextHistory(prev => {
      const filtered = prev.filter(t => t !== text);
      return [text, ...filtered].slice(0, 3);
    });
  };

  const handleSendText = async () => {
    if (!textValue.trim()) return;
    const value = textValue;
    addToTextHistory(value);
    setTextValue('');
    setLoading(true);
    await typeText(winInfo.handle, value);
    setLoading(false);
  };

  const handleTextHistoryClick = (historyText: string) => {
    if (textValue.trim()) {
      addToTextHistory(textValue);
    }
    setTextValue(historyText);
    setShowTextHistory(false);
  };

  const handleSendCommand = async () => {
    if (!textValue.trim()) return;
    const value = textValue;
    addToTextHistory(value);
    setTextValue('');
    setLoading(true);
    await typeText(winInfo.handle, value);
    await pressKey(winInfo.handle, 'enter');
    setLoading(false);
  };

  const addToKeyHistory = (key: string) => {
    setKeyHistory(prev => {
      const filtered = prev.filter(k => k !== key);
      return [key, ...filtered].slice(0, 5);
    });
  };

  const handleSendKey = async (value?: string) => {
    const v = value ?? keyValue;
    if (!v.trim()) return;
    setLoading(true);
    // Normalize: "Ctrl + C" -> "ctrl+c"
    const normalized = v.split('+').map(p => p.trim().toLowerCase()).filter(Boolean).join('+');
    addToKeyHistory(normalized);
    setKeyValue(normalized);
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
    setKeyValue(keyStr);
    handleSendKey(keyStr);
  };

  const toggleKeyListenMode = () => {
    const next = !keyListenMode;
    setKeyListenMode(next);
    if (next) {
      setTimeout(() => keyInputRef.current?.focus(), 0);
    }
  };

  const handleKill = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingClose(true);
  };

  const handleConfirmKill = async () => {
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

      {confirmingClose && (
        <div className="confirm-bar">
          <span>Confirm to close this console?</span>
          <div className="confirm-bar-actions">
            <button className="danger" onClick={handleConfirmKill}>Yes</button>
            <button onClick={() => setConfirmingClose(false)}>No</button>
          </div>
        </div>
      )}

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
                <button className={inputMode === 'command' ? 'active' : ''} onClick={() => setInputMode(inputMode === 'command' ? 'none' : 'command')}>
                  <FiTerminal style={{ marginRight: 8 }} /> Command{loading && inputMode === 'command' ? '...' : ''}
                </button>
                <button className={inputMode === 'text' ? 'active' : ''} onClick={() => setInputMode(inputMode === 'text' ? 'none' : 'text')}>
                  <FiType style={{ marginRight: 8 }} /> Text{loading && inputMode === 'text' ? '...' : ''}
                </button>
                <button className={inputMode === 'key' ? 'active' : ''} onClick={() => setInputMode(inputMode === 'key' ? 'none' : 'key')}>
                  <FiCommand style={{ marginRight: 8 }} /> Key{loading && inputMode === 'key' ? '...' : ''}
                </button>
              </div>

              {inputMode !== 'none' && (
                <div className="input-section">
                  {inputMode === 'command' || inputMode === 'text' ? (
                    <>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <textarea
                          value={textValue}
                          onChange={(e) => setTextValue(e.target.value)}
                          placeholder={inputMode === 'command' ? 'Enter command to send...' : 'Enter text to type...'}
                          rows={3}
                          onKeyDown={inputMode === 'command' ? (e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSendCommand(); } } : undefined}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button
                            onClick={inputMode === 'command' ? handleSendCommand : handleSendText}
                            disabled={loading || !textValue.trim()}
                            className="primary"
                            style={{ flex: 1 }}
                          >
                            <FiSend />
                          </button>
                          {textHistory.length > 0 && (
                            <button className="history-btn" onClick={() => setShowTextHistory(!showTextHistory)} title="Text history">
                              <FiClock />
                            </button>
                          )}
                        </div>
                      </div>
                      {showTextHistory && textHistory.length > 0 && (
                        <div className="text-history-list">
                          {textHistory.map((t, i) => (
                            <div key={i} className="text-history-item" onClick={() => handleTextHistoryClick(t)}>
                              {t}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="key-grid">
                      <button
                        onClick={toggleKeyListenMode}
                        className={keyListenMode ? 'active' : ''}
                        title={keyListenMode ? 'Stop listening' : 'Key listen mode'}
                      >
                        <FiCrosshair />
                      </button>
                      <input
                        ref={keyInputRef}
                        type="text"
                        value={keyValue}
                        onChange={(e) => { if (!keyListenMode) setKeyValue(e.target.value); }}
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
                      <button onClick={() => handleSendKey()} disabled={loading || !keyValue.trim()} className="primary">
                        <FiSend />
                      </button>
                      {keyHistory.length > 0 && (
                        <div className="key-history">
                          {keyHistory.map(k => (
                            <button key={k} className="key-history-tag" onClick={() => setKeyValue(k)}>
                              {k}
                            </button>
                          ))}
                        </div>
                      )}
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