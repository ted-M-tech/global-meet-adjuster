'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VotingTimeGrid } from './voting-time-grid';
import { VotingTimeGridMobile } from './voting-time-grid-mobile';
import { GuestProfileDialog } from './guest-profile-dialog';
import { useEditToken } from '@/hooks/use-edit-token';
import { registerGuest } from '@/app/actions/guest';
import { updateGuestAnswer } from '@/app/actions/guest';
import { getBrowserTimezone, getTimezoneName, COMMON_TIMEZONES } from '@/lib/timezone';
import type { Candidate, GuestDocument, VoteStatus, Answer } from '@/types';
import type { Locale } from '@/types';
import { useLocale } from 'next-intl';

interface VotingFormProps {
  eventId: string;
  candidates: Candidate[];
  guests: GuestDocument[];
  hostTimezone: string;
  isFixed: boolean;
  fixedCandidateId?: string;
  secondaryTz: string | null;
  onSecondaryTzChange: (tz: string | null) => void;
}

type FormMode = 'view' | 'new' | 'edit';

export function VotingForm({
  eventId,
  candidates,
  guests,
  hostTimezone,
  isFixed,
  fixedCandidateId,
  secondaryTz,
  onSecondaryTzChange,
}: VotingFormProps) {
  const t = useTranslations('voting');
  const tCommon = useTranslations('common');
  const tError = useTranslations('error');
  const locale = useLocale() as Locale;
  const { getToken, saveToken, findMyGuestId } = useEditToken();

  const [mode, setMode] = useState<FormMode>('view');
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, VoteStatus>>({});
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const myGuestId = findMyGuestId(
    eventId,
    guests.map((g) => g.id)
  );

  // Button click: if existing guest, enter edit mode directly; otherwise show profile dialog
  const handleButtonClick = useCallback(() => {
    if (myGuestId) {
      // Edit existing response: load answers directly (no dialog)
      const guest = guests.find((g) => g.id === myGuestId);
      if (!guest) return;
      const token = getToken(eventId, myGuestId);
      if (!token) {
        toast.error(t('editTokenExpired'));
        return;
      }

      const answers: Record<string, VoteStatus> = {};
      for (const a of guest.answers) {
        answers[a.candidateId] = a.status;
      }

      setMode('edit');
      setEditingGuestId(myGuestId);
      setEditingAnswers(answers);
    } else {
      // New response: show profile dialog first
      setShowProfileDialog(true);
    }
  }, [myGuestId, guests, eventId, getToken, t]);

  // Profile submit: save name/email to state, then enter edit mode
  const handleProfileSubmit = useCallback(
    (name: string, email: string) => {
      setPendingName(name);
      setPendingEmail(email);
      setShowProfileDialog(false);
      setMode('new');
      setEditingGuestId(null);
      setEditingAnswers({});
    },
    []
  );

  const handleAnswerChange = useCallback(
    (candidateId: string, status: VoteStatus | undefined) => {
      setEditingAnswers((prev) => {
        const next = { ...prev };
        if (status === undefined) {
          delete next[candidateId];
        } else {
          next[candidateId] = status;
        }
        return next;
      });
    },
    []
  );

  // Save new response: register guest with pending name/email + answers
  const handleSaveNew = useCallback(async () => {
    setSaving(true);
    try {
      const answers: Answer[] = Object.entries(editingAnswers).map(
        ([candidateId, status]) => ({ candidateId, status })
      );

      const result = await registerGuest({
        eventId,
        name: pendingName,
        email: pendingEmail || undefined,
        answers,
      });

      if (!result.success) {
        if (result.error === 'duplicateEmail') {
          toast.error(t('duplicateEmail'));
        } else {
          toast.error(tError('generic'));
        }
        return;
      }

      saveToken(eventId, result.data.guestId, result.data.editToken);
      setMode('view');
      setEditingGuestId(null);
      setEditingAnswers({});
      setPendingName('');
      setPendingEmail('');
    } catch {
      toast.error(tError('generic'));
    } finally {
      setSaving(false);
    }
  }, [editingAnswers, eventId, pendingName, pendingEmail, saveToken, t, tError]);

  const handleUpdateAnswer = useCallback(async () => {
    if (!editingGuestId) return;

    const token = getToken(eventId, editingGuestId);
    if (!token) {
      toast.error(t('editTokenExpired'));
      return;
    }

    setSaving(true);
    try {
      const answers: Answer[] = Object.entries(editingAnswers).map(
        ([candidateId, status]) => ({ candidateId, status })
      );

      const result = await updateGuestAnswer({
        eventId,
        guestId: editingGuestId,
        editToken: token,
        answers,
      });

      if (!result.success) {
        toast.error(tError('generic'));
        return;
      }

      setMode('view');
      setEditingGuestId(null);
      setEditingAnswers({});
    } catch {
      toast.error(tError('generic'));
    } finally {
      setSaving(false);
    }
  }, [editingGuestId, editingAnswers, eventId, getToken, tError]);

  const handleCancel = useCallback(() => {
    setMode('view');
    setEditingGuestId(null);
    setEditingAnswers({});
    setPendingName('');
    setPendingEmail('');
  }, []);

  const showGrid = mode !== 'view' || guests.length > 0;
  const currentEditingGuestId = mode === 'new' ? '__new__' : editingGuestId;

  const browserTz = useMemo(() => getBrowserTimezone(), []);

  const tzOptions = useMemo(() => {
    const pinned: string[] = [];
    if (!COMMON_TIMEZONES.includes(browserTz as typeof COMMON_TIMEZONES[number])) {
      pinned.push(browserTz);
    }
    if (hostTimezone !== browserTz && !COMMON_TIMEZONES.includes(hostTimezone as typeof COMMON_TIMEZONES[number])) {
      pinned.push(hostTimezone);
    }
    return { pinned, common: COMMON_TIMEZONES as readonly string[] };
  }, [browserTz, hostTimezone]);

  return (
    <div className="space-y-4">
      {showGrid && (
        <>
          {/* Secondary timezone selector */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">{t('secondaryTimezone')}:</span>
            <Select
              value={secondaryTz ?? '__none__'}
              onValueChange={(val) => onSecondaryTzChange(val === '__none__' ? null : val)}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="__none__">{t('secondaryTzNone')}</SelectItem>
                <SelectSeparator />
                {tzOptions.pinned.length > 0 && (
                  <>
                    {tzOptions.pinned.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {getTimezoneName(tz, locale)}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                  </>
                )}
                {tzOptions.common.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {getTimezoneName(tz, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PC: time grid */}
          <div className="hidden md:block">
            <VotingTimeGrid
              candidates={candidates}
              guests={guests}
              hostTimezone={hostTimezone}
              editingGuestId={currentEditingGuestId}
              onAnswerChange={handleAnswerChange}
              editingAnswers={editingAnswers}
              fixedCandidateId={fixedCandidateId}
              isFixed={isFixed}
              secondaryTz={secondaryTz}
            />
          </div>
          {/* Mobile: time grid */}
          <div className="md:hidden">
            <VotingTimeGridMobile
              candidates={candidates}
              guests={guests}
              hostTimezone={hostTimezone}
              editingGuestId={currentEditingGuestId}
              onAnswerChange={handleAnswerChange}
              editingAnswers={editingAnswers}
              fixedCandidateId={fixedCandidateId}
              isFixed={isFixed}
              secondaryTz={secondaryTz}
            />
          </div>
        </>
      )}

      {/* Action buttons */}
      {!isFixed && (
        <div className="flex gap-2">
          {mode === 'view' && (
            <Button onClick={handleButtonClick}>
              {myGuestId ? t('editResponse') : t('newResponse')}
            </Button>
          )}
          {mode === 'new' && (
            <>
              <Button onClick={handleSaveNew} disabled={saving}>
                {saving ? '...' : t('submit')}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                {tCommon('cancel')}
              </Button>
            </>
          )}
          {mode === 'edit' && (
            <>
              <Button onClick={handleUpdateAnswer} disabled={saving}>
                {saving ? '...' : t('update')}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                {tCommon('cancel')}
              </Button>
            </>
          )}
        </div>
      )}

      <GuestProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onSubmit={handleProfileSubmit}
        loading={false}
      />
    </div>
  );
}
