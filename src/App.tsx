import {useState} from 'react';
import {ConfigSyncStudio} from './components/ConfigSyncStudio';
import {InspectorRail} from './components/InspectorRail';
import {KeybindsAndMemory} from './components/KeybindsAndMemory';
import {SessionEmulator} from './components/SessionEmulator';
import {ZigSourceExplorer} from './components/ZigSourceExplorer';
import type {BluffAppearance, OptInFlags, WorkspaceTab} from './types/bluff';
import {DEFAULT_APPEARANCE, DEFAULT_OPT_IN} from './types/bluff';
import {buildYamlFiles, computeMemoryBreakdown} from './utils/yamlSync';

const NAV_ITEMS: Array<{id: WorkspaceTab; label: string}> = [
  {id: 'session', label: 'Session'},
  {id: 'config', label: 'Config & Sync'},
  {id: 'source', label: 'Zig Source'},
  {id: 'reference', label: 'Keybinds & RAM'},
];

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('session');
  const [appearance, setAppearance] = useState<BluffAppearance>(DEFAULT_APPEARANCE);
  const [optIn, setOptIn] = useState<OptInFlags>(DEFAULT_OPT_IN);
  const [exporting, setExporting] = useState(false);

  const {totalMib} = computeMemoryBreakdown(appearance, optIn);

  const handleResetDefaults = () => {
    setAppearance(DEFAULT_APPEARANCE);
    setOptIn(DEFAULT_OPT_IN);
  };

  const handleExportProject = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const yamlFiles = buildYamlFiles(appearance, optIn);
      const overrides: Record<string, string> = {};
      for (const [name, content] of Object.entries(yamlFiles)) {
        overrides[`config/${name}`] = content;
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({overrides}),
      });
      if (!res.ok) throw new Error('Archive export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bluff-compositor.tar.gz';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B] text-zinc-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-zinc-800 bg-[#09090B]">
        <button
          type="button"
          onClick={() => setActiveTab('session')}
          className="text-base font-bold tracking-tight text-zinc-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          BLUFF
        </button>

        <nav className="flex items-center gap-6 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-0.5 cursor-pointer ${
                  active
                    ? 'text-zinc-100 border-b border-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleExportProject}
            disabled={exporting}
            className="px-4 py-2 text-xs font-medium bg-zinc-100 text-zinc-950 hover:bg-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            {exporting ? 'Packaging...' : 'Export Project'}
          </button>
        </div>
      </header>

      {/* Main Workbench Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <InspectorRail
          appearance={appearance}
          optIn={optIn}
          totalMib={totalMib}
          onAppearanceChange={setAppearance}
          onOptInChange={setOptIn}
          onResetDefaults={handleResetDefaults}
        />

        <main className="flex-1 overflow-y-auto flex flex-col bg-[#09090B]">
          {activeTab === 'session' && (
            <SessionEmulator
              appearance={appearance}
              optIn={optIn}
              totalMib={totalMib}
            />
          )}

          {activeTab === 'config' && (
            <ConfigSyncStudio
              appearance={appearance}
              optIn={optIn}
              onAppearanceChange={setAppearance}
              onOptInChange={setOptIn}
            />
          )}

          {activeTab === 'source' && (
            <ZigSourceExplorer
              optIn={optIn}
              onExportArchive={handleExportProject}
            />
          )}

          {activeTab === 'reference' && (
            <KeybindsAndMemory appearance={appearance} optIn={optIn} />
          )}
        </main>
      </div>
    </div>
  );
}
