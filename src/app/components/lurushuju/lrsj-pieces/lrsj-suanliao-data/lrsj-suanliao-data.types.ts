import {MenjiaoCadType} from "../../xinghao-data";

export interface MenjiaoCadItemInfo {
  key1: MenjiaoCadType;
  key2: "配合框CAD" | "企料CAD";
  key3: string;
}

export interface MenjiaoShiyituCadItemInfo {
  key1: MenjiaoCadType;
  index: number;
}

export const suanliaoDataBtnNames = ["保存", "选项信息", "门缝参数", "包边+企料数据", "板材分组", "CAD配置", "模块布局"] as const;
export type SuanliaoDataBtnName = (typeof suanliaoDataBtnNames)[number];
