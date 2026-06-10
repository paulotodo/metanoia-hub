import { Injectable } from '@nestjs/common';
import type { TenantTx } from '../../prisma/with-tenant-tx';

/**
 * CircularDependencyValidator — detects cycles in the module prerequisite graph.
 *
 * Uses iterative DFS. A cycle exists when we can reach the starting node
 * by following prerequisite edges.
 */
@Injectable()
export class CircularDependencyValidator {
  /**
   * Returns true if adding prerequisiteModuleId as a prerequisite of moduleId
   * would create a cycle in the current graph.
   *
   * @param tx           - tenant-scoped Prisma transaction
   * @param moduleId     - the module we want to add a prerequisite to
   * @param prereqId     - the candidate prerequisite module
   */
  async wouldCreateCycle(
    tx: TenantTx,
    moduleId: string,
    prereqId: string,
  ): Promise<boolean> {
    // A cycle would exist if prereqId can already reach moduleId via existing
    // prerequisites. We do BFS/DFS from prereqId; if we hit moduleId, it's a cycle.
    const visited = new Set<string>();
    const queue: string[] = [prereqId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      if (current === moduleId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all modules that current is a prerequisite of (current → downstream)
      // We need the REVERSE: what modules does current depend on (its prerequisites)?
      const prerequisites = await tx.modulePrerequisite.findMany({
        where: { moduleId: current },
        select: { prerequisiteModuleId: true },
      });

      for (const { prerequisiteModuleId } of prerequisites) {
        if (!visited.has(prerequisiteModuleId)) {
          queue.push(prerequisiteModuleId);
        }
      }
    }

    return false;
  }

  /**
   * Returns true if adding prereqId creates a self-reference.
   */
  isSelfReference(moduleId: string, prereqId: string): boolean {
    return moduleId === prereqId;
  }
}
