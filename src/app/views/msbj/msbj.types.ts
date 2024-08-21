import {Formulas} from "@app/utils/calc";
import mokuaidaixiaoData from "@assets/json/mokuaidaxiao.json";
import {MsbjPeizhishuju, MsbjRectInfoRaw} from "@components/msbj-rects/msbj-rects.types";
import {ObjectOf} from "@lucilor/utils";
import {TableDataBase} from "@modules/http/services/cad-data.service.types";

export class MsbjInfo {
  vid: number;
  name: string;
  xiaoguotu?: string;
  peizhishuju: MsbjPeizhishuju;

  constructor(
    public rawData: MsbjData,
    node2rectData?: Node2rectData
  ) {
    this.vid = rawData.vid;
    this.name = rawData.mingzi;
    this.xiaoguotu = rawData.xiaoguotu;

    let peizhishuju: MsbjPeizhishuju | null = null;
    try {
      peizhishuju = JSON.parse(rawData.peizhishuju as any);
    } catch {}
    if (!peizhishuju) {
      peizhishuju = {模块节点: []};
    }
    this.peizhishuju = peizhishuju;
    this.updateRectsInfo(node2rectData);
    if (!peizhishuju.模块大小关系) {
      peizhishuju.模块大小关系 = mokuaidaixiaoData;
    }
  }

  updateRectsInfo(data?: Node2rectData) {
    const peizhishuju = this.peizhishuju;
    let rectInfos1: MsbjRectInfoRaw[] | null = null;
    try {
      rectInfos1 = window.node2rect(JSON.parse(this.rawData.node || ""), data);
    } catch {}
    peizhishuju.模块节点 = rectInfos1 || [];
  }
}

export interface MsbjFenlei extends TableDataBase {
  selected?: boolean;
}

export interface MsbjData extends TableDataBase {
  peizhishuju?: string;
  node?: string;
  menshanweizhi?: string;
  xiaoguotu?: string;
}

export interface Node2rectData {
  模块层ID: ObjectOf<number>;
  当前扇名字: string;
  门扇大小: Formulas;
  模块大小: Formulas;
}

export const node2rectDataMsdxKeys = ["锁扇正面总宽", "锁扇背面总宽", "铰扇正面总宽", "铰扇背面总宽", "包框高"];

declare global {
  interface Window {
    node2rect(node: any, data?: Node2rectData): MsbjRectInfoRaw[];
  }
}
