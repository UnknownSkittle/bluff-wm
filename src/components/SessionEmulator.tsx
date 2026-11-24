import {useEffect, useMemo, useRef, useState} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Folder,
  Maximize2,
  Plus,
  Search,
  Terminal,
  X,
} from 'lucide-react';
import type {
  AppKind,
  BluffAppearance,
  OptInFlags,
  StripColumn,
  WindowInstance,
} from '../types/bluff';
import {ROFI_CATALOG} from '../types/bluff';

interface SessionEmulatorProps {
  appearance: BluffAppearance;
  optIn: OptInFlags;
  totalMib: number;
}

const INITIAL_COLUMNS: StripColumn[] = [
  {
    id: 'col-1',
    widthFraction: 0.5,
    maximized: false,
    windows: [
      {
        id: 'win-1',
        app: 'alacritty',
        title: 'alacritty — ~/bluff-compositor',
        fullscreen: false,
      },
    ],
  },
  {
    id: 'col-2',
    widthFraction: 0.5,
    maximized: false,
    windows: [
      {
        id: 'win-2',
        app: 'thunar',
        title: 'thunar — ~/.config/bluff',
        fullscreen: false,
      },
    ],
  },
];

const WIDTH_PRESETS = [0.3333, 0.5, 0.6667];

export function SessionEmulator({appearance, optIn, totalMib}: SessionEmulatorProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rofiInputRef = useRef<HTMLInputElement | null>(null);

  const [columns, setColumns] = useState<StripColumn[]>(INITIAL_COLUMNS);
  const [focusedColIdx, setFocusedColIdx] = useState(0);
  const [focusedWinIdx, setFocusedWinIdx] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(960);

  const [rofiOpen, setRofiOpen] = useState(false);
  const [rofiQuery, setRofiQuery] = useState('');
  const [rofiSelectedIdx, setRofiSelectedIdx] = useState(0);
  const [spawnTarget, setSpawnTarget] = useState<'new-column' | 'stack-column'>('new-column');

  const [terminalLogs, setTerminalLogs] = useState<Record<string, string[]>>({
    'win-1': [
      'BLUFF Wayland Session (Zig 0.13) · Author: Unknown_Skittle',
      `Idle RSS: ${totalMib.toFixed(1)} MiB / 40.0 MiB max`,
      'Press Super+Space (or Alt+Space) for Rofi · Type "help" below',
    ],
  });
  const [terminalInputs, setTerminalInputs] = useState<Record<string, string>>({});
  const [thunarDirByWin, setThunarDirByWin] = useState<Record<string, string>>({
    'win-2': '~/.config/bluff',
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateSize = () => setViewportWidth(el.clientWidth);
    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (rofiOpen) {
      setTimeout(() => rofiInputRef.current?.focus(), 20);
    }
  }, [rofiOpen]);

  const filteredRofi = useMemo(() => {
    const q = rofiQuery.trim().toLowerCase();
    if (!q) return ROFI_CATALOG;
    return ROFI_CATALOG.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.exec.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [rofiQuery]);

  const spawnApp = (app: AppKind, mode: 'new-column' | 'stack-column' = spawnTarget) => {
    const id = `win-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const titleMap: Record<AppKind, string> = {
      alacritty: 'alacritty — zsh',
      thunar: 'thunar — ~/.config/bluff',
      btop: 'btop — process monitor',
      foot: 'foot — /bin/sh',
      imv: 'imv — monochrome_grid.png',
      zathura: 'zathura — wayland-protocol.pdf',
    };
    const newWin: WindowInstance = {
      id,
      app,
      title: titleMap[app],
      fullscreen: false,
    };

    if (app === 'alacritty' || app === 'foot') {
      setTerminalLogs((prev) => ({
        ...prev,
        [id]: [
          `${app} connected to BLUFF wayland-0`,
          'Type "help", "bluff-ctl memory", or "neofetch"',
        ],
      }));
    }

    setColumns((prev) => {
      if (prev.length === 0 || mode === 'new-column') {
        const insertAt = prev.length === 0 ? 0 : Math.min(focusedColIdx + 1, prev.length);
        const nextCol: StripColumn = {
          id: `col-${Date.now()}`,
          widthFraction: 0.5,
          maximized: false,
          windows: [newWin],
        };
        const next = [...prev.slice(0, insertAt), nextCol, ...prev.slice(insertAt)];
        setFocusedColIdx(insertAt);
        setFocusedWinIdx(0);
        return next;
      }

      const next = prev.map((col, idx) =>
        idx === focusedColIdx ? {...col, windows: [...col.windows, newWin]} : col,
      );
      setFocusedWinIdx(next[focusedColIdx].windows.length - 1);
      return next;
    });

    setRofiOpen(false);
    setRofiQuery('');
    setRofiSelectedIdx(0);
  };

  const closeFocusedWindow = () => {
    setColumns((prev) => {
      if (prev.length === 0) return prev;
      const col = prev[focusedColIdx];
      if (!col) return prev;
      const remaining = col.windows.filter((_, idx) => idx !== focusedWinIdx);
      if (remaining.length === 0) {
        const nextCols = prev.filter((_, idx) => idx !== focusedColIdx);
        const nextIdx = Math.max(0, Math.min(focusedColIdx, nextCols.length - 1));
        setFocusedColIdx(nextIdx);
        setFocusedWinIdx(0);
        return nextCols;
      }
      const nextCols = prev.map((c, idx) =>
        idx === focusedColIdx ? {...c, windows: remaining} : c,
      );
      setFocusedWinIdx(Math.max(0, Math.min(focusedWinIdx, remaining.length - 1)));
      return nextCols;
    });
  };

  const focusColumnDelta = (delta: number) => {
    if (columns.length === 0) return;
    const next = Math.max(0, Math.min(columns.length - 1, focusedColIdx + delta));
    setFocusedColIdx(next);
    setFocusedWinIdx(0);
  };

  const moveColumnDelta = (delta: number) => {
    if (columns.length < 2) return;
    const target = Math.max(0, Math.min(columns.length - 1, focusedColIdx + delta));
    if (target === focusedColIdx) return;
    setColumns((prev) => {
      const copy = [...prev];
      const temp = copy[focusedColIdx];
      copy[focusedColIdx] = copy[target];
      copy[target] = temp;
      return copy;
    });
    setFocusedColIdx(target);
  };

  const cyclePresetWidth = () => {
    if (columns.length === 0) return;
    setColumns((prev) =>
      prev.map((col, idx) => {
        if (idx !== focusedColIdx) return col;
        const currentPresetIdx = WIDTH_PRESETS.findIndex(
          (p) => Math.abs(p - col.widthFraction) < 0.05,
        );
        const nextPreset = WIDTH_PRESETS[(currentPresetIdx + 1) % WIDTH_PRESETS.length];
        return {...col, maximized: false, widthFraction: nextPreset};
      }),
    );
  };

  const toggleMaximizeColumn = () => {
    if (columns.length === 0) return;
    setColumns((prev) =>
      prev.map((col, idx) =>
        idx === focusedColIdx ? {...col, maximized: !col.maximized} : col,
      ),
    );
  };

  const consumeOrExpel = () => {
    if (columns.length === 0) return;
    const col = columns[focusedColIdx];
    if (!col) return;
    if (col.windows.length > 1) {
      // Expel focused window to a new column
      const expelled = col.windows[focusedWinIdx];
      setColumns((prev) => {
        const updated = prev.map((c, idx) =>
          idx === focusedColIdx
            ? {...c, windows: c.windows.filter((_, wi) => wi !== focusedWinIdx)}
            : c,
        );
        const newCol: StripColumn = {
          id: `col-${Date.now()}`,
          widthFraction: col.widthFraction,
          maximized: false,
          windows: [expelled],
        };
        return [
          ...updated.slice(0, focusedColIdx + 1),
          newCol,
          ...updated.slice(focusedColIdx + 1),
        ];
      });
      setFocusedColIdx(focusedColIdx + 1);
      setFocusedWinIdx(0);
    } else if (focusedColIdx + 1 < columns.length) {
      // Consume first window of right neighbor into focused column
      const neighbor = columns[focusedColIdx + 1];
      if (neighbor.windows.length === 0) return;
      const pulled = neighbor.windows[0];
      setColumns((prev) => {
        const next: StripColumn[] = [];
        prev.forEach((c, idx) => {
          if (idx === focusedColIdx) {
            next.push({...c, windows: [...c.windows, pulled]});
          } else if (idx === focusedColIdx + 1) {
            const rest = c.windows.slice(1);
            if (rest.length > 0) next.push({...c, windows: rest});
          } else {
            next.push(c);
          }
        });
        return next;
      });
    }
  };

  // Global keyboard shortcuts when focused inside workbench (Alt+... works reliably alongside Super/Meta)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingInInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if ((e.metaKey || e.altKey) && e.code === 'Space') {
        e.preventDefault();
        setRofiOpen((open) => !open);
        return;
      }

      if (rofiOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setRofiOpen(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setRofiSelectedIdx((i) => Math.min(filteredRofi.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setRofiSelectedIdx((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter' && filteredRofi[rofiSelectedIdx]) {
          e.preventDefault();
          spawnApp(filteredRofi[rofiSelectedIdx].app);
        }
        return;
      }

      if (isTypingInInput) return;

      if ((e.metaKey || e.altKey) && e.key === 'Enter') {
        e.preventDefault();
        spawnApp('alacritty');
      } else if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        spawnApp('thunar');
      } else if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        closeFocusedWindow();
      } else if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        cyclePresetWidth();
      } else if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleMaximizeColumn();
      } else if ((e.metaKey || e.altKey) && e.shiftKey && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        moveColumnDelta(-1);
      } else if ((e.metaKey || e.altKey) && e.shiftKey && (e.key === 'ArrowRight' || e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        moveColumnDelta(1);
      } else if ((e.metaKey || e.altKey) && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        focusColumnDelta(-1);
      } else if ((e.metaKey || e.altKey) && (e.key === 'ArrowRight' || e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        focusColumnDelta(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Compute exact scrolling camera offset matching src/scrolling.zig logic
  const usableWidth = Math.max(320, viewportWidth - appearance.outerPadding * 2);
  const colWidths = columns.map((col) =>
    col.maximized ? usableWidth : Math.max(220, Math.round(usableWidth * col.widthFraction)),
  );

  let scrollOffsetX = 0;
  if (columns.length > 0 && focusedColIdx < columns.length) {
    let focusedStartX = appearance.outerPadding;
    for (let i = 0; i < focusedColIdx; i++) {
      focusedStartX += colWidths[i] + appearance.columnGap;
    }
    const focusedW = colWidths[focusedColIdx];
    const centerOffset = focusedStartX + focusedW / 2 - viewportWidth / 2;
    const totalStripWidth =
      appearance.outerPadding * 2 +
      colWidths.reduce((a, b) => a + b, 0) +
      Math.max(0, columns.length - 1) * appearance.columnGap;
    const maxScroll = Math.max(0, totalStripWidth - viewportWidth);
    scrollOffsetX = Math.max(0, Math.min(maxScroll, centerOffset));
  }

  const runTerminalCommand = (winId: string, rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;
    let output: string[] = [];
    if (cmd === 'clear') {
      setTerminalLogs((prev) => ({...prev, [winId]: []}));
      return;
    } else if (cmd === 'help') {
      output = [
        'Commands: help, neofetch, bluff-ctl memory, ls, uname -a, clear',
      ];
    } else if (cmd === 'neofetch') {
      output = [
        'Unknown_Skittle@bluff-tty1',
        'OS: Linux x86_64 · Compositor: BLUFF (Zig)',
        `Idle RSS: ${totalMib.toFixed(1)} MiB (limit: 40.0 MiB)`,
        'Apps: Alacritty / Thunar / Rofi (Super+Space)',
        `Opt-In: xwayland=${optIn.xwayland} · portal=${optIn.portal}`,
      ];
    } else if (cmd === 'bluff-ctl memory') {
      output = [
        `VmRSS: ${totalMib.toFixed(1)} MiB / 40.0 MiB ceiling`,
        `FixedBufferAllocator: 2.0 MiB · Blur FBO: ${appearance.blurEnabled && optIn.blurShader ? '2.1 MiB' : '0.0 MiB'}`,
      ];
    } else if (cmd === 'ls') {
      output = ['bluff.yaml  binds.yaml  appearance.yaml  apps.yaml  sync.yaml'];
    } else if (cmd === 'uname -a') {
      output = ['Linux bluff-host 6.12.0-zen #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux'];
    } else {
      output = [`zsh: command executed: ${cmd}`];
    }

    setTerminalLogs((prev) => ({
      ...prev,
      [winId]: [...(prev[winId] || []), `$ ${cmd}`, ...output].slice(-14),
    }));
  };

  const activeRadius = optIn.roundedCorners ? appearance.cornerRadius : 0;
  const activeBlur =
    appearance.blurEnabled && optIn.blurShader ? `blur(${appearance.blurRadius}px)` : 'none';

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Session Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800 bg-[#0D0D10]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRofiOpen((o) => !o)}
            className="px-3 py-1.5 bg-zinc-100 text-zinc-950 text-xs font-medium hover:bg-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            Rofi (Super+Space)
          </button>
          <button
            type="button"
            onClick={() => spawnApp('alacritty')}
            className="px-3 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs hover:border-zinc-600 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Terminal className="w-3.5 h-3.5" />
            Alacritty
          </button>
          <button
            type="button"
            onClick={() => spawnApp('thunar')}
            className="px-3 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs hover:border-zinc-600 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Folder className="w-3.5 h-3.5" />
            Thunar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => focusColumnDelta(-1)}
            disabled={focusedColIdx === 0}
            title="Focus column left (Super+H)"
            className="px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs hover:border-zinc-600 disabled:opacity-35 whitespace-nowrap shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => focusColumnDelta(1)}
            disabled={focusedColIdx >= columns.length - 1}
            title="Focus column right (Super+L)"
            className="px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs hover:border-zinc-600 disabled:opacity-35 whitespace-nowrap shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={cyclePresetWidth}
            title="Cycle column width 1/3 · 1/2 · 2/3 (Super+R)"
            className="px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs font-mono hover:border-zinc-600 whitespace-nowrap shrink-0"
          >
            Width
          </button>
          <button
            type="button"
            onClick={consumeOrExpel}
            title="Consume / Expel window in column (Super+Comma / Period)"
            className="px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs inline-flex items-center gap-1 hover:border-zinc-600 whitespace-nowrap shrink-0"
          >
            <Columns2 className="w-3.5 h-3.5" />
            Stack
          </button>
          <button
            type="button"
            onClick={toggleMaximizeColumn}
            title="Maximize column (Super+F)"
            className="px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs hover:border-zinc-600 whitespace-nowrap shrink-0"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={closeFocusedWindow}
            disabled={columns.length === 0}
            title="Close focused window (Super+Q)"
            className="px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs hover:border-red-500/60 hover:text-red-300 disabled:opacity-35 whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simulated Wayland Display Canvas */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-[#060608] select-none min-h-[520px]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.06) 0%, transparent 45%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 36px 36px, 36px 36px',
        }}
      >
        {/* Minimal Session Strip Header Inside Wayland Display */}
        <div className="relative z-10 flex items-center justify-between px-4 py-2 border-b border-zinc-900 bg-zinc-950/75 text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-zinc-100 font-medium">wayland-0</span>
            <span aria-hidden="true">·</span>
            <span>
              column {columns.length === 0 ? 0 : focusedColIdx + 1}/{columns.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>rss {totalMib.toFixed(1)} MiB</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span>Alt+Space / Super+Space: Rofi</span>
            <span aria-hidden="true">·</span>
            <span>Alt+H/L: Scroll Strip</span>
          </div>
        </div>

        {/* Empty Workspace State */}
        {columns.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="font-mono text-sm text-zinc-300">No active Wayland surfaces</p>
            <p className="text-xs text-zinc-500 max-w-md">
              Press Super+Space (or click Rofi) to launch Alacritty, Thunar, or another app into the infinite scrolling strip.
            </p>
            <button
              type="button"
              onClick={() => setRofiOpen(true)}
              className="mt-1 px-4 py-2 bg-zinc-100 text-zinc-950 text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Open Rofi Launcher
            </button>
          </div>
        )}

        {/* Infinite Horizontal Scrolling Strip */}
        <div
          className="flex h-[calc(100%-33px)] items-stretch transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
          style={{
            padding: `${appearance.outerPadding}px`,
            gap: `${appearance.columnGap}px`,
            transform: `translate3d(${-scrollOffsetX}px, 0, 0)`,
          }}
        >
          {columns.map((col, colIdx) => {
            const widthPx = colWidths[colIdx] ?? 440;
            const isFocusedCol = colIdx === focusedColIdx;

            return (
              <div
                key={col.id}
                className="shrink-0 flex flex-col h-full"
                style={{
                  width: `${widthPx}px`,
                  gap: `${appearance.columnGap}px`,
                }}
              >
                {col.windows.map((win, winIdx) => {
                  const isFocused = isFocusedCol && winIdx === focusedWinIdx;
                  const outlineColor = isFocused
                    ? appearance.activeOutline
                    : appearance.inactiveOutline;

                  return (
                    <div
                      key={win.id}
                      onClick={() => {
                        setFocusedColIdx(colIdx);
                        setFocusedWinIdx(winIdx);
                      }}
                      className="flex-1 flex flex-col overflow-hidden cursor-pointer transition-opacity duration-150"
                      style={{
                        borderRadius: `${activeRadius}px`,
                        border: `${appearance.outlineWidth}px solid ${outlineColor}`,
                        backgroundColor: `rgba(17, 17, 20, ${appearance.opacity})`,
                        backdropFilter: activeBlur,
                        WebkitBackdropFilter: activeBlur,
                      }}
                    >
                      {/* Window Titlebar (minimal monochrome) */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 text-[11px] font-mono">
                        <span className={isFocused ? 'text-zinc-100 truncate' : 'text-zinc-400 truncate'}>
                          {win.title}
                        </span>
                        <span className="text-zinc-500 shrink-0 ml-2">
                          {col.maximized ? '100%' : `${Math.round(col.widthFraction * 100)}%`}
                        </span>
                      </div>

                      {/* Window Client Content */}
                      <div className="flex-1 p-3 font-mono text-xs overflow-y-auto">
                        {(win.app === 'alacritty' || win.app === 'foot') && (
                          <div className="flex flex-col h-full justify-between gap-2">
                            <div className="space-y-1 text-zinc-300 leading-relaxed">
                              {(terminalLogs[win.id] || []).map((line, lineIdx) => (
                                <div key={lineIdx} className="break-words">
                                  {line}
                                </div>
                              ))}
                            </div>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                runTerminalCommand(win.id, terminalInputs[win.id] || '');
                                setTerminalInputs((prev) => ({...prev, [win.id]: ''}));
                              }}
                              className="flex items-center gap-2 pt-2 border-t border-zinc-800/60"
                            >
                              <span className="text-zinc-400">~ $</span>
                              <input
                                type="text"
                                value={terminalInputs[win.id] || ''}
                                onChange={(e) =>
                                  setTerminalInputs((prev) => ({
                                    ...prev,
                                    [win.id]: e.target.value,
                                  }))
                                }
                                placeholder="type 'neofetch' or 'help'"
                                className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                              />
                            </form>
                          </div>
                        )}

                        {win.app === 'thunar' && (
                          <ThunarMockView
                            currentDir={thunarDirByWin[win.id] || '~/.config/bluff'}
                            onChangeDir={(dir) =>
                              setThunarDirByWin((prev) => ({...prev, [win.id]: dir}))
                            }
                          />
                        )}

                        {win.app === 'btop' && (
                          <div className="space-y-2 text-zinc-300">
                            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                              <span>PID · Process</span>
                              <span>RSS</span>
                            </div>
                            <div className="flex justify-between text-zinc-100">
                              <span>1042 · bluff-compositor</span>
                              <span>{totalMib.toFixed(1)} MiB</span>
                            </div>
                            <div className="flex justify-between">
                              <span>1108 · alacritty</span>
                              <span>18.4 MiB</span>
                            </div>
                            <div className="flex justify-between">
                              <span>1145 · thunar --daemon</span>
                              <span>14.9 MiB</span>
                            </div>
                            <div className="flex justify-between text-zinc-500">
                              <span>1190 · {optIn.portal}</span>
                              <span>{optIn.portal === 'none' ? '0.0 MiB' : '1.1 MiB'}</span>
                            </div>
                          </div>
                        )}

                        {(win.app === 'imv' || win.app === 'zathura') && (
                          <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-center gap-1.5">
                            <span className="text-zinc-200">{win.app} Wayland surface</span>
                            <span className="text-[11px] text-zinc-500">
                              radius {activeRadius}px · outline {appearance.outlineWidth}px · opacity{' '}
                              {Math.round(appearance.opacity * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Rofi Monochrome Launcher Overlay (SUPER+SPACE) */}
        {rofiOpen && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4"
            onClick={() => setRofiOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md border border-zinc-300 bg-[#0D0D10]/95 shadow-2xl overflow-hidden"
              style={{
                borderRadius: `${Math.min(activeRadius, 12)}px`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-mono text-xs text-zinc-400">drun:</span>
                  <input
                    ref={rofiInputRef}
                    type="text"
                    value={rofiQuery}
                    onChange={(e) => {
                      setRofiQuery(e.target.value);
                      setRofiSelectedIdx(0);
                    }}
                    placeholder="rofi -show drun..."
                    className="w-full bg-transparent font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSpawnTarget((t) => (t === 'new-column' ? 'stack-column' : 'new-column'))
                  }
                  className="text-[11px] font-mono text-zinc-400 hover:text-zinc-100 border border-zinc-800 px-2 py-0.5 ml-2 whitespace-nowrap shrink-0"
                >
                  {spawnTarget === 'new-column' ? 'New Col' : 'Stack'}
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-zinc-900">
                {filteredRofi.length === 0 ? (
                  <div className="px-4 py-6 text-center font-mono text-xs text-zinc-500">
                    No matching applications
                  </div>
                ) : (
                  filteredRofi.map((entry, idx) => {
                    const active = idx === rofiSelectedIdx;
                    return (
                      <button
                        key={entry.app}
                        type="button"
                        onMouseEnter={() => setRofiSelectedIdx(idx)}
                        onClick={() => spawnApp(entry.app)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left font-mono text-xs transition-colors ${
                          active
                            ? 'bg-zinc-100 text-zinc-950'
                            : 'text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        <span className="font-medium">{entry.name}</span>
                        <span className={active ? 'text-zinc-700' : 'text-zinc-500'}>
                          {entry.exec} · {entry.category}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThunarMockView({
  currentDir,
  onChangeDir,
}: {
  currentDir: string;
  onChangeDir: (dir: string) => void;
}) {
  const dirs: Record<string, Array<{name: string; size: string; isDir?: boolean}>> = {
    '~/.config/bluff': [
      {name: 'bluff.yaml', size: '512 B'},
      {name: 'binds.yaml', size: '940 B'},
      {name: 'appearance.yaml', size: '240 B'},
      {name: 'apps.yaml', size: '180 B'},
      {name: 'sync.yaml', size: '210 B'},
    ],
    '~/bluff-compositor/src': [
      {name: 'main.zig', size: '3.9 KiB'},
      {name: 'compositor.zig', size: '4.3 KiB'},
      {name: 'scrolling.zig', size: '7.1 KiB'},
      {name: 'config_yaml.zig', size: '5.5 KiB'},
      {name: 'effects.zig', size: '2.4 KiB'},
      {name: 'theme_sync.zig', size: '3.4 KiB'},
    ],
  };

  const entries = dirs[currentDir] || dirs['~/.config/bluff'];

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
        {Object.keys(dirs).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeDir(dir);
            }}
            className={`px-2 py-1 text-[11px] border transition-colors whitespace-nowrap shrink-0 ${
              currentDir === dir
                ? 'border-zinc-400 bg-zinc-900 text-zinc-100'
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {dir}
          </button>
        ))}
      </div>
      <div className="divide-y divide-zinc-900">
        {entries.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between py-1.5 text-zinc-300"
          >
            <span>{item.name}</span>
            <span className="text-zinc-500">{item.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
