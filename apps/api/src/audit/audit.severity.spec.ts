import { describe, it, expect } from 'vitest';
import { getAuditSeverity } from './audit.severity';

describe('getAuditSeverity', () => {
  // ─── critical actions ────────────────────────────────────────────────────────

  it('delete → critical (any resource)', () => {
    expect(getAuditSeverity('delete', 'user')).toBe('critical');
    expect(getAuditSeverity('delete', 'group')).toBe('critical');
    expect(getAuditSeverity('delete', 'trail')).toBe('critical');
  });

  it('config_change → critical', () => {
    expect(getAuditSeverity('config_change', 'settings')).toBe('critical');
  });

  it('auth_failure → critical (security event)', () => {
    expect(getAuditSeverity('auth_failure', 'auth')).toBe('critical');
  });

  // ─── warning: update on role-related resources (dec-023) ──────────────────

  it('update role → warning', () => {
    expect(getAuditSeverity('update', 'role')).toBe('warning');
  });

  it('update permission → warning', () => {
    expect(getAuditSeverity('update', 'permission')).toBe('warning');
  });

  it('update user-role → warning', () => {
    expect(getAuditSeverity('update', 'user-role')).toBe('warning');
  });

  it('update group-role → warning', () => {
    expect(getAuditSeverity('update', 'group-role')).toBe('warning');
  });

  it('update member-role → warning', () => {
    expect(getAuditSeverity('update', 'member-role')).toBe('warning');
  });

  // ─── info: update on non-role resources ───────────────────────────────────

  it('update user (non-role resource) → info', () => {
    expect(getAuditSeverity('update', 'user')).toBe('info');
  });

  it('update trail → info', () => {
    expect(getAuditSeverity('update', 'trail')).toBe('info');
  });

  // ─── info: all other actions ──────────────────────────────────────────────

  it('create → info', () => {
    expect(getAuditSeverity('create', 'user')).toBe('info');
  });

  it('login → info', () => {
    expect(getAuditSeverity('login', 'auth')).toBe('info');
  });

  it('logout → info', () => {
    expect(getAuditSeverity('logout', 'auth')).toBe('info');
  });

  it('export → info', () => {
    expect(getAuditSeverity('export', 'report')).toBe('info');
  });
});
