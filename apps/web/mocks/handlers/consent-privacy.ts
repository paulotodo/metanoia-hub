/* eslint-disable @metanoia/no-surveillance-terms --
 * MSW mock mirrors the canonical data_processing_registry seed and the
 * `focus_monitoring` ConsentType enum value. The LGPD registry deliberately
 * names the legal operation precisely ("Monitoramento de Foco em Reuniões");
 * this is legal transparency copy, not general pastoral UI. No new user-facing
 * surveillance vocabulary is introduced beyond the committed canonical labels. */
import { http, HttpResponse } from 'msw';
import type {
  DataProcessingRegistryResponse,
  ConsentHistoryResponse,
  WithdrawConsentResponse,
} from '@metanoia/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_REGISTRY_ID_01 = '0197b000-0000-7000-8000-000000000001';
const MOCK_REGISTRY_ID_02 = '0197b000-0000-7000-8000-000000000002';
const MOCK_REGISTRY_ID_03 = '0197b000-0000-7000-8000-000000000003';
const MOCK_REGISTRY_ID_04 = '0197b000-0000-7000-8000-000000000004';
const MOCK_REGISTRY_ID_05 = '0197b000-0000-7000-8000-000000000005';
const MOCK_REGISTRY_ID_06 = '0197b000-0000-7000-8000-000000000006';
const MOCK_REGISTRY_ID_07 = '0197b000-0000-7000-8000-000000000007';
const MOCK_REGISTRY_ID_08 = '0197b000-0000-7000-8000-000000000008';
const MOCK_REGISTRY_ID_09 = '0197b000-0000-7000-8000-000000000009';
const MOCK_REGISTRY_ID_10 = '0197b000-0000-7000-8000-000000000010';

const MOCK_RECORD_ID_01 = '0197c000-0000-7000-8000-000000000001';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockDataProcessingRegistry: DataProcessingRegistryResponse = {
  data: [
    {
      id: MOCK_REGISTRY_ID_01,
      operationName: 'Armazenamento de Conteúdo',
      legalBasis: 'contract',
      purpose: 'Armazenar e entregar arquivos de mídia (vídeos, documentos, áudio) da plataforma.',
      dataCategories: ['media_files', 'upload_metadata'],
      retentionPeriod: '60 days after trail deletion',
      thirdPartySharing: 'MinIO (object storage, same infrastructure)',
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_02,
      operationName: 'Autenticação e Controle de Acesso',
      legalBasis: 'contract',
      purpose: 'Verificar identidade do usuário e controlar acesso à plataforma.',
      dataCategories: ['email', 'hashed_password', 'session_token'],
      retentionPeriod: '90 days after account deletion',
      thirdPartySharing: 'Keycloak (provedor de identidade)',
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_03,
      operationName: 'Monitoramento de Foco em Reuniões',
      legalBasis: 'consent',
      purpose: 'Coletar sinais de engajamento (câmera ativa, microfone) durante reuniões ao vivo para o Radar Pastoral.',
      dataCategories: ['camera_status', 'microphone_status', 'focus_heartbeat'],
      retentionPeriod: '12 months',
      thirdPartySharing: 'LiveKit (servidor de mídia em tempo real)',
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_04,
      operationName: 'Notas e Registros Pastorais',
      legalBasis: 'legitimate_interest',
      purpose: 'Registrar observações de cuidado pastoral inseridas por líderes para acompanhamento.',
      dataCategories: ['pastoral_notes', 'care_actions', 'care_timestamps'],
      retentionPeriod: '5 years',
      thirdPartySharing: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_05,
      operationName: 'Presença em Reuniões',
      legalBasis: 'contract',
      purpose: 'Registrar participação em reuniões para relatórios e acompanhamento pastoral.',
      dataCategories: ['attendance_records', 'presence_type', 'meeting_timestamps'],
      retentionPeriod: '24 months',
      thirdPartySharing: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_06,
      operationName: 'Progressão de Módulos e Aulas',
      legalBasis: 'contract',
      purpose: 'Rastrear o progresso do usuário em módulos e aulas de trilhas de discipulado.',
      dataCategories: ['lesson_progress', 'module_progress', 'completion_timestamps'],
      retentionPeriod: '36 months after trail completion',
      thirdPartySharing: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_07,
      operationName: 'Progressão de Trilhas',
      legalBasis: 'contract',
      purpose: 'Rastrear o progresso geral do usuário em trilhas de discipulado para certificação.',
      dataCategories: ['trail_progress', 'completion_status'],
      retentionPeriod: '36 months after trail completion',
      thirdPartySharing: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_08,
      operationName: 'Radar de Participação Pastoral',
      legalBasis: 'legitimate_interest',
      purpose: 'Calcular indicadores de participação (semáforo, tendências) para visibilidade pastoral.',
      dataCategories: ['participation_signals', 'radar_scores', 'trend_data'],
      retentionPeriod: '12 months',
      thirdPartySharing: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_09,
      operationName: 'Registro de Erros e Monitoramento',
      legalBasis: 'legitimate_interest',
      purpose: 'Capturar erros de frontend e backend para diagnóstico e estabilidade da plataforma.',
      dataCategories: ['error_traces', 'stack_traces', 'browser_metadata'],
      retentionPeriod: '30 days',
      thirdPartySharing: 'Sentry (monitoramento de erros)',
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    {
      id: MOCK_REGISTRY_ID_10,
      operationName: 'Sessões e Cache de Autenticação',
      legalBasis: 'contract',
      purpose: 'Armazenar sessões ativas e tokens de autenticação para controle de acesso em tempo real.',
      dataCategories: ['session_tokens', 'tenant_context', 'auth_cache'],
      retentionPeriod: '7 days (session TTL)',
      thirdPartySharing: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
  ],
};

const mockConsentHistory: ConsentHistoryResponse = {
  data: [
    {
      consentType: 'terms_of_service',
      status: 'accepted',
      isMandatory: true,
      acceptedAt: '2026-01-01T10:00:00.000Z',
      acceptedVersion: '1.0',
      withdrawnAt: null,
    },
    {
      consentType: 'privacy_policy',
      status: 'accepted',
      isMandatory: true,
      acceptedAt: '2026-01-01T10:00:00.000Z',
      acceptedVersion: '1.0',
      withdrawnAt: null,
    },
    {
      consentType: 'focus_monitoring',
      status: 'withdrawn',
      isMandatory: false,
      acceptedAt: '2026-01-01T10:00:00.000Z',
      acceptedVersion: '1.0',
      withdrawnAt: '2026-06-11T08:00:00.000Z',
    },
  ],
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const consentPrivacyHandlers = [
  // GET /api/v1/privacy/data-processing — public, no auth
  http.get('*/api/v1/privacy/data-processing', () => {
    return HttpResponse.json(mockDataProcessingRegistry);
  }),

  // GET /api/v1/consent/history — authenticated
  http.get('*/api/v1/consent/history', () => {
    return HttpResponse.json(mockConsentHistory);
  }),

  // PATCH /api/v1/consent/:consentType/withdraw
  http.patch('*/api/v1/consent/:consentType/withdraw', ({ params }) => {
    const { consentType } = params;

    // terms_of_service and privacy_policy cannot be withdrawn
    if (consentType === 'terms_of_service' || consentType === 'privacy_policy') {
      return HttpResponse.json(
        {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Não é possível revogar o consentimento de documentos obrigatórios.',
        },
        { status: 400 },
      );
    }

    // focus_monitoring — allowed
    const response: WithdrawConsentResponse = {
      data: {
        recordId: MOCK_RECORD_ID_01,
        consentType: 'focus_monitoring',
        action: 'withdrawn',
        withdrawnAt: new Date().toISOString(),
      },
    };
    return HttpResponse.json(response);
  }),
];
