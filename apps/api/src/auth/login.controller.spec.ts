import { Test } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import type { LoginResponse } from '@metanoia/types';

describe('LoginController', () => {
  let controller: LoginController;
  let loginService: { login: ReturnType<typeof vi.fn> };

  const mockLoginResponse: LoginResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    sessionId: '00000000-0000-0000-0000-000000000001',
    user: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'user@example.com',
      name: 'John Doe',
      hasConsent: true,
      tenants: [],
    },
  };

  beforeEach(async () => {
    loginService = { login: vi.fn() };

    const module = await Test.createTestingModule({
      controllers: [LoginController],
      providers: [{ provide: LoginService, useValue: loginService }],
    }).compile();

    controller = module.get(LoginController);
  });

  it('should return login response wrapped in data', async () => {
    loginService.login.mockResolvedValue(mockLoginResponse);

    const req = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'test-agent' },
    } as any;

    const result = await controller.login(
      { email: 'user@example.com', password: 'myPassword123!' },
      req,
    );

    expect(result).toEqual({ data: mockLoginResponse });
    expect(loginService.login).toHaveBeenCalledWith(
      { email: 'user@example.com', password: 'myPassword123!' },
      { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    );
  });
});
