/**
 * Relation adapters for unifying v0 and v1 relation APIs
 *
 * This module provides adapters that convert both legacy relations() (v0)
 * and modern defineRelations() (v1) to a unified format.
 */

export type { RelationAdapter, UnifiedRelation } from "./types";
export { V0RelationAdapter } from "./v0-adapter";
export { V1RelationAdapter } from "./v1-adapter";
