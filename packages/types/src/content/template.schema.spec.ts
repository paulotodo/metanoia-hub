import { describe, it, expect } from 'vitest';
import {
  ContentTemplateSchema,
  CreateTemplateRequestSchema,
  TemplateListQuerySchema,
  TemplateStructureSchema,
  UpdateTemplateRequestSchema,
} from './template.schema';

describe('Template Zod schemas — snapshot tests', () => {
  it('ContentTemplateSchema parses valid template', () => {
    const input = {
      id: '01921100-0001-7000-8000-000000000001',
      tenantId: null,
      scope: 'platform',
      sourceTrailId: null,
      name: 'Discipulado Básico',
      description: 'Trilha introdutória',
      version: 1,
      structure: { modules: [] },
      createdBy: '00000000-0000-7000-8000-000000000000',
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    };
    expect(ContentTemplateSchema.parse(input)).toMatchSnapshot();
  });

  it('CreateTemplateRequestSchema parses minimal request', () => {
    const input = { name: 'My Template' };
    expect(CreateTemplateRequestSchema.parse(input)).toMatchSnapshot();
  });

  it('CreateTemplateRequestSchema parses full request', () => {
    const input = {
      name: 'My Template',
      description: 'Some description',
      sourceTrailId: '01921100-0001-7000-8000-000000000099',
    };
    expect(CreateTemplateRequestSchema.parse(input)).toMatchSnapshot();
  });

  it('UpdateTemplateRequestSchema parses partial update', () => {
    const input = { name: 'New Name' };
    expect(UpdateTemplateRequestSchema.parse(input)).toMatchSnapshot();
  });

  it('TemplateListQuerySchema applies defaults', () => {
    const result = TemplateListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.sort).toBe('name');
    expect(result).toMatchSnapshot();
  });

  it('TemplateStructureSchema validates modules array', () => {
    const input = {
      modules: [
        {
          name: 'Módulo 1',
          order: 0,
          lessonAccessMode: 'sequential',
          lessons: [
            { name: 'Lição 1', contentType: 'rich_text', order: 0, estimatedDurationMinutes: 30 },
          ],
        },
      ],
    };
    expect(TemplateStructureSchema.parse(input)).toMatchSnapshot();
  });

  it('ContentTemplateSchema rejects invalid scope', () => {
    const input = {
      id: '01921100-0001-7000-8000-000000000001',
      tenantId: null,
      scope: 'invalid',
      sourceTrailId: null,
      name: 'Test',
      description: null,
      version: 1,
      structure: { modules: [] },
      createdBy: '00000000-0000-7000-8000-000000000000',
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    };
    expect(() => ContentTemplateSchema.parse(input)).toThrow();
  });
});
