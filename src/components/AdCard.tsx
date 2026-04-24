import type { Ad } from '@/libs/ads';

type AdCardProps = {
  ad: Ad;
  query: string;
};

export function AdCard(props: AdCardProps) {
  const clickUrl = `/api/ads/click?id=${String(props.ad.id)}&q=${encodeURIComponent(props.query)}`;

  return (
    <div
      data-testid="ad-card"
      className="mb-6 rounded-md border border-l-[3px] border-symbolic-border border-l-symbolic-accent bg-symbolic-surface p-4"
    >
      <div className="mb-2 text-xs font-semibold tracking-widest text-symbolic-accent">
        SPONSORED
      </div>
      <div className="mb-1 text-sm text-symbolic-url">
        {props.ad.displayUrl}
      </div>
      <a
        href={clickUrl}
        className="mb-1.5 block text-lg font-medium text-symbolic-link hover:underline"
      >
        {props.ad.title}
      </a>
      <p className="mb-3 text-sm leading-relaxed text-symbolic-muted">
        {props.ad.description}
      </p>
      <a
        href={clickUrl}
        className="rounded bg-symbolic-accent px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        {props.ad.ctaText}
      </a>
    </div>
  );
}
