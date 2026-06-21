/**
 * templates.spec.ts — Snapshot tests for all 4 email templates.
 * Tests: PT-BR diacritics, XSS escaping, signed URL preservation, branding fallback.
 * CHK022/M1, CHK070, CHK065, 4.4.3.
 */
import { describe, it, expect } from 'vitest';
import { renderPastoralAlert } from './pastoral-alert.template';
import { renderMeetingReminder } from './meeting-reminder.template';
import { renderExportReady } from './export-ready.template';
import { renderContentNew } from './content-new.template';
import type { BrandingData } from './base.layout';

const BRANDING_WITH: BrandingData = {
  primaryColor: '#1E40AF',
  secondaryColor: '#1E3A5F',
  displayName: 'Igreja Exemplo',
  logoUrl: 'https://cdn.example.com/logo.png',
};

const BRANDING_NULL: BrandingData = {
  primaryColor: null,
  secondaryColor: null,
  displayName: null,
  logoUrl: null,
};

// ─── pastoral-alert ─────────────────────────────────────────────────────────

describe('renderPastoralAlert', () => {
  it('matches snapshot with PT-BR diacritics', () => {
    const { html, subject } = renderPastoralAlert({
      participantName: 'João Conceição',
      riskReason: 'Ausência por 3 semanas',
      groupName: 'Célula Esperança',
      radarUrl: 'https://app.metanoia.app/radar/123',
      branding: BRANDING_WITH,
    });
    expect({ html, subject }).toMatchSnapshot();
  });

  it('escapes XSS payload in participantName (CHK023/M1)', () => {
    const { html } = renderPastoralAlert({
      participantName: '<script>alert(1)</script>',
      riskReason: 'Risco detectado',
      groupName: 'Grupo A',
      radarUrl: 'https://app.metanoia.app/radar/1',
      branding: BRANDING_NULL,
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('escapes img onerror XSS in riskReason (AC 1.1.2)', () => {
    const { html } = renderPastoralAlert({
      participantName: 'Paulo',
      riskReason: '"><img onerror=alert(1)>',
      groupName: 'Grupo B',
      radarUrl: 'https://app.metanoia.app/radar/2',
      branding: BRANDING_NULL,
    });
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img onerror');
  });

  it('matches snapshot without branding (CHK065 fallback)', () => {
    const { html, subject } = renderPastoralAlert({
      participantName: 'Maria Santos',
      riskReason: 'Sem participação há 2 meses',
      groupName: 'Grupo Fé',
      radarUrl: 'https://app.metanoia.app/radar/456',
      branding: BRANDING_NULL,
    });
    expect({ html, subject }).toMatchSnapshot();
    // Should use default visual identity
    expect(html).toContain('Metanoia');
  });

  it('subject follows convention [Metanoia] Sinal de cuidado: <group> (1.2.6)', () => {
    const { subject } = renderPastoralAlert({
      participantName: 'Pedro',
      riskReason: 'Risco',
      groupName: 'Grupo Alpha',
      radarUrl: 'https://app.metanoia.app',
      branding: BRANDING_NULL,
    });
    expect(subject).toBe('[Metanoia] Sinal de cuidado: Grupo Alpha');
  });
});

// ─── meeting-reminder ────────────────────────────────────────────────────────

describe('renderMeetingReminder', () => {
  it('matches snapshot with group name containing diacritics', () => {
    const { html, subject } = renderMeetingReminder({
      date: '21 de junho de 2026',
      time: '19:00',
      groupName: 'Célula Renovação',
      meetingUrl: 'https://app.metanoia.app/meetings/789',
      branding: BRANDING_WITH,
    });
    expect({ html, subject }).toMatchSnapshot();
  });

  it('matches snapshot without branding', () => {
    const { html, subject } = renderMeetingReminder({
      date: '22 de junho de 2026',
      time: '09:30',
      groupName: 'Grupo Beta',
      meetingUrl: 'https://app.metanoia.app/meetings/001',
      branding: BRANDING_NULL,
    });
    expect({ html, subject }).toMatchSnapshot();
  });

  it('subject follows convention [Metanoia] Lembrete: <date> (1.2.6)', () => {
    const { subject } = renderMeetingReminder({
      date: '21 de junho de 2026',
      time: '19:00',
      groupName: 'G',
      meetingUrl: 'https://app.metanoia.app',
      branding: BRANDING_NULL,
    });
    expect(subject).toBe('[Metanoia] Lembrete: 21 de junho de 2026');
  });
});

// ─── export-ready ────────────────────────────────────────────────────────────

describe('renderExportReady', () => {
  it('preserves long signed URL (800+ chars) without truncation (4.4.3)', () => {
    const longUrl = 'https://cdn.example.com/exports/report/' + 'x'.repeat(800) + '?sig=abc';
    const { html } = renderExportReady({
      reportTitle: 'Relatório de Participação',
      downloadUrl: longUrl,
      expiresAt: '21 de junho de 2026, 17:00',
      branding: BRANDING_WITH,
    });
    // URL should appear exactly in the href (not truncated)
    expect(html).toContain(longUrl);
  });

  it('matches snapshot with branding', () => {
    const { html, subject } = renderExportReady({
      reportTitle: 'Relatório Mensal',
      downloadUrl: 'https://cdn.example.com/exports/report.pdf?signed=1',
      expiresAt: '21 de junho de 2026, 16:00',
      branding: BRANDING_WITH,
    });
    expect({ html, subject }).toMatchSnapshot();
  });

  it('matches snapshot without branding', () => {
    const { html, subject } = renderExportReady({
      reportTitle: 'Dados Exportados',
      downloadUrl: 'https://cdn.example.com/exports/data.csv?sig=xyz',
      expiresAt: '22 de junho de 2026, 10:00',
      branding: BRANDING_NULL,
    });
    expect({ html, subject }).toMatchSnapshot();
  });

  it('subject is fixed: [Metanoia] Arquivo pronto (1.2.6)', () => {
    const { subject } = renderExportReady({
      reportTitle: 'Report',
      downloadUrl: 'https://example.com',
      expiresAt: '2026-06-21',
      branding: BRANDING_NULL,
    });
    expect(subject).toBe('[Metanoia] Arquivo pronto');
  });

  it('blocks javascript: scheme in downloadUrl (CHK023)', () => {
    const { html } = renderExportReady({
      reportTitle: 'Malicious',
      downloadUrl: 'javascript:alert(1)',
      expiresAt: '2026',
      branding: BRANDING_NULL,
    });
    expect(html).not.toContain('javascript:alert');
    expect(html).toContain('href="#"');
  });
});

// ─── content-new ─────────────────────────────────────────────────────────────

describe('renderContentNew', () => {
  it('matches snapshot with title containing diacritics', () => {
    const { html, subject } = renderContentNew({
      trailTitle: 'Formação em Oração e Jejum',
      trailDescription: 'Uma jornada de 40 dias explorando a espiritualidade cristã.',
      trailUrl: 'https://app.metanoia.app/trails/oracao-jejum',
      branding: BRANDING_WITH,
    });
    expect({ html, subject }).toMatchSnapshot();
  });

  it('matches snapshot without branding', () => {
    const { html, subject } = renderContentNew({
      trailTitle: 'Discipulado Básico',
      trailDescription: 'Fundamentos da fé cristã.',
      trailUrl: 'https://app.metanoia.app/trails/basico',
      branding: BRANDING_NULL,
    });
    expect({ html, subject }).toMatchSnapshot();
  });

  it('subject is fixed: [Metanoia] Nova trilha disponível (1.2.6)', () => {
    const { subject } = renderContentNew({
      trailTitle: 'T',
      trailDescription: 'D',
      trailUrl: 'https://example.com',
      branding: BRANDING_NULL,
    });
    expect(subject).toBe('[Metanoia] Nova trilha disponível');
  });

  it('escapes XSS in trailDescription', () => {
    const { html } = renderContentNew({
      trailTitle: 'Test',
      trailDescription: '<script>evil()</script>',
      trailUrl: 'https://app.metanoia.app',
      branding: BRANDING_NULL,
    });
    expect(html).not.toContain('<script>evil()');
    expect(html).toContain('&lt;script&gt;');
  });
});
