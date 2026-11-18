/** Tiny top-view car: the two paints the driver chose in Garage. */
export function CarColours({ paint, paint2 }: { paint?: string; paint2?: string }) {
  const body = paint ?? "#ff6a13";
  const trim = paint2 ?? "#141518";
  return (
    <svg viewBox="0 0 36 18" width="36" height="18" className="shrink-0" aria-hidden="true">
      <path d="M4 2h5v4H4zm23 0h5v4h-5zM4 12h5v4H4zm23 0h5v4h-5z" fill="#555b63" />
      <path d="M14 1h8l2 5 6 2v2l-6 2-2 5h-8l-2-5-6-2V8l6-2z" fill={body} />
      <path d="M9 8h18v2H9zm7-4h4v10h-4z" fill={trim} />
      <path d="M17 6h2v6h-2z" fill="#090a0c" />
    </svg>
  );
}
