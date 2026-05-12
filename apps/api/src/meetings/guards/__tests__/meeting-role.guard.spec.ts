import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ForbiddenException,
  NotFoundException,
  type ExecutionContext,
} from "@nestjs/common";
import { generateId } from "@metanoia/types";
import { requestContext } from "../../../common/context/request-context";
import { MeetingRoleGuard } from "../meeting-role.guard";

async function withCtx<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId,
      userId: "system",
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

const TENANT = "01912345-6789-7000-8000-000000000001";
const MEETING = "01912345-6789-7000-8000-000000000100";
const GROUP = "01912345-6789-7000-8000-000000000200";
const USER = "01912345-6789-7000-8000-000000000aa1";

function buildCtx(user: unknown, params: Record<string, string>): ExecutionContext {
  const request = { user, params };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildGuard(opts: {
  meeting?: { groupId: string } | null;
  membershipRole?: string | null;
}) {
  const prisma = {
    client: {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          meeting: {
            findUnique: vi.fn().mockResolvedValue(opts.meeting ?? null),
          },
          groupMember: {
            findFirst: vi.fn().mockResolvedValue(
              opts.membershipRole === null || opts.membershipRole === undefined
                ? null
                : { role: opts.membershipRole },
            ),
          },
        }),
    },
  } as never;
  return new MeetingRoleGuard(prisma);
}

describe("MeetingRoleGuard", () => {
  beforeEach(() => {
    // Stub withTenantTx's SET LOCAL — the prisma mock above already returns the tx callback.
  });

  it("rejects unauthenticated requests", async () => {
    const guard = buildGuard({});
    await expect(
      guard.canActivate(buildCtx(undefined, { id: MEETING })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects when meeting id is missing from route", async () => {
    const guard = buildGuard({});
    const user = { userId: USER, tenantId: TENANT, roles: ["lider"], email: "x" };
    await expect(
      guard.canActivate(buildCtx(user, {})),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows admin_tenant short-circuit without DB lookup", async () => {
    const guard = buildGuard({});
    const user = {
      userId: USER,
      tenantId: TENANT,
      roles: ["admin_tenant"],
      email: "x",
    };
    await expect(
      guard.canActivate(buildCtx(user, { id: MEETING })),
    ).resolves.toBe(true);
  });

  it("404 when meeting does not exist", async () => {
    const guard = buildGuard({ meeting: null });
    const user = { userId: USER, tenantId: TENANT, roles: ["lider"], email: "x" };
    await expect(
      withCtx(TENANT, () => guard.canActivate(buildCtx(user, { id: MEETING }))),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("403 for Participante (role !== lider/admin) of the group", async () => {
    const guard = buildGuard({
      meeting: { groupId: GROUP },
      membershipRole: "membro",
    });
    const user = {
      userId: USER,
      tenantId: TENANT,
      roles: ["participante"],
      email: "x",
    };
    await expect(
      withCtx(TENANT, () => guard.canActivate(buildCtx(user, { id: MEETING }))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("403 when user is not even a member of the group", async () => {
    const guard = buildGuard({
      meeting: { groupId: GROUP },
      membershipRole: null,
    });
    const user = { userId: USER, tenantId: TENANT, roles: ["lider"], email: "x" };
    await expect(
      withCtx(TENANT, () => guard.canActivate(buildCtx(user, { id: MEETING }))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows when user is lider of the meeting's group", async () => {
    const guard = buildGuard({
      meeting: { groupId: GROUP },
      membershipRole: "lider",
    });
    const user = { userId: USER, tenantId: TENANT, roles: ["lider"], email: "x" };
    await expect(
      withCtx(TENANT, () => guard.canActivate(buildCtx(user, { id: MEETING }))),
    ).resolves.toBe(true);
  });

  it("allows when user is admin of the meeting's group", async () => {
    const guard = buildGuard({
      meeting: { groupId: GROUP },
      membershipRole: "admin",
    });
    const user = { userId: USER, tenantId: TENANT, roles: ["lider"], email: "x" };
    await expect(
      withCtx(TENANT, () => guard.canActivate(buildCtx(user, { id: MEETING }))),
    ).resolves.toBe(true);
  });
});
