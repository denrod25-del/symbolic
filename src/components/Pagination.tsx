import Link from 'next/link';

type PaginationProps = {
  query: string;
  offset: number;
  count: number;
};

// Brave Search API treats `offset` as a zero-based page index (max 9).
const PAGE_SIZE = 10;
const MAX_PAGE_INDEX = 9;

export function Pagination(props: PaginationProps) {
  const hasPrev = props.offset > 0;
  const hasNext = props.count === PAGE_SIZE && props.offset < MAX_PAGE_INDEX;

  if (!hasPrev && !hasNext) {
    return null;
  }

  const prevOffset = Math.max(0, props.offset - 1);
  const nextOffset = props.offset + 1;
  const encodedQuery = encodeURIComponent(props.query);

  return (
    <div className="mt-8 flex justify-between border-t border-symbolic-border py-4">
      {hasPrev ? (
        <Link
          href={`/search?q=${encodedQuery}&offset=${prevOffset}`}
          className="rounded-md border border-symbolic-border bg-symbolic-surface px-4 py-2 text-sm text-symbolic-text transition-colors hover:border-symbolic-accent"
        >
          ← Previous
        </Link>
      ) : (
        <div />
      )}
      {hasNext && (
        <Link
          href={`/search?q=${encodedQuery}&offset=${nextOffset}`}
          className="rounded-md border border-symbolic-border bg-symbolic-surface px-4 py-2 text-sm text-symbolic-text transition-colors hover:border-symbolic-accent"
        >
          Next →
        </Link>
      )}
    </div>
  );
}
