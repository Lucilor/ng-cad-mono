import {Formulas} from "@app/utils/calc";
import {ZixuanpeijianMokuaiItem, ZixuanpeijianTypesInfo} from "@components/dialogs/zixuanpeijian/zixuanpeijian.types";
import {isMokuaiItemEqual, updateMokuaiItems} from "@components/dialogs/zixuanpeijian/zixuanpeijian.utils";
import {MsbjPeizhishuju} from "@components/msbj-rects/msbj-rects.types";
import {ObjectOf} from "@lucilor/utils";
import {TableDataBase} from "@modules/http/services/cad-data.service.types";
import {MsbjInfo} from "@views/msbj/msbj.types";

export interface XhmrmsbjTableData extends TableDataBase {
  peizhishuju?: string;
  xinghao?: string;
  jiaoshanbujuhesuoshanxiangtong?: number;
}

export class XhmrmsbjData {
  vid: number;
  name: string;
  menshanbujuInfos: ObjectOf<XhmrmsbjInfo>;
  铰扇跟随锁扇?: boolean;

  constructor(data: XhmrmsbjTableData, menshanKeys: string[], typesInfo: ZixuanpeijianTypesInfo, msbjs: MsbjInfo[]) {
    this.vid = data.vid;
    this.name = data.mingzi;
    this.铰扇跟随锁扇 = data.jiaoshanbujuhesuoshanxiangtong === 1;
    let info: any = null;
    this.menshanbujuInfos = {};
    try {
      info = JSON.parse(data.peizhishuju || "");
    } catch {}
    if (!info || typeof info !== "object") {
      info = {};
    }
    for (const key of menshanKeys) {
      this.menshanbujuInfos[key] = info[key] || {};
      const item = this.menshanbujuInfos[key];
      if (!item.选中布局数据) {
        const msbj = msbjs.find((v) => v.vid === item.选中布局);
        if (msbj) {
          item.选中布局数据 = {vid: msbj.vid, name: msbj.name, 模块大小关系: msbj.peizhishuju.模块大小关系};
        }
      }
      const 模块节点 = item.模块节点 || [];
      for (const v of 模块节点) {
        const 选中模块 = v.选中模块;
        if (选中模块) {
          const i = v.可选模块.findIndex((v2) => isMokuaiItemEqual(v2, 选中模块));
          if (i >= 0) {
            v.可选模块[i] = 选中模块;
          }
        }
        updateMokuaiItems(v.可选模块, typesInfo, true);
        this.setSelectedMokuai(v, 选中模块, true);
      }
    }
  }

  setSelectedMokuai(node: XhmrmsbjInfoMokuaiNode, mokuai: ZixuanpeijianMokuaiItem | undefined | null, setIsDefault: boolean) {
    delete node.选中模块;
    for (const mokuai2 of node.可选模块) {
      const isEqual = mokuai && isMokuaiItemEqual(mokuai2, mokuai);
      if (isEqual) {
        node.选中模块 = mokuai2;
      }
      if (setIsDefault) {
        if (isEqual) {
          if (!mokuai2.info) {
            mokuai2.info = {};
          }
          mokuai2.info.isDefault = true;
        } else {
          if (mokuai2.info?.isDefault) {
            delete mokuai2.info.isDefault;
          }
        }
      }
    }
  }

  setDefaultMokuai(node: XhmrmsbjInfoMokuaiNode, id: number | undefined | null) {
    for (const mokuai2 of node.可选模块) {
      if (mokuai2.id === id) {
        if (!mokuai2.info) {
          mokuai2.info = {};
        }
        mokuai2.info.isDefault = true;
      } else {
        if (mokuai2.info?.isDefault) {
          delete mokuai2.info.isDefault;
        }
      }
    }
  }

  export() {
    for (const key in this.menshanbujuInfos) {
      for (const node of this.menshanbujuInfos[key].模块节点 || []) {
        for (const mokuai of node.可选模块) {
          if (mokuai.info?.isDefault) {
            node.选中模块 = mokuai;
          }
        }
      }
    }
    const data: XhmrmsbjTableData = {
      vid: this.vid,
      mingzi: this.name,
      jiaoshanbujuhesuoshanxiangtong: this.铰扇跟随锁扇 ? 1 : 0,
      peizhishuju: JSON.stringify(this.menshanbujuInfos)
    };
    return data;
  }
}

export interface XhmrmsbjInfo {
  选中布局?: number;
  选中布局数据?: {vid: number; name: string; 模块大小关系: MsbjPeizhishuju["模块大小关系"]};
  模块大小输入?: Formulas;
  模块大小输出?: Formulas;
  模块节点?: XhmrmsbjInfoMokuaiNode[];
}

export interface XhmrmsbjInfoMokuaiNode {
  层id: number;
  层名字: string;
  可选模块: ZixuanpeijianMokuaiItem[];
  选中模块?: ZixuanpeijianMokuaiItem;
}

export const xhmrmsbjTabNames = ["锁边铰边", "门扇模块", "子件更换"] as const;
export type XhmrmsbjTabName = (typeof xhmrmsbjTabNames)[number];
