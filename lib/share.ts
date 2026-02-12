/**
 * Build the full shareable URL for an event.
 */
export function getEventShareUrl(eventId: string, locale: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/${locale}/events/${eventId}`;
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open LINE share dialog.
 * Uses LINE's URL scheme for mobile and share URL for desktop.
 */
export function shareLine(url: string, text: string): void {
  window.open(
    `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    '_blank',
    'width=600,height=500'
  );
}

/**
 * Open mailto: link for email sharing.
 */
export function shareEmail(url: string, title: string, locale: string): void {
  const subject = encodeURIComponent(
    locale === 'ja'
      ? `日程調整: ${title}`
      : `Schedule: ${title}`
  );
  const body = encodeURIComponent(
    locale === 'ja'
      ? `以下のリンクから日程を回答してください:\n${url}`
      : `Please respond with your availability:\n${url}`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}
