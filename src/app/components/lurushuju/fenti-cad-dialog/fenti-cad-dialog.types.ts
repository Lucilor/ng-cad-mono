import {Cad数据要求} from "@app/cad/cad-shujuyaoqiu";
import {ObjectOf} from "@lucilor/utils";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {算料公式} from "../xinghao-data";

export interface FentiCadDialogInput {
  data: FentiCadData;
  cadSize: [number, number];
  cad数据要求?: Cad数据要求;
  gongshis?: 算料公式[];
}

export type FentiCadDialogOutput = ObjectOf<never>;

export type FentiCadData = ObjectOf<HoutaiCad | null | undefined>;

export interface FentiCadItemInfo {
  key: string;
}
