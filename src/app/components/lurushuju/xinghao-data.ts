import {Formulas} from "@app/utils/calc";
import {isTypeOf, ObjectOf} from "@lucilor/utils";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {MrbcjfzInfo} from "@views/mrbcjfz/mrbcjfz.types";
import {uniq} from "lodash";

export const getXinghao = (raw: XinghaoRaw | null | undefined) => {
  const result: Xinghao = {名字: "", 产品分类: {}, 显示产品分类: [], ...raw};
  if (!isTypeOf(result.产品分类, "object")) {
    result.产品分类 = {};
  }
  return result;
};

export const updateXinghaoFenleis = (xinghao: Xinghao, allFenleis: string[], defaultFenleis: string[]) => {
  for (const fenlei of defaultFenleis) {
    if (!isTypeOf(xinghao.产品分类[fenlei], "array")) {
      xinghao.产品分类[fenlei] = [];
    }
    if (!xinghao.显示产品分类.includes(fenlei)) {
      xinghao.显示产品分类.push(fenlei);
    }
  }
  for (const fenlei in xinghao.产品分类) {
    if (!allFenleis.includes(fenlei)) {
      delete xinghao.产品分类[fenlei];
    }
  }
};

export const getGongyi = (raw: 工艺做法 | null | undefined) => {
  const result: 工艺做法 = {
    tableId: -1,
    名字: "",
    图片: "",
    录入完成: false,
    停用: false,
    输入数据: [],
    选项数据: [],
    CAD模板: null,
    创建时间: 0,
    最后一次修改时间: 0,
    修改记录: [],
    默认值: false,
    ...raw,
    算料数据: (raw?.算料数据 || []).map(get算料数据)
  };
  return result;
};

export const get算料数据 = (raw?: 算料数据 | null) => {
  const result: 算料数据 = {
    vid: "",
    停用: false,
    排序: 0,
    默认值: false,
    名字: "",
    名字2: "",
    产品分类: "",
    开启: [],
    门铰: [],
    门扇厚度: [],
    锁边: "",
    铰边: "",
    选项默认值: {},
    门缝配置: {},
    关闭碰撞检查: false,
    双开门扇宽生成方式: "",
    ...raw,
    "包边在外+外开": get算料数据2(raw?.["包边在外+外开"]),
    "包边在外+内开": get算料数据2(raw?.["包边在外+内开"]),
    "包边在内+外开": get算料数据2(raw?.["包边在内+外开"]),
    "包边在内+内开": get算料数据2(raw?.["包边在内+内开"])
  };
  return result;
};

export const get算料数据2 = (raw?: 算料数据2 | null) => {
  const result: 算料数据2 = {
    配合框CAD: {},
    企料CAD: {},
    算料CAD: [],
    算料公式: [],
    测试完成: false,
    测试用例: [],
    板材分组: {},
    示意图CAD: {
      大扇装配示意图: null,
      小扇装配示意图: null,
      算料单示意图: []
    },
    锁扇正面: "",
    锁扇背面: "",
    小扇正面: "",
    小扇背面: "",
    铰扇正面: "",
    铰扇背面: "",
    花件玻璃信息: [],
    输入数据: [],
    ...raw
  };
  return result;
};

export interface XinghaoRaw {
  名字: string;
  所属门窗?: string;
  所属工艺?: string;
  产品分类?: ObjectOf<工艺做法[]>;
  显示产品分类?: string[];
  订单流程?: string;
}

export interface Xinghao extends XinghaoRaw {
  产品分类: ObjectOf<工艺做法[]>;
  显示产品分类: string[];
}

export interface 选项 {
  名字: string;
  可选项: {vid: number; mingzi: string; morenzhi?: boolean}[];
}

export interface 输入 {
  名字: string;
  默认值: string | number;
  可以修改: boolean;
  取值范围: string;
}

export interface 花件玻璃信息 {
  // 用对象描述，例如固定不可改包框宽包框高，含默认数及允许范围
}

export interface 算料公式 {
  _id: string;
  名字: string;
  选项: ObjectOf<string>;
  条件: string[];
  公式: Formulas;
}

export interface 测试用例 {
  名字: string;
  时间: number;
  测试数据: Formulas;
  测试正确: boolean;
}

export interface 工艺做法 {
  // 数据大小应小于3M
  tableId: number;
  名字: string; // '做法1',
  图片: string;
  录入完成: boolean;
  默认值: boolean;
  停用: boolean;
  输入数据: 输入[];
  选项数据: 选项[];
  算料数据: 算料数据[];
  CAD模板: HoutaiCad | null; // 选择后台的CAD模板
  创建时间: number; // 不带小数的时间戳
  最后一次修改时间: number; // 不带小数的时间戳
  修改记录: {
    修改人: string;
    修改时间: number; // 不带小数的时间戳
  }[];
}

export interface 算料数据2 {
  配合框CAD: ObjectOf<配合框CAD>;
  企料CAD: ObjectOf<企料CAD>;
  算料CAD: HoutaiCad[];
  算料公式: 算料公式[];
  测试完成: boolean; // 不可编辑，要求必须有一个测试用例，否则不能算完成
  测试用例: 测试用例[];
  板材分组: ObjectOf<MrbcjfzInfo>;
  示意图CAD: {
    大扇装配示意图: HoutaiCad | null; // 要求分类: 装配示意图
    小扇装配示意图: HoutaiCad | null; // 要求分类: 装配示意图
    算料单示意图: HoutaiCad[]; // 要求分类: 算料单示意图
  };
  锁扇正面: string;
  锁扇背面: string;
  小扇正面: string;
  小扇背面: string;
  铰扇正面: string;
  铰扇背面: string;
  花件玻璃信息: 花件玻璃信息[];
  输入数据: 输入[];
}

export const 算料数据2Keys = ["配合框CAD", "企料CAD"] as const;
export const xiaoguotuKeys: (keyof 算料数据2)[] = ["锁扇正面", "锁扇背面", "小扇正面", "小扇背面", "铰扇正面", "铰扇背面"];

export interface 算料数据 {
  vid: string;
  停用: boolean;
  排序: number;
  默认值: boolean;

  名字: string;
  名字2: string;
  产品分类: string;
  开启: string[];
  门铰: string[];
  门扇厚度: string[];
  锁边: string;
  铰边: string;
  选项默认值: ObjectOf<string>;

  "包边在外+外开": 算料数据2;
  "包边在外+内开": 算料数据2;
  "包边在内+外开": 算料数据2;
  "包边在内+内开": 算料数据2;

  门缝配置: 门缝配置;
  关闭碰撞检查: boolean;
  双开门扇宽生成方式: string;
  锁扇铰扇蓝线宽固定差值?: number;
}

export const menjiaoCadTypes = ["包边在外+外开", "包边在外+内开", "包边在内+外开", "包边在内+内开"] as const;
export type MenjiaoCadType = (typeof menjiaoCadTypes)[number];

export interface 企料CAD {
  // 从符合分类企料CAD里面选择，分类对应关系
  // 锁企料：锁企料
  // 扇锁企料：锁企料、扇锁企料
  // 铰企料：铰企料
  // 小扇铰企料：铰企料、小扇铰企料
  // 小锁料：小锁料
  // 小扇小锁料：小锁料、小扇小锁料
  // 中锁料：中锁料
  // 中铰料：中铰料
  cad?: HoutaiCad;

  企料宽读哪里?: "标注" | "CAD正面" | "CAD背面"; // 标注有【正面宽、背面宽、企料宽】
  // 问题1：怎么读取正面宽，背面宽？1、根据颜色（有特殊结构时怎么处理）；2、新增加表标注（需要改程序、改数据）

  企料宽默认值?: number;
  正面宽默认值?: number; // 默认留空从CAD读取
  背面宽默认值?: number; // 默认留空从CAD读取
  正背面宽同时修改?: boolean; // 后台数据，默认没有值，必须设置
  默认宽规则?: 企料默认宽取值规则[]; // 按一条添加生成

  特定企料配置?: 特定企料配置; // 暂时不处理

  // 锁企料，扇锁企料有这个要求
  拉手孔中心到锁体面距离最小值?: number; // 默认0，没要求；有要求时，需要程序做判断选择的锁体是否合适

  // 虚拟企料和企料分体
  是虚拟企料?: boolean;
  企料分体CAD?: {正面分体: HoutaiCad; 背面分体: HoutaiCad}; // 现在分体按照名字对线长
  是否可以开槽?: boolean; // 详细见【金山文档】 企料开槽数据录入教程 https://kdocs.cn/l/cbmU8dXOnCI4
  需要显示指定位置分体?: boolean;
  需要显示指定位置刨坑?: boolean;

  // 自动判断或者根据设置判断企料包边类型，然后得到实际的包边内间隙
  企料包边类型?: string; // // 不允许为空，必须赋值，这样可以减少程序复杂性

  // 算料CAD要求
  // (1) 企料CAD必须指定企料包边类型
  // (2) 不再读CAD取线名字标注作为变量;这样不用预先处理【算料CAD、示意图CAD】相关的信息
  // (3)
}

export interface 配合框CAD {
  cad?: HoutaiCad;
}

export const 配合框组合: ObjectOf<string[]> = {};
export const 企料排列: ObjectOf<string[]> = {
  单门: ["铰企料", "锁企料"],
  子母对开: ["小扇铰企料", "小扇小锁料", "扇锁企料", "铰企料"],
  双开: ["小扇铰企料", "小扇小锁料", "扇锁企料", "铰企料"],
  子母连开: ["铰企料", "中锁料", "中铰料", "锁企料"],
  四扇子母: ["铰企料", "中锁料", "中铰料", "小锁料", "扇锁企料", "中铰料", "中锁料", "铰企料"],
  四扇平分: ["铰企料", "中锁料", "中铰料", "小锁料", "扇锁企料", "中铰料", "中锁料", "铰企料"],
  六扇平分: ["铰企料", "中锁料", "中铰料", "中锁料", "中铰料", "小锁料", "扇锁企料", "中铰料", "中锁料", "中铰料", "中锁料", "铰企料"]
};
export const 企料组合: ObjectOf<string[]> = {};
for (const key in 企料排列) {
  if (["单门", "子母连开"].includes(key)) {
    配合框组合[key] = ["铰框", "锁框", "顶框"];
  } else {
    配合框组合[key] = ["铰框", "顶框"];
  }
  企料组合[key] = uniq(企料排列[key]);
}

export const cadMatchRules: ObjectOf<{分类: string[]; 选项: (keyof 算料数据)[]}> = {
  锁框: {分类: ["锁框"], 选项: []},
  铰框: {分类: ["铰框"], 选项: []},
  顶框: {分类: ["顶框"], 选项: []},

  锁企料: {分类: ["锁企料"], 选项: []},
  铰企料: {分类: ["铰企料"], 选项: []},
  扇锁企料: {分类: ["锁企料", "扇锁企料"], 选项: []},
  小锁料: {分类: ["小锁料"], 选项: []},
  小扇小锁料: {分类: ["小锁料", "小扇小锁料"], 选项: []},
  小扇铰企料: {分类: ["铰企料", "小扇铰企料"], 选项: []},

  中锁料: {分类: ["中锁料"], 选项: []},
  中铰料: {分类: ["中铰料"], 选项: []}
};

export type 门缝配置 = ObjectOf<number>;

export const 门缝配置输入: {name: string; defaultValue: number | null}[] = [
  {name: "锁边门缝", defaultValue: null},
  {name: "铰边门缝", defaultValue: null},
  {name: "顶部门缝", defaultValue: null},
  {name: "底部门缝", defaultValue: null},
  {name: "上下包边内间隙", defaultValue: 0},
  {name: "锁包边内间隙", defaultValue: 0},
  {name: "铰包边内间隙", defaultValue: 0}
];

export interface 企料默认宽取值规则 {
  条件: string;
  默认宽: number;
  默认正面宽: number;
  默认背面宽: number;
}

export interface 特定企料配置 {
  前板CAD: HoutaiCad; // 特定企料用
  后板CAD: HoutaiCad; // 特定企料用
  前板做平: boolean; // 特定企料用
  后板做平: boolean; // 特定企料用
  前企料结构: 选项; // 例如：薄压边、厚压边、正常
  后企料结构: 选项; // 例如：薄压边、厚压边、正常
  前分体拼接结构: string; // 例如：前封口15，可以绑定CAD,
  后分体拼接结构: string; // 例如：后封口15，可以绑定CAD,
}

export interface SuanliaoDataParams {
  选项: {
    型号: string;
    工艺做法: string;
    包边方向: string;
    开启: string;
    门铰锁边铰边: string;
  };
}

export const 孔位CAD名字对应关系: ObjectOf<string> = {
  锁框: "锁包边",
  铰框: "铰包边",
  顶框: "顶包边"
};
