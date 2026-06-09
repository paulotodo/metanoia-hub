import { describe, it, expect } from 'vitest';
import { Role } from './role.enum';

describe('Role enum', () => {
  it('SUPER_ADMIN matches Keycloak realm_roles string', () => {
    expect(Role.SUPER_ADMIN).toBe('super_admin');
  });

  it('ADMIN_TENANT matches Keycloak realm_roles string', () => {
    expect(Role.ADMIN_TENANT).toBe('admin_tenant');
  });

  it('LIDER matches Keycloak realm_roles string', () => {
    expect(Role.LIDER).toBe('lider');
  });

  it('PARTICIPANTE matches Keycloak realm_roles string', () => {
    expect(Role.PARTICIPANTE).toBe('participante');
  });

  it('enum has exactly 4 values', () => {
    const values = Object.values(Role);
    expect(values).toHaveLength(4);
    expect(values).toEqual(
      expect.arrayContaining([
        'super_admin',
        'admin_tenant',
        'lider',
        'participante',
      ]),
    );
  });
});
