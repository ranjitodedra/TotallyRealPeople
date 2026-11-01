import { z } from 'zod';

export const PersonaSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  relationship: z.string().min(1),
  fictionalOrg: z.string().min(1),
  roleTitle: z.string().min(1),
  fictionalTenure: z.string().min(1),
  personality: z.string().min(1),
  speakingStyle: z.string().min(1),
  talkingPoints: z.array(z.string().min(1)).length(3),
  signoff: z.string().min(1),
});
export type Persona = z.infer<typeof PersonaSchema>;

export const InboxSchema = z.object({ id: z.string(), address: z.string() });
export const SessionSchema = z.object({
  id: z.string(),
  persona: PersonaSchema,
  personaInbox: InboxSchema,
  recruiterEmail: z.string().email(),
  contactPhone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/),
  messages: z.array(z.record(z.unknown())),
});
export type Session = z.infer<typeof SessionSchema>;
