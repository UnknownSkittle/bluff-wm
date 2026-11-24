import {useEffect, useMemo, useState} from 'react';
import {Check, Copy, Download, Search} from 'lucide-react';
import type {OptInFlags, SourceFileItem} from '../types/bluff';
import {formatZigBuildCommand} from '../utils/yamlSync';

interface ZigSourceExplorerProps {
  optIn: OptInFlags;
  onExportArchive: () => void;
}

export function ZigSourceExplorer({optIn, onExportArchive}: ZigSourceExplorerProps) {
  const [files, setFiles] = useState<SourceFileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('src/main.zig');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/source')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load Zig repository from server');
        return res.json();
      })
      .then((data: {files: SourceFileItem[]}) => {
        if (cancelled) return;
        setFiles(data.files);
        if (data.files.length > 0 && !data.files.some((f) => f.path === selectedPath)) {
          setSelectedPath(data.files[0].path);
        }
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, search]);

  const activeFile = files.find((f) => f.path === selectedPath) || filteredFiles[0] || null;
  const buildCmd = formatZigBuildCommand(optIn);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            BLUFF Zig Compositor Repository
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Pure Zig source tree with zero authored C files and comptime opt-in feature stripping via build_options.
          </p>
        </div>
        <button
          type="button"
          onClick={onExportArchive}
          className="px-4 py-2 bg-zinc-100 text-zinc-950 text-xs font-medium hover:bg-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Download .tar.gz
        </button>
      </div>

      {/* Live Compile Command */}
      <div className="border border-zinc-800 bg-[#111114] p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-zinc-300">
            Compile command reflecting current opt-in toggles
          </span>
          <button
            type="button"
            onClick={() => handleCopy('build-cmd', buildCmd)}
            className="text-xs text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            {copiedId === 'build-cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedId === 'build-cmd' ? 'Copied' : 'Copy command'}
          </button>
        </div>
        <pre className="bg-[#09090B] border border-zinc-800/80 p-3 font-mono text-xs text-zinc-200 overflow-x-auto leading-relaxed">
          {buildCmd}
        </pre>
      </div>

      {/* Repository Explorer */}
      {loading ? (
        <div className="border border-zinc-800 bg-[#111114] p-6 space-y-3">
          <div className="h-4 w-48 bg-zinc-800 animate-pulse" />
          <div className="h-4 w-full bg-zinc-900 animate-pulse" />
          <div className="h-4 w-5/6 bg-zinc-900 animate-pulse" />
          <div className="h-4 w-2/3 bg-zinc-900 animate-pulse" />
        </div>
      ) : error ? (
        <div className="border border-red-900/60 bg-red-950/20 p-6 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] border border-zinc-800 bg-[#111114] min-h-[540px]">
          {/* File Sidebar */}
          <div className="border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col">
            <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter files..."
                className="w-full bg-transparent font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
            </div>

            <div className="divide-y divide-zinc-900 overflow-y-auto flex-1">
              {filteredFiles.length === 0 ? (
                <div className="p-4 text-xs text-zinc-500 font-mono">No matching files</div>
              ) : (
                filteredFiles.map((file) => {
                  const active = activeFile?.path === file.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedPath(file.path)}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left font-mono text-xs transition-colors ${
                        active
                          ? 'bg-zinc-100 text-zinc-950 font-medium'
                          : 'text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <span className="truncate">{file.path}</span>
                      <span className={active ? 'text-zinc-700 shrink-0' : 'text-zinc-500 shrink-0'}>
                        {(file.size / 1024).toFixed(1)}K
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Code Viewer */}
          <div className="flex flex-col overflow-hidden bg-[#09090B]">
            {activeFile ? (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-[#111114]">
                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-200">
                    <span>{activeFile.path}</span>
                    <span aria-hidden="true" className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{activeFile.language}</span>
                    <span aria-hidden="true" className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{activeFile.size} B</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeFile.path, activeFile.content)}
                    className="text-xs text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    {copiedId === activeFile.path ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedId === activeFile.path ? 'Copied' : 'Copy file'}
                  </button>
                </div>
                <div className="overflow-auto flex-1 p-4 font-mono text-xs leading-relaxed">
                  <table className="w-full border-collapse">
                    <tbody>
                      {activeFile.content.split('\n').map((line, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900/40">
                          <td className="select-none pr-4 text-right text-zinc-600 align-top w-10">
                            {idx + 1}
                          </td>
                          <td className="text-zinc-200 whitespace-pre">{line}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-8 text-xs font-mono text-zinc-500">Select a file to inspect</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
