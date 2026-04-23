import Link from 'next/link';
import { SearchBar } from './SearchBar';

type SearchLayoutProps = {
  query: string;
  children: React.ReactNode;
};

export function SearchLayout(props: SearchLayoutProps) {
  return (
    <div className="min-h-screen bg-symbolic-bg">
      <header className="sticky top-0 z-10 border-b border-symbolic-border bg-symbolic-bg">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
          <Link
            href="/"
            className="symbolic-glow shrink-0 text-xl font-bold text-white"
          >
            Symbolic
          </Link>
          <div className="w-full max-w-xl">
            <SearchBar defaultValue={props.query} />
          </div>
        </div>
      </header>
      {props.children}
    </div>
  );
}
