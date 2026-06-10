import { z } from 'zod';

/// TrailAccessMode — sequential enforces module completion order; free allows any module
export const TrailAccessModeSchema = z.enum(['sequential', 'free']);
export type TrailAccessMode = z.infer<typeof TrailAccessModeSchema>;

/// LessonAccessMode — sequential enforces lesson completion order within a module; free allows any lesson
export const LessonAccessModeSchema = z.enum(['sequential', 'free']);
export type LessonAccessMode = z.infer<typeof LessonAccessModeSchema>;
