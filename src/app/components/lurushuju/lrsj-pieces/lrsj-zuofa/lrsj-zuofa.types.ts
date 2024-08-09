import {SortedItem, 算料数据, 输入, 选项} from "../../xinghao-data";

export interface ZuofaTab {
  name: string;
  hidden?: boolean;
}

export type XuanxiangTableData = 选项 & {操作?: string};
export type ShuruTableData = 输入 & {操作?: string} & SortedItem;
export type MenjiaoData = 算料数据 & {操作?: string};
