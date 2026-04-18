import { http, HttpResponse } from 'msw';
import type {
  ForgotPasswordResponse,
  ResetTokenValidateResponse,
  ResetPasswordResponse,
} from '@metanoia/types';

const VALID_TOKEN = '019756d0-0001-7000-8000-000000000099';

export const authRecoveryHandlers = [
  http.post('*/api/v1/auth/forgot-password', () =>
    HttpResponse.json<ForgotPasswordResponse>({
      data: {
        message:
          'Se esse email existir na nossa base, você vai receber um link nos próximos segundos.',
      },
    }),
  ),

  http.get('*/api/v1/auth/reset-password/:token/validate', ({ params }) => {
    const { token } = params;
    if (token === VALID_TOKEN) {
      return HttpResponse.json<ResetTokenValidateResponse>({
        data: { valid: true, email: 'm***@i***.com' },
      });
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('*/api/v1/auth/reset-password', () =>
    HttpResponse.json<ResetPasswordResponse>({
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 300,
        sessionId: '019756d0-0001-7000-8000-000000000001',
        user: {
          id: '019756d0-0001-7000-8000-000000000002',
          email: 'marcos@igreja.com',
          name: 'Marcos Silva',
          hasConsent: true,
          tenants: [
            {
              id: '019756d0-0001-7000-8000-000000000003',
              name: 'Igreja Batista Central',
              role: 'leader',
            },
          ],
        },
      },
    }),
  ),
];
