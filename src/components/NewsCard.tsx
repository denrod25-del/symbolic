import { getFormatter } from 'next-intl/server';
import type { newsArticles } from '@/models/Schema';

const SOURCE_LABELS: Record<string, string> = {
  verge: 'The Verge',
  techcrunch: 'TechCrunch',
  ars: 'Ars Technica',
  wired: 'Wired',
  hn: 'Hacker News',
};

export async function NewsCard(props: {
  article: typeof newsArticles.$inferSelect;
}) {
  const format = await getFormatter();
  const { article } = props;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-symbolic-border bg-symbolic-surface transition-colors hover:border-symbolic-accent"
    >
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external RSS image, no next/image domain config
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-symbolic-muted">
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold">
            {SOURCE_LABELS[article.source] ?? article.source}
          </span>
          <span>{format.relativeTime(article.publishedAt)}</span>
        </div>
        <h3 className="text-sm font-semibold text-symbolic-text group-hover:text-symbolic-accent">
          {article.title}
        </h3>
      </div>
    </a>
  );
}
