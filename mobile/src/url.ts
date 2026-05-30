import { SYMBOLIC_ORIGIN } from './config';

export function isUrlLike(input: string): boolean {
  if (/^https?:\/\//i.test(input)) {
    return true;
  }
  if (/\s/.test(input)) {
    return false;
  }
  const host = input.split(/[/?#]/)[0] ?? '';
  return host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
}

export function resolveInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return SYMBOLIC_ORIGIN;
  }
  if (isUrlLike(trimmed)) {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  return `${SYMBOLIC_ORIGIN}/search?q=${encodeURIComponent(trimmed)}`;
}

export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
