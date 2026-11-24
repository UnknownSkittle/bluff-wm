import {useState} from 'react';
import {Check, Copy, Download} from 'lucide-react';
import type {BluffAppearance, OptInFlags, YamlModuleName} from '../types/bluff';
import {
  applyYamlEditsToState,
  buildGtkQtSyncArtifacts,
  buildYamlFiles,
} from '../utils/yamlSync';

interface ConfigSyncStudioProps {
  appearance: BluffAppearance;
  optIn: OptInFlags;
  onAppearanceChange: (next: BluffAppearance) => void;
  onOptInChange: (next: OptInFlags) => void;
}

const MODULE_TABS: YamlModuleName[] = [
  'bluff.yaml',
  'appearance.yaml',
  'binds.yaml',
  'apps.yaml',
  'sync.yaml',
];

export function ConfigSyncStudio({
  appearance,
  optIn,
  onAppearanceChange,
  onOptInChange,
}: ConfigSyncStudioProps) {
  const [activeFile, setActiveFile] = useState<YamlModuleName>('appearance.yaml');
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  const yamlFiles = buildYamlFiles(appearance, optIn);
  const syncArtifacts = buildGtkQtSyncArtifacts(appearance, optIn);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTarget(id);
    setTimeout(() => setCopiedTarget(null), 1500);
  };

  const handleDownloadYaml = (fileName: string, content: string) => {
    const blob = new Blob([content], {type: 'text/yaml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Modular YAML & GTK/Qt Synchronization
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Edit any modular YAML file directly to update the live compositor, or toggle GTK3, GTK4, Qt5, and Qt6 syncing.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>Zero libyaml runtime bloat</span>
          <span aria-hidden="true">·</span>
          <span>Live SIGUSR1 reload</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Modular YAML Editor */}
        <section className="border border-zinc-800 bg-[#111114] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-800">
            <div className="flex flex-wrap items-center gap-1">
              {MODULE_TABS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveFile(name)}
                  className={`px-2.5 py-1 text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    activeFile === name
                      ? 'bg-zinc-100 text-zinc-950 font-medium'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(activeFile, yamlFiles[activeFile])}
                className="px-2.5 py-1 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                {copiedTarget === activeFile ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedTarget === activeFile ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadYaml(activeFile, yamlFiles[activeFile])}
                className="px-2.5 py-1 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>

          <textarea
            value={yamlFiles[activeFile]}
            onChange={(e) => {
              const {appearance: nextApp, optIn: nextOpt} = applyYamlEditsToState(
                activeFile,
                e.target.value,
                appearance,
                optIn,
              );
              onAppearanceChange(nextApp);
              onOptInChange(nextOpt);
            }}
            spellCheck={false}
            rows={20}
            className="w-full bg-[#09090B] text-zinc-200 font-mono text-xs leading-relaxed p-4 focus:outline-none resize-y"
          />
        </section>

        {/* GTK3 / GTK4 / Qt5 / Qt6 Sync Outputs & Live Widget Preview */}
        <section className="flex flex-col gap-5">
          <div className="border border-zinc-800 bg-[#111114] p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">Toolkit Sync Targets</h2>
              <div className="flex flex-wrap items-center gap-2">
                {(['gtk3', 'gtk4', 'qt5', 'qt6'] as const).map((toolkit) => {
                  const active = optIn[toolkit] && optIn.gtkQtSync;
                  return (
                    <button
                      key={toolkit}
                      type="button"
                      disabled={!optIn.gtkQtSync}
                      onClick={() => onOptInChange({...optIn, [toolkit]: !optIn[toolkit]})}
                      className={`px-2.5 py-1 border text-xs font-mono transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
                        active
                          ? 'border-zinc-100 bg-zinc-100 text-zinc-950 font-medium'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {toolkit.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live GTK4 / Qt6 Monochrome Surface Preview */}
            <div
              className="p-4 bg-[#09090B] transition-all"
              style={{
                borderRadius: `${optIn.roundedCorners ? appearance.cornerRadius : 0}px`,
                border: `${appearance.outlineWidth}px solid ${appearance.activeOutline}`,
                opacity: optIn.gtkQtSync ? appearance.opacity : 0.45,
              }}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
                <span className="font-mono text-xs text-zinc-100">
                  GTK4 / Qt6 Synced Dialog Preview
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {optIn.gtkQtSync ? 'Synced' : 'Disabled'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value="JetBrains Mono 10pt · bluff-mono-dark"
                  className="flex-1 min-w-[180px] bg-zinc-900 border border-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-200"
                  style={{
                    borderRadius: `${Math.min(optIn.roundedCorners ? appearance.cornerRadius : 0, 8)}px`,
                  }}
                />
                <button
                  type="button"
                  className="px-3 py-1.5 bg-zinc-100 text-zinc-950 font-mono text-xs font-medium"
                  style={{
                    borderRadius: `${Math.min(optIn.roundedCorners ? appearance.cornerRadius : 0, 8)}px`,
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Generated Files */}
          <div className="border border-zinc-800 bg-[#111114] divide-y divide-zinc-800">
            {syncArtifacts.map((artifact) => (
              <div key={artifact.target} className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-200">{artifact.target}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      {artifact.enabled ? 'Active' : 'Skipped'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(artifact.target, artifact.content)}
                      className="text-xs text-zinc-400 hover:text-zinc-100 underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      {copiedTarget === artifact.target ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <pre className="bg-[#09090B] border border-zinc-800/80 p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
                  {artifact.content}
                </pre>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
