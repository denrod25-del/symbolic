import { getTranslations } from 'next-intl/server';
import { ButtonLink } from './Button';

type PaginationProps = {
  query: string;
  offset: number;
  count: number;
};

// Brave Search API treats `offset` as a zero-based page index (max 9).
const PAGE_SIZE = 10;
const MAX_PAGE_INDEX = 9;

export async function Pagination(props: PaginationProps) {
  const t = await getTranslations('Pagination');
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
        <ButtonLink
          href={`/search?q=${encodedQuery}&offset=${prevOffset}`}
          size="sm"
        >
          ← {t('previous')}
        </ButtonLink>
      ) : (
        <div />
      )}
      {hasNext && (
        <ButtonLink
          href={`/search?q=${encodedQuery}&offset=${nextOffset}`}
          size="sm"
        >
          {t('next')} →
        </ButtonLink>
      )}
    </div>
  );
}
