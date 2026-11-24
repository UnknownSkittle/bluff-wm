import {useMemo, useState} from 'react';
import {Search} from 'lucide-react';
import type {BluffAppearance, KeybindSpec, OptInFlags} from '../types/bluff';
import {NIRI_CLONE_KEYBINDS} from '../types/bluff';
import {computeMemoryBreakdown} from '../utils/yamlSync';

interface KeybindsAndMemoryProps {
  appearance: BluffAppearance;
  optIn: OptInFlags;
}

const CATEGORIES: Array<'All' | KeybindSpec['category']> = [
  'All',
  'Apps & Launcher',
  'Scrolling Navigation',
  'Column & Stack',
  'Sizing',
  'Session',
];

export function KeybindsAndMemory({appearance, optIn}: KeybindsAndMemoryProps) {
  const [category, setCategory] = useState<'All' | KeybindSpec['category']>('All');
  const [query, setQuery] = useState('');

  const {rows, totalMib} = computeMemoryBreakdown(appearance, optIn);

  const filteredBinds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NIRI_CLONE_KEYBINDS.filter((bind) => {
      if (category !== 'All' && bind.category !== category) return false;
      if (!q) return true;
      return (
        bind.keys.toLowerCase().includes(q) ||
        bind.action.toLowerCase().includes(q) ||
        bind.description.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  return (
    <div className="p-6 flex flex-col gap-8">
      {/* Memory Architecture Table */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              Idle Memory Budget (≤ 40.0 MiB Ceiling)
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Full graphical session RSS breakdown with compile-time Zig subsystem stripping.
            </p>
          </div>
          <div className="font-mono text-sm text-zinc-100 tabular-nums">
            Total Active Idle RSS: <span className="font-semibold">{totalMib.toFixed(1)} MiB</span> / 40.0 MiB
          </div>
        </div>

        <div className="border border-zinc-800 bg-[#111114] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-3 px-4 font-medium">Subsystem</th>
                <th className="py-3 px-4 font-medium">Allocator / Flag</th>
                <th className="py-3 px-4 font-medium">State</th>
                <th className="py-3 px-4 font-medium text-right">Idle RSS</th>
                <th className="py-3 px-4 font-medium">Architecture Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((row) => (
                <tr
                  key={row.subsystem}
                  className={row.enabled ? 'text-zinc-200' : 'text-zinc-500'}
                >
                  <td className="py-2.5 px-4 font-medium">{row.subsystem}</td>
                  <td className="py-2.5 px-4 font-mono">{row.allocator}</td>
                  <td className="py-2.5 px-4 font-mono">
                    {row.enabled ? 'Active' : 'Stripped'}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right tabular-nums">
                    {row.enabled ? `${row.mib.toFixed(1)} MiB` : '0.0 MiB'}
                  </td>
                  <td className="py-2.5 px-4 text-zinc-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 1:1 Niri Keybind Reference */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              1:1 Niri Default Keybind Map
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Identical scrolling ergonomics to Niri, with launcher bound to Super+Space (Rofi) and defaults for Alacritty and Thunar.
            </p>
          </div>
          <div className="flex items-center gap-2 border border-zinc-800 bg-[#111114] px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search keybinds..."
              className="bg-transparent font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none w-44"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs border transition-colors whitespace-nowrap shrink-0 ${
                category === cat
                  ? 'border-zinc-100 bg-zinc-100 text-zinc-950 font-medium'
                  : 'border-zinc-800 bg-[#111114] text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="border border-zinc-800 bg-[#111114] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-3 px-4 font-medium">BLUFF Keybind</th>
                <th className="py-3 px-4 font-medium">Niri Upstream</th>
                <th className="py-3 px-4 font-medium">Zig Action</th>
                <th className="py-3 px-4 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filteredBinds.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center font-mono text-zinc-500">
                    No keybinds match "{query}"
                  </td>
                </tr>
              ) : (
                filteredBinds.map((bind) => (
                  <tr
                    key={bind.id}
                    className={
                      bind.changedFromNiri ? 'bg-zinc-900/60 text-zinc-100' : 'text-zinc-300'
                    }
                  >
                    <td className="py-2.5 px-4 font-mono font-medium whitespace-nowrap">
                      {bind.keys}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      {bind.niriOriginal}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-zinc-200">{bind.action}</td>
                    <td className="py-2.5 px-4 text-zinc-400">
                      {bind.description}
                      {bind.changedFromNiri ? ' (BLUFF default override)' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
