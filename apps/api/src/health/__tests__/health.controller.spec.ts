import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { HealthController } from '../health.controller';

describe('HealthController', () => {
  it('should return { status: "ok" }', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const controller = module.get(HealthController);
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
