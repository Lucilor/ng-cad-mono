import {FormulasEditorComponent} from "@components/formulas-editor/formulas-editor.component";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {SuanliaoDataParams, 算料公式, 算料数据2} from "../xinghao-data";

export interface SuanliaoTestInput {
  data: 算料数据2;
  varNames: FormulasEditorComponent["varNames"];
  suanliaoDataParams: SuanliaoDataParams;
}

export interface SuanliaoTestOutput {}

export interface SuanliaoTestInfo {
  slgsList: 算料公式[];
  errors: string[];
  allVars: string[];
  requiredVars: string[];
  cads: HoutaiCad[];
}
