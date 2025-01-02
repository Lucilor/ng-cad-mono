import {ValidationErrors} from "@angular/forms";
import {Formulas} from "@app/utils/calc";

export interface FormulasChangeEvent {
  formulas: Formulas;
  errors: string[];
}

export type FormulasValidatorFn = (formulaList: string[][]) => ValidationErrors | null;

export interface FormulasCompactConfig {
  minRows?: number;
  maxRows?: number;
  editOn?: boolean;
  noToolbar?: boolean;
}
