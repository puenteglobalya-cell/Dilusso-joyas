export function DilussoLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Dilusso Joyas"
    >
      {/* Stylized L mark */}
      <path
        d="M45 10 C42 10 38 13 37 17 L37 95 C37 98 39 101 42 103 L85 103 C89 103 93 99 93 95 C93 91 89 87 85 87 L55 87 L55 17 C55 13 51 10 47 10 Z"
        fill="#C8102E"
        stroke="none"
      />
      <path
        d="M37 75 C37 71 40 68 45 67 L85 55 C89 54 93 57 94 61 C95 65 92 69 88 70 L55 80 L55 87 L37 87 Z"
        fill="#C8102E"
        stroke="none"
      />
    </svg>
  );
}
