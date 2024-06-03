import {Formulas} from "@app/utils/calc";
import {FormulaInfo} from "@components/formulas/formulas.component";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf} from "@lucilor/utils";
import {Properties} from "csstype";

export interface Order {
  code: string;
  开启锁向示意图?: {data: CadData; img: string; style: Properties};
  配合框?: {data: CadData; img: string; style: Properties}[];
  materialResult?: Formulas;
  cads: {
    houtaiId: string;
    data: CadData;
    isLarge: boolean;
    img: string;
    imgLarge?: string;
    imgSize: [number, number];
    style: Properties;
    imgStyle: Properties;
    zhankai?: {width: string; height: string; num?: string}[];
  }[];
  positions: number[][];
  style: Properties;
  info: ObjectOf<string | number>[] | null;
  forms?: Form[];
  mokuaiInfo?: {
    index: number;
    details: {title?: string; value: string}[];
    formulaInfos: {title: string; infos: FormulaInfo[]}[];
  };
}

export interface SectionCell {
  key: string;
  label?: string;
  isBoolean?: boolean;
  class?: string | string[];
  style?: Properties;
}

export interface SectionConfig {
  rows: {
    cells: SectionCell[];
  }[];
}

export type DdbqData = {
  code: string;
  materialResult?: Formulas;
  cads?: ObjectOf<any>[];
  开启锁向示意图?: ObjectOf<any>;
  配合框?: ObjectOf<any>[];
  forms?: Form[];
}[];

export interface Form {
  title?: string;
  barCode?: string;
  rows: FormItem[][];
}

export interface FormItem {
  label: string;
  value: string;
  type?: "text" | "image";
  style?: Properties;
  labelStyle?: Properties;
  valueStyle?: Properties;
}

export type DdbqType = "标签贴纸" | "质检标签" | "配件模块" | "合格证" | "流程指令卡" | "生产流程单";
