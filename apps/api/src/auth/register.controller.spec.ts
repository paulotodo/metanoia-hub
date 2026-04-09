import { describe, it, expect, vi } from 'vitest';
import { RegisterController } from './register.controller';

describe('RegisterController', () => {
  const mockRegisterService = {
    register: vi.fn().mockResolvedValue({
      id: 'test-id',
      email: 'user@example.com',
      name: 'John Doe',
      status: 'pending_verification',
    }),
  };

  const controller = new RegisterController(mockRegisterService as any);

  const mockRequest = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'user-agent': 'test-agent' },
  } as any;

  it('should return data wrapper with user response', async () => {
    const body = { email: 'user@example.com', password: 'securePass123!', name: 'John Doe' };
    const result = await controller.register(body, mockRequest);

    expect(result).toEqual({
      data: {
        id: 'test-id',
        email: 'user@example.com',
        name: 'John Doe',
        status: 'pending_verification',
      },
    });
  });

  it('should pass ip and user-agent to service', async () => {
    const body = { email: 'user@example.com', password: 'securePass123!', name: 'John Doe' };
    await controller.register(body, mockRequest);

    expect(mockRegisterService.register).toHaveBeenCalledWith(body, {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });
});
