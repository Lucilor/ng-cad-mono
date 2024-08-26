import {XiaodaohangColumn} from "@app/app.common";
import {算料公式} from "@app/components/lurushuju/xinghao-data";
import {Formulas} from "@app/utils/calc";
import {KailiaocanshuData} from "@components/klcs/klcs.component";
import {KlkwpzSource} from "@components/klkwpz/klkwpz";
import {CadData, CadMtext, CadViewerConfig} from "@lucilor/cad-viewer";
import {ObjectOf} from "@lucilor/utils";
import {BancaiList} from "@modules/http/services/cad-data.service.types";
import {InputInfo} from "@modules/input/components/input.types";
import {MrbcjfzInfo} from "@views/mrbcjfz/mrbcjfz.types";
import {SuanliaoCalcError} from "@views/suanliao/suanliao.types";
import {XhmrmsbjInfo} from "@views/xhmrmsbj/xhmrmsbj.types";

export interface ZixuanpeijianTypesInfoItem {
  id: number;
  weiyima: string;
  xiaoguotu: string;
  gongshishuru: string[][];
  xuanxiangshuru: string[][];
  shuchuwenben: string[][];
  suanliaogongshi: Formulas;
  shuchubianliang: string[];
  xinghaozhuanyong: string[];
  mokuaishuoming: string;
  unique: boolean;
  shuruzongkuan: boolean;
  shuruzonggao: boolean;
  morenbancai: ObjectOf<MrbcjfzInfo> | null;
  standalone?: boolean;
  ceshishuju?: Formulas;
  calcVars?: {keys: string[]; result?: Formulas};
  zhizuoren?: string;
}
export type ZixuanpeijianTypesInfo = ObjectOf<ObjectOf<ZixuanpeijianTypesInfoItem>>;

export interface ZixuanpeijianTypesInfoItem2 extends ZixuanpeijianTypesInfoItem {
  disableAdd?: boolean;
  hidden?: boolean;
}
export type ZixuanpeijianTypesInfo2 = ObjectOf<ObjectOf<ZixuanpeijianTypesInfoItem2>>;

export interface ZixuanpeijianInputsInfoItem {
  totalWidth: InputInfo;
  totalHeight: InputInfo;
  gongshishuru: InputInfo[][];
}
export type ZixuanpeijianInputsInfos = ObjectOf<ObjectOf<ZixuanpeijianInputsInfoItem>>;

export interface ZixuanpeijianData {
  模块?: ZixuanpeijianMokuaiItem[];
  零散?: ZixuanpeijianCadItem[];
  备注?: CadMtext[];
  文本映射?: ObjectOf<string>;
  输出变量?: ObjectOf<string>;
  测试数据?: Formulas[];
}

export interface ZixuanpeijianInput {
  step: number;
  data?: ZixuanpeijianData;
  checkEmpty?: boolean;
  cadConfig?: Partial<CadViewerConfig>;
  order?: {code: string; type: string; materialResult?: Formulas};
  dropDownKeys?: string[];
  stepFixed?: boolean;
  可替换模块?: boolean;
  step1Data?: Step1Data;
  noValidateCads?: boolean;
  readonly?: boolean;
  lingsanOptions?: {getAll?: boolean; useTypePrefix?: boolean; xinghao?: string};
  lingsanCadType?: string;
  gongshis?: 算料公式[];
}

export type ZixuanpeijianOutput = Required<ZixuanpeijianData>;

export interface ZixuanpeijianInfo {
  houtaiId: string;
  zhankai: {width: string; height: string; num: string; originalWidth: string; cadZhankaiIndex?: number}[];
  calcZhankai: any[];
  bancai?: BancaiList & {cailiao?: string; houdu?: string};
  translate?: [number, number];
  hidden?: boolean;
  dimensionVars?: Formulas;
  开料孔位配置?: KlkwpzSource;
  开料参数?: KailiaocanshuData;
  门扇名字?: string;
  门扇布局?: XhmrmsbjInfo["选中布局数据"];
  层id?: number;
  模块名字?: string;
}

export interface Bancai extends BancaiList {
  cailiao?: string;
  houdu?: string;
}

export interface ZixuanpeijianCadItem {
  data: CadData;
  displayedData?: CadData;
  info: ZixuanpeijianInfo;
}

export interface ZixuanpeijianMokuaiItem extends ZixuanpeijianTypesInfoItem {
  type1: string;
  type2: string;
  totalWidth: string;
  totalHeight: string;
  cads: ZixuanpeijianCadItem[];
  可替换模块?: ZixuanpeijianMokuaiItem[];
  vars?: Formulas;
  info?: {门扇名字?: string; 门扇布局?: XhmrmsbjInfo["选中布局数据"]; 模块名字?: string; 层id?: number; isDefault?: boolean};
}

export interface CadItemInputInfo {
  zhankai: {
    width: InputInfo;
    height: InputInfo;
    num: InputInfo;
  }[];
  板材: InputInfo;
  材料: InputInfo;
  厚度: InputInfo;
}

export interface MokuaiInputInfos {
  总宽: InputInfo<ZixuanpeijianMokuaiItem>;
  总高: InputInfo<ZixuanpeijianMokuaiItem>;
  公式输入: InputInfo[];
  选项输入: InputInfo[];
  输出文本: InputInfo[];
  cads: CadItemInputInfo[];
}

export interface ZixuanpeijianlingsanCadItem {
  data: CadData;
  hidden: boolean;
  isFetched: boolean;
  active?: boolean;
  selected?: boolean;
  toDelete?: boolean;
}

export interface CadItemContext {
  $implicit: ZixuanpeijianCadItem;
  i: number;
  j: number;
  type: "模块" | "零散";
}

export interface Step1Data {
  typesInfo: ZixuanpeijianTypesInfo;
  options: ObjectOf<string[]>;
}

export interface CalcZxpjResult {
  fulfilled: boolean;
  门扇布局大小?: ObjectOf<Formulas>;
  error?: SuanliaoCalcError;
}

export interface LingsanCadItemInfo {
  index: number;
}

export interface LingsanTypesData {
  typesMap: TypesMapNode[];
  tables: {name: string; column?: XiaodaohangColumn}[];
}

export interface TypesMapNode {
  id: number;
  name: string;
  level: number;
  order: number;
  label?: string;
  cadCount?: number;
  hidden?: boolean;
  hidden2?: boolean;
  children: TypesMapNode[];
}
