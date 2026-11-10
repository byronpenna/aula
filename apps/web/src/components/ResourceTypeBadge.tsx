import { getResourceType } from "../lib/resourceTypes";

export function ResourceTypeBadge({ contentType }: { contentType: string }) {
  const type = getResourceType(contentType);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ring-inset ${type.badgeClass}`}
    >
      {type.label}
    </span>
  );
}
