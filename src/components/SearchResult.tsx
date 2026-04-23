import type { SearchResult as SearchResultType } from '@/types/brave';

type SearchResultProps = {
  result: SearchResultType;
};

export function SearchResult(props: SearchResultProps) {
  const displayUrl = `${props.result.meta_url.netloc}${props.result.meta_url.path}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="truncate text-sm text-symbolic-url">{displayUrl}</div>
      <a
        href={props.result.url}
        className="text-lg leading-snug font-medium text-symbolic-link hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {props.result.title}
      </a>
      <p className="line-clamp-2 text-sm leading-relaxed text-symbolic-muted">
        {props.result.description}
      </p>
    </div>
  );
}
