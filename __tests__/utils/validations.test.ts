import { describe, it, expect } from 'vitest';
import {
  createEventSchema,
  durationSchema,
  registerGuestSchema,
  updateGuestAnswerSchema,
  answerSchema,
  fixEventSchema,
  deleteEventSchema,
  voteStatusSchema,
} from '@/lib/validations';

describe('durationSchema', () => {
  it('transforms valid string to number', () => {
    expect(durationSchema.parse('60')).toBe(60);
    expect(durationSchema.parse('30')).toBe(30);
    expect(durationSchema.parse('90')).toBe(90);
    expect(durationSchema.parse('120')).toBe(120);
  });

  it('rejects invalid values', () => {
    expect(() => durationSchema.parse('45')).toThrow();
    expect(() => durationSchema.parse('abc')).toThrow();
  });
});

describe('voteStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(voteStatusSchema.parse('ok')).toBe('ok');
    expect(voteStatusSchema.parse('maybe')).toBe('maybe');
    expect(voteStatusSchema.parse('ng')).toBe('ng');
  });

  it('rejects invalid status', () => {
    expect(() => voteStatusSchema.parse('yes')).toThrow();
    expect(() => voteStatusSchema.parse('')).toThrow();
  });
});

describe('answerSchema', () => {
  it('accepts valid answer', () => {
    const result = answerSchema.safeParse({
      candidateId: 'cand-1',
      status: 'ok',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty candidateId', () => {
    const result = answerSchema.safeParse({
      candidateId: '',
      status: 'ok',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = answerSchema.safeParse({
      candidateId: 'cand-1',
      status: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('createEventSchema', () => {
  const validInput = {
    title: 'Team Meeting',
    description: 'Weekly sync',
    duration: '60',
    timezone: 'Asia/Tokyo',
    candidates: [
      {
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      },
    ],
  };

  it('accepts valid input', () => {
    const result = createEventSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createEventSchema.safeParse({ ...validInput, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 100 characters', () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      title: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero candidates', () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      candidates: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects past date candidates', () => {
    const result = createEventSchema.safeParse({
      ...validInput,
      candidates: [
        {
          start: '2020-01-01T00:00:00Z',
          end: '2020-01-01T01:00:00Z',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('registerGuestSchema', () => {
  const validGuest = {
    eventId: 'event-1',
    name: 'Taro',
    answers: [{ candidateId: 'cand-1', status: 'ok' as const }],
  };

  it('accepts valid input without email', () => {
    const result = registerGuestSchema.safeParse(validGuest);
    expect(result.success).toBe(true);
  });

  it('accepts valid input with email', () => {
    const result = registerGuestSchema.safeParse({
      ...validGuest,
      email: 'taro@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty string email', () => {
    const result = registerGuestSchema.safeParse({
      ...validGuest,
      email: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = registerGuestSchema.safeParse({
      ...validGuest,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = registerGuestSchema.safeParse({ ...validGuest, name: '' });
    expect(result.success).toBe(false);
  });
});

describe('updateGuestAnswerSchema', () => {
  it('accepts valid UUID editToken', () => {
    const result = updateGuestAnswerSchema.safeParse({
      eventId: 'event-1',
      guestId: 'guest-1',
      editToken: '550e8400-e29b-41d4-a716-446655440000',
      answers: [{ candidateId: 'cand-1', status: 'ok' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID editToken', () => {
    const result = updateGuestAnswerSchema.safeParse({
      eventId: 'event-1',
      guestId: 'guest-1',
      editToken: 'not-a-uuid',
      answers: [{ candidateId: 'cand-1', status: 'ok' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('fixEventSchema', () => {
  it('accepts valid input', () => {
    const result = fixEventSchema.safeParse({
      eventId: 'event-1',
      candidateId: 'cand-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty eventId', () => {
    const result = fixEventSchema.safeParse({
      eventId: '',
      candidateId: 'cand-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('deleteEventSchema', () => {
  it('accepts valid input', () => {
    const result = deleteEventSchema.safeParse({ eventId: 'event-1' });
    expect(result.success).toBe(true);
  });

  it('rejects empty eventId', () => {
    const result = deleteEventSchema.safeParse({ eventId: '' });
    expect(result.success).toBe(false);
  });
});
