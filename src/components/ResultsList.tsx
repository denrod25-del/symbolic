import type { SearchResult as SearchResultType } from '@/types/brave';
import { SearchResult } from './SearchResult';

type ResultsListProps = {
  results: SearchResultType[];
};

export function ResultsList(props: ResultsListProps) {
  return (
    <ul className="flex flex-col gap-7">
      {props.results.map((result) => (
        <li key={result.url}>
          <SearchResult result={result} />
        </li>
      ))}
    </ul>
  );
}
