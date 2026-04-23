import type { BalanzasNodeData } from "@/lib/postcosecha-balanzas";
import type { ProcessElement } from "@/modules/postcosecha/lib/balanzas-process-engine-helpers";
import {
  getProcessSelection,
  type BalanzasProcessSelection,
} from "@/modules/postcosecha/lib/balanzas-process-stages";
import { isInteractiveProcessNode } from "@/modules/postcosecha/lib/balanzas-process-engine-helpers";

type ElementRegistryLike = {
  get: (id: string) => ProcessElement | undefined;
};

export type BindingValidationIssue = {
  nodeKey: string;
  taskName: string;
  elementId: string | null;
  reason: "missing-element-id" | "element-not-found";
};

export type BindingValidationResult = {
  checked: number;
  missing: BindingValidationIssue[];
};

/**
 * Walks every interactive node and confirms that each `processBindings[].elementId`
 * resolves to a real element in the BPMN registry. Returns the list of offenders.
 * Non-interactive nodes (preclasificacion / apertura roots) are skipped on purpose.
 */
export function validateBindings(
  nodes: BalanzasNodeData[],
  elementRegistry: ElementRegistryLike,
): BindingValidationResult {
  const missing: BindingValidationIssue[] = [];
  let checked = 0;

  for (const node of nodes) {
    if (!isInteractiveProcessNode(node)) {
      continue;
    }

    for (const binding of node.processBindings) {
      checked += 1;

      if (!binding.elementId) {
        missing.push({
          nodeKey: node.key,
          taskName: binding.taskName,
          elementId: null,
          reason: "missing-element-id",
        });
        continue;
      }

      if (!elementRegistry.get(binding.elementId)) {
        missing.push({
          nodeKey: node.key,
          taskName: binding.taskName,
          elementId: binding.elementId,
          reason: "element-not-found",
        });
      }
    }
  }

  return { checked, missing };
}

/**
 * Dev-only warning. Silent in production so no noisy browser console in prod
 * but loud enough during development to catch drift between core definitions
 * and the BPMN XML.
 */
export function reportBindingDrift(result: BindingValidationResult) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  if (!result.missing.length) {
    return;
  }

  console.warn(
    `[balanzas] binding drift: ${result.missing.length} of ${result.checked} bindings did not resolve.\n` +
      result.missing
        .map(
          (issue) =>
            `  - node=${issue.nodeKey} task=${issue.taskName} elementId=${issue.elementId ?? "<missing>"} reason=${issue.reason}`,
        )
        .join("\n"),
  );
}

/**
 * Strict resolution: only exact `elementId` match. No Y-bound fallback,
 * no fuzzy name match. Returns null if the element does not correspond to
 * any interactive node's binding.
 */
export function resolveStrictProcessSelection(
  nodes: BalanzasNodeData[],
  element: ProcessElement,
): BalanzasProcessSelection | null {
  for (const node of nodes) {
    if (!isInteractiveProcessNode(node)) {
      continue;
    }

    for (const binding of node.processBindings) {
      if (binding.elementId && binding.elementId === element.id) {
        return getProcessSelection(node.key);
      }
    }
  }

  return null;
}
