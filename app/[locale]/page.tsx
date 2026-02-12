'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl whitespace-nowrap">
            {t('landing.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('landing.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-8">
          <div className="flex flex-col items-center gap-2 p-4">
            <Globe className="h-8 w-8 text-primary" />
            <span className="text-sm text-muted-foreground">
              {locale === 'ja' ? 'タイムゾーン自動変換' : 'Auto timezone conversion'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4">
            <Clock className="h-8 w-8 text-primary" />
            <span className="text-sm text-muted-foreground">
              {locale === 'ja' ? 'かんたん日程調整' : 'Easy scheduling'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4">
            <Users className="h-8 w-8 text-primary" />
            <span className="text-sm text-muted-foreground">
              {locale === 'ja' ? 'ログイン不要' : 'No login required'}
            </span>
          </div>
        </div>

        <Button
          size="lg"
          className="text-base px-8"
          onClick={() => router.push(`/${locale}/events/new`)}
        >
          {t('landing.cta')}
        </Button>
      </div>
    </div>
  );
}
