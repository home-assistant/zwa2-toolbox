interface SpinnerProps {
  /**
   * Size of the spinner in Tailwind size classes (e.g., 'h-4 w-4', 'h-8 w-8', 'h-16 w-16')
   * @default 'h-16 w-16'
   */
  size?: string;
  /**
   * Color of the spinner border as a full Tailwind class (e.g., 'border-blue-600', 'border-indigo-600')
   * @default 'border-blue-600'
   */
  color?: string;
  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
}

export default function Spinner({ size = 'h-16 w-16', color = 'border-blue-600', className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-b-2 ${size} ${color} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
