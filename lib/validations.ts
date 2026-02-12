import { z } from 'zod';

export const DURATIONS = [30, 60, 90, 120] as const;

export const durationSchema = z.enum(['30', '60', '90', '120']).transform(Number) as z.ZodType<30 | 60 | 90 | 120>;

export const candidateSchema = z.object({
  start: z.coerce.date().refine(
    (date) => date > new Date(),
    { message: 'validation.pastDate' }  // i18n key
  ),
  end: z.coerce.date(),
});

export const createEventSchema = z.object({
  title: z.string()
    .min(1, { message: 'validation.required' })
    .max(100, { message: 'validation.maxLength' }),
  description: z.string().max(500).optional().default(''),
  duration: durationSchema,
  timezone: z.string().min(1),
  candidates: z.array(candidateSchema)
    .min(1, { message: 'validation.minCandidates' }),
});

export const updateEventSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  duration: durationSchema.optional(),
  candidatesToAdd: z.array(candidateSchema).optional(),
  candidateIdsToRemove: z.array(z.string()).optional(),
});

export const voteStatusSchema = z.enum(['ok', 'maybe', 'ng']);

export const answerSchema = z.object({
  candidateId: z.string().min(1),
  status: voteStatusSchema,
});

export const registerGuestSchema = z.object({
  eventId: z.string().min(1),
  name: z.string()
    .min(1, { message: 'validation.required' })
    .max(50, { message: 'validation.maxLength' }),
  email: z.string().email({ message: 'validation.invalidEmail' }).optional().or(z.literal('')),
  answers: z.array(answerSchema),
});

export const updateGuestAnswerSchema = z.object({
  eventId: z.string().min(1),
  guestId: z.string().min(1),
  editToken: z.string().uuid(),
  answers: z.array(answerSchema),
});

export const fixEventSchema = z.object({
  eventId: z.string().min(1),
  candidateId: z.string().min(1),
});

export const deleteEventSchema = z.object({
  eventId: z.string().min(1),
});
