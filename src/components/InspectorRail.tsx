import type {BluffAppearance, OptInFlags, PortalBackend} from '../types/bluff';

interface InspectorRailProps {
  appearance: BluffAppearance;
  optIn: OptInFlags;
  totalMib: number;
  onAppearanceChange: (next: BluffAppearance) => void;
  onOptInChange: (next: OptInFlags) => void;
  onResetDefaults: () => void;
}

const OUTLINE_SWATCHES = [
  {label: 'Stark White', value: '#FAFAFA'},
  {label: 'Silver', value: '#D4D4D8'},
  {label: 'Ash', value: '#A1A1AA'},
  {label: 'Graphite', value: '#52525B'},
];

export function InspectorRail({
  appearance,
  optIn,
  totalMib,
  onAppearanceChange,
  onOptInChange,
  onResetDefaults,
}: InspectorRailProps) {
  const overBudget = totalMib > 40.0;
  const nearBudget = !overBudget && totalMib > 35.0;
  const budgetPct = Math.min(100, (totalMib / 40.0) * 100);

  return (
    <aside className="w-full lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-[#111114] p-5 flex flex-col gap-6 overflow-y-auto">
      {/* Memory Budget Summary */}
      <section className="pb-5 border-b border-zinc-800/80">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-zinc-100">Idle Session RAM</h2>
          <span
            className={`font-mono text-sm font-medium tabular-nums ${
              overBudget
                ? 'text-red-400'
                : nearBudget
                  ? 'text-amber-400'
                  : 'text-emerald-400'
            }`}
          >
            {totalMib.toFixed(1)} / 40.0 MiB
          </span>
        </div>

        <div className="h-1.5 w-full bg-zinc-900 border border-zinc-800 overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-150 ${
              overBudget ? 'bg-red-500' : nearBudget ? 'bg-amber-400' : 'bg-zinc-100'
            }`}
            style={{width: `${budgetPct}%`}}
          />
        </div>

        <p className="text-xs text-zinc-400">
          {overBudget
            ? 'Exceeds 40 MiB cap due to active opt-in XWayland.'
            : 'Within 40 MiB idle RSS ceiling for full graphical session.'}
        </p>
      </section>

      {/* Visual Shader & Geometry Controls */}
      <section className="flex flex-col gap-4 pb-5 border-b border-zinc-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Window Appearance</h2>
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-xs text-zinc-400 hover:text-zinc-100 underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Reset
          </button>
        </div>

        <SliderControl
          label="Corner radius"
          value={optIn.roundedCorners ? appearance.cornerRadius : 0}
          min={0}
          max={24}
          unit="px"
          disabled={!optIn.roundedCorners}
          onChange={(v) => onAppearanceChange({...appearance, cornerRadius: v})}
        />

        <SliderControl
          label="Outline width"
          value={appearance.outlineWidth}
          min={0}
          max={4}
          unit="px"
          onChange={(v) => onAppearanceChange({...appearance, outlineWidth: v})}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Active outline</span>
            <span className="font-mono text-zinc-300 tabular-nums">{appearance.activeOutline}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {OUTLINE_SWATCHES.map((swatch) => {
              const selected = appearance.activeOutline.toLowerCase() === swatch.value.toLowerCase();
              return (
                <button
                  key={swatch.value}
                  type="button"
                  title={swatch.label}
                  onClick={() => onAppearanceChange({...appearance, activeOutline: swatch.value})}
                  className={`h-7 border text-[11px] font-mono transition-colors ${
                    selected
                      ? 'border-zinc-100 bg-zinc-800 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 align-middle border border-zinc-700"
                    style={{backgroundColor: swatch.value}}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <SliderControl
          label="Outer padding"
          value={appearance.outerPadding}
          min={0}
          max={28}
          unit="px"
          onChange={(v) => onAppearanceChange({...appearance, outerPadding: v})}
        />

        <SliderControl
          label="Column gap"
          value={appearance.columnGap}
          min={0}
          max={28}
          unit="px"
          onChange={(v) => onAppearanceChange({...appearance, columnGap: v})}
        />

        <SliderControl
          label="Window opacity"
          value={Math.round(appearance.opacity * 100)}
          min={55}
          max={100}
          unit="%"
          onChange={(v) => onAppearanceChange({...appearance, opacity: v / 100})}
        />

        <div className="flex flex-col gap-3 pt-1">
          <ToggleControl
            label="Backdrop blur pass"
            checked={appearance.blurEnabled && optIn.blurShader}
            disabled={!optIn.blurShader}
            onChange={(checked) => onAppearanceChange({...appearance, blurEnabled: checked})}
          />
          {appearance.blurEnabled && optIn.blurShader && (
            <SliderControl
              label="Blur radius"
              value={appearance.blurRadius}
              min={0}
              max={20}
              unit="px"
              onChange={(v) => onAppearanceChange({...appearance, blurRadius: v})}
            />
          )}
        </div>
      </section>

      {/* Opt-In Zig Build Options */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-sm font-semibold text-zinc-100">Opt-In Subsystems</h2>

        <ToggleControl
          label="XWayland bridge (+14.2 MiB)"
          checked={optIn.xwayland}
          onChange={(checked) => onOptInChange({...optIn, xwayland: checked})}
        />

        <ToggleControl
          label="Kawase blur shader (+2.1 MiB)"
          checked={optIn.blurShader}
          onChange={(checked) => onOptInChange({...optIn, blurShader: checked})}
        />

        <ToggleControl
          label="SDF rounded corners (+0.6 MiB)"
          checked={optIn.roundedCorners}
          onChange={(checked) => onOptInChange({...optIn, roundedCorners: checked})}
        />

        <ToggleControl
          label="GTK & Qt config sync (+0.4 MiB)"
          checked={optIn.gtkQtSync}
          onChange={(checked) => onOptInChange({...optIn, gtkQtSync: checked})}
        />

        <div className="flex flex-col gap-1.5 pt-1">
          <label htmlFor="portal-select" className="text-xs text-zinc-400">
            Lightweight desktop portal
          </label>
          <select
            id="portal-select"
            value={optIn.portal}
            onChange={(e) =>
              onOptInChange({...optIn, portal: e.target.value as PortalBackend})
            }
            className="w-full bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-400"
          >
            <option value="lwp-minimal">lwp-minimal (+1.1 MiB)</option>
            <option value="xdg-desktop-portal-wlr">xdg-desktop-portal-wlr (+2.6 MiB)</option>
            <option value="none">none (0.0 MiB)</option>
          </select>
        </div>
      </section>
    </aside>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? 'opacity-45' : ''}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-200 tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-100 h-1 bg-zinc-800 appearance-none cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

function ToggleControl({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 w-full text-left py-1 group disabled:opacity-45"
    >
      <span className="text-xs text-zinc-300 group-hover:text-zinc-100 transition-colors">
        {label}
      </span>
      <span
        className={`w-8 h-4 border relative transition-colors shrink-0 ${
          checked ? 'bg-zinc-100 border-zinc-100' : 'bg-zinc-950 border-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-2.5 h-2.5 transition-transform ${
            checked ? 'translate-x-4 bg-zinc-950' : 'translate-x-0.5 bg-zinc-500'
          }`}
        />
      </span>
    </button>
  );
}
