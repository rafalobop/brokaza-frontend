export interface TabOption<T extends string> {
  key: T;
  label: string;
}

export interface TabsProps<T extends string> {
  tabs: TabOption<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
  size?: "xs" | "sm";
}

/** Pestañas tipo pill compartidas por `ActiveSearchesSection` y `TeamSection`. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
  size = "sm",
}: TabsProps<T>) {
  const textSize = size === "xs" ? "text-xs" : "text-sm";
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-full px-3 py-1 ${textSize} font-medium transition-colors ${
            value === key ? "bg-accent text-white" : "text-text-secondary hover:bg-white/8"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
