import {XiaodaohangStructure} from "@app/app.common";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf} from "@lucilor/utils";
import {BancaiList, BancaiListData, TableDataBase} from "@modules/http/services/cad-data.service.types";
import {InputInfo} from "@modules/input/components/input.types";
import {MrbcjfzXinghaoInfo} from "./mrbcjfz.utils";

export interface MrbcjfzResponseData {
  xinghao: MrbcjfzXinghao;
  cads: any[];
  huajians: MrbcjfzHuajian[];
  qiliaos: string[];
  bancaiKeys: string[];
  bancaiKeysRequired: string[];
  bancaiList: BancaiList[];
  xiaodaohangStructure: XiaodaohangStructure;
}

export interface MrbcjfzXinghao extends TableDataBase {
  morenbancai?: string;
  gongshishuru?: string;
  编辑默认对应板材分组?: boolean;
}

export interface MrbcjfzHuajian extends TableDataBase {
  xiaotu?: string;
  shihuajian?: number;
  bangdingqianbankuanshicad?: string;
  bangdinghoubankuanshicad?: string;
}

export interface MrbcjfzInfo {
  默认开料板材: string;
  默认开料材料: string;
  默认开料板材厚度: string;
  默认对应板材分组: string;
  选中板材: string;
  选中材料: string;
  选中板材厚度: string;
  选中板材分组: string;
  可选板材?: string[];
  可选材料?: string[];
  可选厚度?: string[];
  花件: string[];
  CAD: string[];
  企料: string[];
  板材分组别名?: string;
  允许修改?: boolean;
  独立变化?: boolean;
  不显示?: boolean;
  不显示内容?: MrbcjfzInfoShowItem[];
  门扇使用限制?: MrbcjfzMsxzItem;
}

export const mrbcjfzInfoShowItems = ["颜色", "材料", "厚度", "结果"] as const;
export type MrbcjfzInfoShowItem = (typeof mrbcjfzInfoShowItems)[number];

export const mrbcjfzMsxzItems = ["无限制", "子母小扇", "子母大扇", "双开铰扇"] as const;
export type MrbcjfzMsxzItem = (typeof mrbcjfzMsxzItems)[number];

export interface MrbcjfzBancaiInputs {
  bancai: InputInfo<MrbcjfzInfo>;
  cailiao: InputInfo<MrbcjfzInfo>;
  houdu: InputInfo<MrbcjfzInfo>;
}

export interface MrbcjfzListItem {
  id: string;
  selected?: boolean;
  isVirtual?: boolean;
}

export const listItemKeys = ["CAD", "花件", "企料"] as const;
export type ListItemKey = (typeof listItemKeys)[number];

export interface MrbcjfzCadInfo extends MrbcjfzListItem {
  data: CadData;
}

export interface MrbcjfzHuajianInfo extends MrbcjfzListItem {
  data: MrbcjfzHuajian;
}

export interface MrbcjfzQiliaoInfo extends MrbcjfzListItem {
  name: string;
}

export interface MrbcjfzInputData {
  xinghao: string;
  morenbancai: ObjectOf<MrbcjfzInfo>;
  cads?: CadData[];
  huajians?: MrbcjfzHuajian[];
  isLocal?: boolean;
  bancaiList?: BancaiListData;
}

export interface MrbcjfzDataSubmitEvent {
  data: MrbcjfzXinghaoInfo;
  errors: string[];
  submit2?: boolean;
}
