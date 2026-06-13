import { describe, it, expect } from 'vitest';
import {
  DayOfWeekSchema,
  CreateGroupRequestSchema,
  GroupResponseSchema,
} from '../group';

describe('DayOfWeekSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = DayOfWeekSchema.safeParse('thu');
    const failureCase = DayOfWeekSchema.safeParse('thursday');
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "thu",
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('CreateGroupRequestSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = CreateGroupRequestSchema.safeParse({
      name: 'Célula de Quinta',
      dayOfWeek: 'thu',
      time: '19:30',
      recurrence: 'weekly',
      notes: 'Reunião na casa do pastor',
    });
    const failureCase = CreateGroupRequestSchema.safeParse({
      name: 'x',
      dayOfWeek: 'thursday',
      time: '25:99',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "dayOfWeek": "thu",
          "name": "Célula de Quinta",
          "notes": "Reunião na casa do pastor",
          "recurrence": "weekly",
          "time": "19:30",
        },
        "failure": true,
        "success": true,
      }
    `);
  });

  it('accepts optional recurrence and notes absent', () => {
    const result = CreateGroupRequestSchema.safeParse({
      name: 'Célula simples',
      dayOfWeek: 'sat',
      time: '09:00',
    });
    expect(result.success).toBe(true);
  });
});

describe('GroupResponseSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = GroupResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000001',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      name: 'Célula de Quinta',
      dayOfWeek: 'thu',
      time: '19:30',
      recurrence: 'weekly',
      notes: null,
      isDemoData: false,
      createdAt: '2026-04-13T12:00:00.000Z',
      updatedAt: '2026-04-13T12:00:00.000Z',
    });
    const failureCase = GroupResponseSchema.safeParse({
      id: 'not-a-uuid',
      tenantId: 'not-a-uuid',
      name: 'x',
      dayOfWeek: 'thu',
      time: '19:30',
      recurrence: 'weekly',
      notes: null,
      isDemoData: false,
      createdAt: 'not-a-date',
      updatedAt: 'not-a-date',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "createdAt": "2026-04-13T12:00:00.000Z",
          "dayOfWeek": "thu",
          "id": "019756c0-0001-7000-8000-000000000001",
          "isDemoData": false,
          "name": "Célula de Quinta",
          "notes": null,
          "recurrence": "weekly",
          "tenantId": "019756c0-0001-7000-8000-000000000002",
          "time": "19:30",
          "updatedAt": "2026-04-13T12:00:00.000Z",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});
