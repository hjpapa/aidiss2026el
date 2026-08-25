interface HomeBrandProps {
  onHome: () => void;
  className?: string;
}

export function HomeBrand({ onHome, className = "" }: HomeBrandProps) {
  return (
    <button
      type="button"
      className={`home-brand-button ${className}`.trim()}
      onClick={onHome}
      aria-label="AI윤리 펫토론 처음 화면으로"
    >
      <span aria-hidden="true">🐾</span>
      <strong>AI윤리 펫토론</strong>
    </button>
  );
}
