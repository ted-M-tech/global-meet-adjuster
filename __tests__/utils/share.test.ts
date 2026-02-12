import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEventShareUrl,
  copyToClipboard,
  shareLine,
  shareEmail,
} from '@/lib/share';

describe('getEventShareUrl', () => {
  it('uses localhost as default base URL', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const url = getEventShareUrl('abc123', 'ja');
    expect(url).toBe('http://localhost:3000/ja/events/abc123');
  });

  it('uses NEXT_PUBLIC_BASE_URL when set', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
    const url = getEventShareUrl('abc123', 'en');
    expect(url).toBe('https://example.com/en/events/abc123');
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });
});

describe('copyToClipboard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('returns true on success', async () => {
    const result = await copyToClipboard('hello');
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('returns false on failure', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error('denied')
    );
    const result = await copyToClipboard('hello');
    expect(result).toBe(false);
  });
});

describe('shareLine', () => {
  it('opens LINE share URL in new window', () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    shareLine('https://example.com/event/1', 'Join the meeting');

    expect(openSpy).toHaveBeenCalledOnce();
    const callUrl = openSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('social-plugins.line.me');
    expect(callUrl).toContain(encodeURIComponent('https://example.com/event/1'));
    expect(callUrl).toContain(encodeURIComponent('Join the meeting'));

    vi.unstubAllGlobals();
  });
});

describe('shareEmail', () => {
  it('sets mailto href for Japanese locale', () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    shareEmail('https://example.com/event/1', 'チーム会議', 'ja');

    expect(window.location.href).toContain('mailto:');
    expect(window.location.href).toContain(encodeURIComponent('日程調整: チーム会議'));
  });

  it('sets mailto href for English locale', () => {
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    shareEmail('https://example.com/event/1', 'Team Meeting', 'en');

    expect(window.location.href).toContain('mailto:');
    expect(window.location.href).toContain(encodeURIComponent('Schedule: Team Meeting'));
  });
});
