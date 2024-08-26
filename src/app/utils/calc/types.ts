import {ObjectOf} from "@lucilor/utils";

export type Formulas = ObjectOf<string | number>;

export interface ExpressionInfo {
  exp: string;
  vars: string[];
}

export interface ExpressionDeps {
  [key: string]: ExpressionDeps | string[];
}

export interface FormulaInfo {
  vars: string[];
  depth: number;
  deps: ExpressionDeps;
  exp: string;
}
