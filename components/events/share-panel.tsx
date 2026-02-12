'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { Copy, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getEventShareUrl,
  copyToClipboard,
  shareLine,
  shareEmail,
} from '@/lib/share';

interface SharePanelProps {
  eventId: string;
  eventTitle: string;
}

export function SharePanel({ eventId, eventTitle }: SharePanelProps) {
  const t = useTranslations('event.share');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shareUrl = getEventShareUrl(eventId, locale);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 200,
        margin: 2,
      });
    }
  }, [shareUrl]);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      toast.success(tCommon('copied'));
    }
  }, [shareUrl, tCommon]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {t('copyUrl')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => shareLine(shareUrl, eventTitle)}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {t('line')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => shareEmail(shareUrl, eventTitle, locale)}
          >
            <Mail className="mr-2 h-4 w-4" />
            {t('email')}
          </Button>
        </div>

        <div className="flex justify-center pt-2">
          <div className="text-center">
            <canvas ref={canvasRef} />
            <p className="text-sm text-muted-foreground mt-2">{t('qrCode')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
