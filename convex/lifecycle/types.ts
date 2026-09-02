/**
 * @fileoverview Shared Lifecycle Interfaces and Types.
 */

export interface CascadeRule {
  readonly table: string;
  readonly from: readonly string[];
  readonly to: string;
}

export interface TransitionDef<TState extends string = string, TRole extends string = string> {
  readonly name: string;
  readonly label?: string;
  readonly from: readonly TState[];
  readonly to: TState;
  readonly roles: readonly TRole[];
  readonly actor?: string;
  readonly guards?: readonly string[];
  readonly cascades?: readonly CascadeRule[];
  readonly requiresNote?: boolean;
}
