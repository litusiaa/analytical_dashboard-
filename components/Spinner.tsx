export function Spinner({ size = 16 }: { size?: number }) {
  const s = `${size}px`;
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
      style={{ width: s, height: s }}
      aria-label="loading"
    />
  );
}

