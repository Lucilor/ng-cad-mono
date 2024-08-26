import {ObjectOf} from "@lucilor/utils";
import {HoutaiCad, TableDataBase} from "@modules/http/services/cad-data.service.types";

export type TongyongshujuInput = ObjectOf<never>;

export type TongyongshujuOutput = ObjectOf<never>;

export interface TongyongshujuData extends TableDataBase {
  bangzhuwendang: string;
  cadshaixuanyaoqiu: string;
  cadyaoqiu: string;
  xiaodaohang: string;
  xiaodaohang_id: number;
  xuyaocad: "" | "需要" | "不需要" | "可以没有";

  active?: boolean;
  url?: string;
}

export interface TongyongshujuActiveItem {
  index: number;
  data: TongyongshujuTableItem[];
}

export interface TongyongshujuTableItem extends TableDataBase {
  active: boolean;
}

export interface TongyongshujuActiveCadList {
  index?: number;
  data: HoutaiCad[];
}

export interface TongyongshujuCadItemInfo {
  index: number;
}
