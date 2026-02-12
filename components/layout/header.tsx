'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { LocaleSwitcher } from '@/components/locale-switcher';

export function Header() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={`/${locale}`} className="font-bold text-lg">
          {t('common.appName')}
        </Link>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
