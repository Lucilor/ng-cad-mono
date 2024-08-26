import {MatDialog} from "@angular/material/dialog";
import {getCadTotalLength, getShuangxiangLineRects, setShuangxiangLineRects, splitShuangxiangCad} from "@app/cad/utils";
import {getCADBeishu} from "@app/utils/beishu";
import {Formulas, toFixed} from "@app/utils/calc";
import {matchOrderData} from "@app/utils/mongo";
import {nameEquals} from "@app/utils/zhankai";
import zxpjTestData from "@assets/json/zixuanpeijian.json";
import zixuanpeijianTypesInfo from "@assets/json/zixuanpeijianTypesInfo.json";
import {CadData, CadMtext, CadZhankai, setLinesLength} from "@lucilor/cad-viewer";
import {ObjectOf} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {BancaiList} from "@modules/http/services/cad-data.service.types";
import {HttpOptions} from "@modules/http/services/http.service.types";
import {MessageService} from "@modules/message/services/message.service";
import {CalcService} from "@services/calc.service";
import {isMrbcjfzInfoEmpty1} from "@views/mrbcjfz/mrbcjfz.utils";
import {matchConditions} from "@views/suanliao/suanliao.utils";
import {cloneDeep, difference, intersection, isEmpty, isEqual, union} from "lodash";
import md5 from "md5";
import {openDrawCadDialog} from "../draw-cad/draw-cad.component";
import {
  CalcZxpjResult,
  Step1Data,
  ZixuanpeijianCadItem,
  ZixuanpeijianData,
  ZixuanpeijianInfo,
  ZixuanpeijianInput,
  ZixuanpeijianMokuaiItem,
  ZixuanpeijianOutput,
  ZixuanpeijianTypesInfo,
  ZixuanpeijianTypesInfoItem
} from "./zixuanpeijian.types";

export const getTestData = () => {
  const data: Required<ZixuanpeijianInput> = {
    step: 1,
    checkEmpty: true,
    stepFixed: false,
    cadConfig: {},
    data: {
      模块: zxpjTestData.模块.map((item) => ({
        ...item,
        cads: item.cads.map((cadItem) => ({...cadItem, data: new CadData()}))
      })),
      零散: zxpjTestData.模块.flatMap((item) => item.cads.map((cadItem) => ({...cadItem, data: new CadData()})))
    },
    order: {code: "1", type: "order", materialResult: zxpjTestData.输出变量},
    dropDownKeys: ["总宽", "总高"],
    可替换模块: true,
    step1Data: zixuanpeijianTypesInfo,
    noValidateCads: false,
    readonly: false,
    lingsanOptions: {},
    lingsanCadType: "",
    gongshis: []
  };
  return data;
};

export const importZixuanpeijian = (source: ZixuanpeijianData = {}) => {
  const result: ZixuanpeijianOutput = {
    模块: [],
    零散: [],
    备注: [],
    文本映射: {},
    输出变量: {},
    测试数据: []
  };
  for (const key2 in source) {
    const key = key2 as keyof ZixuanpeijianData;
    if (isEmpty(source[key])) {
      continue;
    }
    result[key] = source[key] as any;
  }
  for (const item of result.模块) {
    for (const cad of item.cads) {
      cad.data = new CadData(cad.data);
      if (cad.displayedData) {
        cad.displayedData = new CadData(cad.displayedData);
      }
    }
    if (item.可替换模块) {
      item.可替换模块 = importZixuanpeijian({模块: item.可替换模块}).模块;
    }
  }
  for (const item of result.零散) {
    if (!(item.data instanceof CadData)) {
      item.data = new CadData(item.data);
    }
    if (item.displayedData) {
      item.displayedData = new CadData(item.displayedData);
    }
  }
  result.备注 = result.备注.map((v) => new CadMtext(v));
  return result;
};

export const exportZixuanpeijian = (source: ZixuanpeijianData) => {
  const result: ObjectOf<any> = {};
  const getCadItem = (item: ZixuanpeijianCadItem) => ({
    ...item,
    data: item.data.export(),
    displayedData: item.displayedData?.export()
  });
  for (const key2 in source) {
    const key = key2 as keyof ZixuanpeijianData;
    if (isEmpty(source[key])) {
      continue;
    }
    if (key === "模块") {
      result[key] = source[key]?.map((item) => {
        const item2 = {
          ...item,
          cads: item.cads.map(getCadItem)
        };
        if (item.可替换模块) {
          item2.可替换模块 = exportZixuanpeijian({模块: item.可替换模块}).模块;
        }
        return item2;
      });
    } else if (key === "零散") {
      result[key] = source[key]?.map(getCadItem);
    } else if (key === "备注") {
      result[key] = source[key]?.map((v) => v.export());
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

export const getMokuaiTitle = (
  item: ZixuanpeijianMokuaiItem | undefined | null,
  opts?: {门扇名字?: string; 层名字?: string; type1As?: string}
) => {
  if (!item) {
    return "";
  }
  const {type1, type2, info} = item;
  if (!type1 && !type2) {
    return "";
  }
  const arr: string[] = [];
  let {门扇名字, 层名字} = opts || {};
  const {type1As} = opts || {};
  if (!门扇名字) {
    门扇名字 = info?.门扇名字;
  }
  if (!层名字) {
    层名字 = info?.模块名字;
  }
  if (typeof 门扇名字 === "string" && 门扇名字) {
    arr.push(门扇名字);
  }
  if (typeof 层名字 === "string" && 层名字) {
    arr.push(层名字);
  }
  arr.push(`${type1As || type1}【${type2}】`);
  return arr.join(" - ");
};

export const getStep1Data = async (
  http: CadDataService,
  httpOptions: HttpOptions,
  params?: {code: string; type: string} | {mokuaiIds: string[]}
) => {
  return await http.getData<Step1Data>("ngcad/getZixuanpeijianTypesInfo", params, httpOptions);
};

export const getZixuanpeijianCads = async (
  http: CadDataService,
  httpOptions: HttpOptions,
  typesInfo: ObjectOf<ObjectOf<1>>,
  materialResult: Formulas = {}
) => {
  const data = await http.getData<{cads: ObjectOf<ObjectOf<any[]>>; bancais: BancaiList[]}>(
    "ngcad/getZixuanpeijianCads",
    {typesInfo},
    httpOptions
  );
  if (data) {
    const cads: ObjectOf<ObjectOf<CadData[]>> = {};
    const {cads: cadsRaw, bancais} = data;
    for (const type1 in cadsRaw) {
      cads[type1] = {};
      for (const type2 in cadsRaw[type1]) {
        cads[type1][type2] = [];
        for (const v of cadsRaw[type1][type2]) {
          const cadData = new CadData(v);
          delete cadData.options.功能分类;
          delete cadData.options.配件模块;
          cads[type1][type2].push(cadData);
        }
        if (!isEmpty(materialResult)) {
          cads[type1][type2] = matchOrderData(cads[type1][type2], materialResult);
        }
      }
    }
    return {cads, bancais};
  }
  return undefined;
};

export const updateMokuaiItems = (items: ZixuanpeijianMokuaiItem[], typesInfo: ZixuanpeijianTypesInfo, useSlgs = false) => {
  for (const type1 in typesInfo) {
    for (const type2 in typesInfo[type1]) {
      const info = cloneDeep(typesInfo[type1][type2]);
      for (const item of items) {
        if (isMokuaiItemEqual(item, info)) {
          item.type1 = type1;
          item.type2 = type2;
          const {gongshishuru, xuanxiangshuru, suanliaogongshi, morenbancai} = item;
          Object.assign(item, info);
          if (useSlgs) {
            const getValue = (key: string, value: string) => {
              if (!value && suanliaogongshi && key in suanliaogongshi) {
                return String(suanliaogongshi[key]);
              }
              return value;
            };
            item.totalWidth = getValue("总宽", item.totalWidth);
            item.totalHeight = getValue("总高", item.totalHeight);
          }
          for (const v of item.gongshishuru) {
            if (!v[1]) {
              v[1] = gongshishuru.find((v2) => v2[0] === v[0])?.[1] || v[1];
            }
          }
          for (const v of item.xuanxiangshuru) {
            if (!v[1]) {
              v[1] = xuanxiangshuru.find((v2) => v2[0] === v[0])?.[1] || v[1];
            }
          }
          if (morenbancai) {
            if (!item.morenbancai) {
              item.morenbancai = {};
            }
            for (const key in morenbancai) {
              if (isMrbcjfzInfoEmpty1(key, morenbancai[key])) {
                morenbancai[key].默认对应板材分组 = "";
              }
            }
            for (const key in item.morenbancai) {
              if (isMrbcjfzInfoEmpty1(key, item.morenbancai[key])) {
                item.morenbancai[key].默认对应板材分组 = "";
                item.morenbancai[key].选中板材分组 = "";
              } else if (morenbancai[key]) {
                item.morenbancai[key].默认对应板材分组 = morenbancai[key].默认对应板材分组;
                item.morenbancai[key].选中板材分组 = morenbancai[key].选中板材分组;
              }
            }
          }
        }
      }
    }
  }
};

export const isMokuaiItemEqual = (
  item1: ZixuanpeijianMokuaiItem | ZixuanpeijianTypesInfoItem,
  item2: ZixuanpeijianMokuaiItem | ZixuanpeijianTypesInfoItem
) => item1.weiyima === item2.weiyima;

export const getCadLengthVars = (data: CadData) => {
  const getLength = (d: CadData) => Number(toFixed(getCadTotalLength(d), 4));
  const vars: Formulas = {总长: getLength(data)};
  const cads = splitShuangxiangCad(data);
  if (cads) {
    vars.双折宽 = getLength(cads[0]);
    vars.双折高 = getLength(cads[1]);
  }
  return vars;
};

export const getDefaultZhankai = (): ZixuanpeijianInfo["zhankai"][0] => ({width: "", height: "", num: "", originalWidth: ""});

export const calcCadItemZhankai = async (calc: CalcService, materialResult: Formulas, item: ZixuanpeijianCadItem, fractionDigits = 1) => {
  const {data, info} = item;
  const {zhankai} = info;
  if (zhankai.length < 1 || !zhankai[0].originalWidth) {
    return;
  }
  const vars = {...materialResult, ...getCadLengthVars(data)};
  const formulas: ObjectOf<string> = {展开宽: zhankai[0].originalWidth};
  const calcResult = await calc.calcFormulas(formulas, vars, {title: "计算展开"});
  const {展开宽} = calcResult?.succeed || {};
  if (typeof 展开宽 === "number" && !isNaN(展开宽)) {
    zhankai[0].width = toFixed(展开宽, fractionDigits);
  }
  info.zhankai = zhankai;
};

export interface CalcZxpjOptions {
  fractionDigits?: number;
  changeLinesLength?: boolean;
  calcVars?: {keys: string[]; result?: Formulas};
  useCeshishuju?: boolean;
  gongshi?: Formulas;
  inputResult?: Formulas;
  mokuaiVars?: ObjectOf<Formulas>;
}
export const calcZxpj = async (
  dialog: MatDialog,
  message: MessageService,
  calc: CalcService,
  materialResult: Formulas,
  mokuais: ZixuanpeijianMokuaiItem[],
  lingsans: ZixuanpeijianCadItem[],
  options?: CalcZxpjOptions
): Promise<CalcZxpjResult> => {
  const optionsAll: Required<CalcZxpjOptions> = {
    fractionDigits: 1,
    changeLinesLength: true,
    calcVars: {keys: []},
    useCeshishuju: false,
    gongshi: {},
    inputResult: {},
    mokuaiVars: {},
    ...options
  };
  const {fractionDigits, changeLinesLength, calcVars, useCeshishuju, gongshi, inputResult, mokuaiVars} = optionsAll;
  const shuchubianliang: Formulas = {};
  const duplicateScbl: {
    item: ZixuanpeijianMokuaiItem;
    keys: string[];
    values: ObjectOf<{x: number | string | null; xs: Set<number | string>}>;
  }[] = [];
  const duplicateXxsr: ObjectOf<Set<string>> = {};
  const dimensionNamesMap: ObjectOf<{item: ZixuanpeijianCadItem}[]> = {};
  const varsGlobal: Formulas = {};
  const gongshiCalcResult = await calc.calcFormulas(gongshi, materialResult);
  if (!gongshiCalcResult) {
    return {
      fulfilled: false,
      error: {message: "计算算料公式出错", calc: {formulas: gongshi, vars: materialResult, result: gongshiCalcResult}}
    };
  }
  calc.calc.mergeFormulas(materialResult, gongshiCalcResult.succeedTrim);
  calc.calc.mergeFormulas(materialResult, inputResult);

  const gongshiKeys = Object.keys(gongshi);
  const inputResultKeys = Object.keys(inputResult);
  const mokuaiGongshiKeys: string[] = [];
  type DuplicateMokuaiVar = {info: {item: ZixuanpeijianMokuaiItem | null; keys: string[]}[]; type1: string; type2: string};
  const duplicateMokuaiVars: DuplicateMokuaiVar[] = [];
  const checkDuplicate = (
    type1: string,
    types2: ("公式" | "公式输入" | "模块公式")[],
    item: ZixuanpeijianMokuaiItem | null,
    varKeys1: string[]
  ) => {
    for (const type2 of types2) {
      let varKeys2: string[];
      if (type2 === "公式") {
        varKeys2 = gongshiKeys;
      } else if (type2 === "公式输入") {
        varKeys2 = inputResultKeys;
      } else if (type2 === "模块公式") {
        varKeys2 = mokuaiGongshiKeys;
      } else {
        return;
      }
      let varItem: DuplicateMokuaiVar | undefined = duplicateMokuaiVars.find((v) => v.type1 === type1 && v.type2 === type2);
      if (!varItem) {
        varItem = {info: [], type1, type2};
        duplicateMokuaiVars.push(varItem);
      }
      const keys = difference(intersection(varKeys1, varKeys2), calcVars.keys);
      if (keys.length) {
        varItem.info.push({item, keys});
      }
    }
  };

  for (const [i, item1] of mokuais.entries()) {
    for (const [j, item2] of mokuais.entries()) {
      if (i === j) {
        continue;
      }
      if (item1.type2 === item2.type2) {
        if (item1.unique) {
          const msg = `${item1.type1}-${item1.type2}只能单选`;
          await message.error(msg);
          return {fulfilled: false, error: {message: msg}};
        } else {
          continue;
        }
      }
      const keys1 = intersection(calcVars.keys, Object.keys(item1.suanliaogongshi));
      const keys2 = intersection(calcVars.keys, Object.keys(item2.suanliaogongshi));
      const shuchubianliang1 = union(keys1, item1.shuchubianliang);
      const shuchubianliang2 = union(keys2, item2.shuchubianliang);
      const duplicateKeys = difference(intersection(shuchubianliang1, shuchubianliang2), calcVars.keys);
      if (duplicateKeys.length > 0) {
        const add = (item3: ZixuanpeijianMokuaiItem) => {
          const item4 = duplicateScbl.find((v) => isMokuaiItemEqual(v.item, item3));
          if (item4) {
            item4.keys = union(item4.keys, duplicateKeys);
          } else {
            duplicateScbl.push({item: item3, keys: duplicateKeys, values: {}});
          }
        };
        add(item1);
        add(item2);
      }
    }
    for (const group of item1.xuanxiangshuru) {
      if (group[0] in materialResult && materialResult[group[0]] !== "无") {
        const title = getMokuaiTitle(item1);
        if (!duplicateXxsr[title]) {
          duplicateXxsr[title] = new Set();
        }
        duplicateXxsr[title].add(group[0]);
      }
    }
    if (Object.keys(duplicateXxsr).length > 0) {
      const msg = "以下选项输入与订单数据冲突";
      const details = Object.entries(duplicateXxsr).map(([title, keys]) => `${title}: ${Array.from(keys).join(", ")}`);
      await message.error({content: msg, details});
      return {fulfilled: false, error: {message: msg, details}};
    }
  }
  const duplicateDimVars: ObjectOf<{vars: Set<string>; cads: ZixuanpeijianCadItem[]}> = {};
  const getCadDimensionVars = (items: ZixuanpeijianCadItem[], mokuai?: ZixuanpeijianMokuaiItem) => {
    const vars: Formulas = {};
    const duplicateVars = new Set<string>();
    const duplicateCads: ZixuanpeijianCadItem[] = [];
    for (const item of items) {
      const data = item.data;
      const vars2: Formulas = {};
      for (const e of data.entities.dimension) {
        const name = e.mingzi;
        if (!name || e.info.显示公式 || /一个周期|周期等于/.test(name)) {
          continue;
        }
        const points = data.getDimensionPoints(e);
        if (points.length < 4) {
          continue;
        }
        if (name in vars) {
          duplicateVars.add(name);
          duplicateCads.push(item);
        }
        vars2[name] = toFixed(points[2].distanceTo(points[3]), fractionDigits);
        if (!dimensionNamesMap[name]) {
          dimensionNamesMap[name] = [];
        }
        dimensionNamesMap[name].push({item});
      }
      item.info.dimensionVars = vars2;
      if (mokuai && duplicateVars.size > 0) {
        duplicateDimVars[getMokuaiTitle(mokuai)] = {vars: duplicateVars, cads: duplicateCads};
      }
      Object.assign(vars, vars2);
    }
    return vars;
  };
  const toCalc1 = mokuais.map((item) => {
    const formulas = {...item.suanliaogongshi};
    if (item.shuruzongkuan) {
      formulas.总宽 = item.totalWidth;
    }
    if (item.shuruzonggao) {
      formulas.总高 = item.totalHeight;
    }
    const gongshishuruKeys = item.gongshishuru.map((v) => v[0]);
    const formulasKeys = Object.keys(item.suanliaogongshi);
    for (const key of formulasKeys) {
      if (!mokuaiGongshiKeys.includes(key)) {
        mokuaiGongshiKeys.push(key);
      }
    }
    checkDuplicate("模块公式输入", ["公式", "公式输入"], item, gongshishuruKeys);
    checkDuplicate("模块算料公式", ["公式", "公式输入"], item, formulasKeys);
    checkDuplicate("模块输出变量", ["公式", "公式输入"], item, item.shuchubianliang);
    if (useCeshishuju && item.ceshishuju) {
      calc.calc.mergeFormulas(formulas, item.ceshishuju);
    }
    for (const group of item.gongshishuru) {
      if (group[0] && group[1]) {
        formulas[group[0]] = group[1];
      }
    }
    for (const group of item.xuanxiangshuru) {
      if (group[0] && group[1]) {
        formulas[group[0]] = `'${group[1]}'`;
      }
    }
    const dimensionVars = getCadDimensionVars(item.cads);
    return {formulas, dimensionVars, succeedTrim: {} as Formulas, error: {} as Formulas, item};
  });
  {
    const details: string[] = [];
    const cads: CadData[] = [];
    for (const title in duplicateDimVars) {
      const {vars, cads: items} = duplicateDimVars[title];
      details.push(`${title}: ${Array.from(vars).join(", ")}`);
      for (const item of items) {
        cads.push(item.data);
      }
    }
    if (details.length > 0) {
      const msg = "CAD标注重复";
      await message.error({content: msg, details});
      await openDrawCadDialog(dialog, {data: {cads, collection: "cad"}});
      return {fulfilled: false, error: {message: msg, details, cads}};
    }
  }
  const lingsanVars = getCadDimensionVars(lingsans);
  for (const {info, type1, type2} of duplicateMokuaiVars) {
    if (info.length > 0) {
      const msg = `【${type1}】与【${type2}】重复`;
      let details = info
        .map((v) => {
          if (!v.item) {
            return "";
          }
          const title = getMokuaiTitle(v.item);
          return `${title}: ${v.keys.join(", ")}`;
        })
        .filter(Boolean);
      if (details.length) {
        await message.error({content: msg, details});
        return {fulfilled: false, error: {message: msg, details}};
      } else {
        const cads: CadData[] = [];
        details = info.map((v) => v.keys).flat();
        for (const name of details) {
          for (const v of dimensionNamesMap[name]) {
            v.item.data.id = v.item.info.houtaiId;
          }
        }
        await message.error({content: msg, details});
        await openDrawCadDialog(dialog, {data: {cads, collection: "cad"}});
        return {fulfilled: false, error: {message: msg, details, cads}};
      }
    }
  }

  const replaceMenshanName = (门扇名字: string | undefined | null, formulas: Formulas) => {
    if (!门扇名字) {
      return;
    }
    for (const key in formulas) {
      if (key.includes("当前扇")) {
        formulas[key] = key.replaceAll("当前扇", 门扇名字);
      }
      const value = formulas[key];
      if (typeof value === "string" && value.includes("当前扇")) {
        formulas[key] = value.replaceAll("当前扇", 门扇名字);
      }
    }
  };

  const getMokuaiVarsCurr = (门扇名字: string, 模块名字: string) => {
    const result = {...mokuaiVars[门扇名字]};
    const keys = ["总宽", "总高"];
    for (const key of keys) {
      const key2 = 模块名字 + key;
      if (result[key2] !== undefined) {
        result[key] = result[key2];
      }
    }
    return result;
  };

  let calc1Count = 0;
  let calc1Finished = false;
  let calcErrors1: Formulas = {};
  let calcErrors2: Formulas = {};
  while (!calc1Finished) {
    calc1Finished = true;
    calc1Count++;
    const alertError = calc1Count > 1 && isEqual(calcErrors1, calcErrors2);
    calcErrors1 = calcErrors2;
    calcErrors2 = {};
    for (const v of toCalc1) {
      if (calc1Count > 1 && isEmpty(v.error)) {
        continue;
      }
      const formulas1 = {...v.formulas, ...v.dimensionVars};
      const info = v.item.info || {};
      const 门扇名字 = info.门扇名字 || "";
      const 模块名字 = info.模块名字 || "";
      replaceMenshanName(门扇名字, formulas1);
      const mokuaiVarsCurr = getMokuaiVarsCurr(门扇名字, 模块名字);
      const vars1 = {...materialResult, ...shuchubianliang, ...lingsanVars, ...mokuaiVarsCurr};
      vars1.门扇布局 = v.item.info?.门扇布局?.name || "";
      const result1Msg = `计算模块（${getMokuaiTitle(v.item)}）`;
      const result1 = await calc.calcFormulas(formulas1, vars1, alertError ? {title: result1Msg} : undefined);
      // console.log({formulas1, vars1, result1});
      if (!result1?.fulfilled) {
        if (alertError) {
          return {fulfilled: false, error: {message: result1Msg + "出错", calc: {formulas: formulas1, vars: vars1, result: result1}}};
        } else if (!result1) {
          continue;
        }
      }
      calc.calc.mergeFormulas(varsGlobal, result1.succeedTrim);
      for (const key in mokuaiVars[门扇名字]) {
        mokuaiVars[门扇名字][key] = result1.succeed[key];
      }
      const missingKeys: string[] = [];
      for (const vv of v.item.shuchubianliang) {
        if (vv in result1.succeedTrim) {
          const value = result1.succeedTrim[vv];
          for (const item of duplicateScbl) {
            if (item.keys.includes(vv)) {
              if (!item.values[vv]) {
                item.values[vv] = {x: null, xs: new Set()};
              }
              item.values[vv].xs.add(value);
              if (isMokuaiItemEqual(item.item, v.item)) {
                item.values[vv].x = value;
              }
            }
          }
          shuchubianliang[vv] = value;
        } else if (isEmpty(result1.error)) {
          missingKeys.push(vv);
        }
      }
      for (const vv of calcVars.keys) {
        if (vv in result1.succeedTrim) {
          shuchubianliang[vv] = result1.succeedTrim[vv];
        }
      }
      if (missingKeys.length > 0) {
        const msg = `${getMokuaiTitle(v.item)}缺少输出变量`;
        await message.error({content: msg, details: missingKeys.join(", ")});
        return {fulfilled: false, error: {message: msg, details: missingKeys}};
      }
      //calc.calc.mergeFormulas(materialResult, result1.succeedTrim);
      v.succeedTrim = result1.succeedTrim;
      v.error = result1.error;
      if (!isEmpty(result1.error)) {
        calc1Finished = false;
        calcErrors2 = {...calcErrors2, ...result1.error};
      }
    }
  }

  const duplicateScblDetails: string[] = [];
  for (const item of duplicateScbl) {
    const arr: string[] = [];
    for (const key in item.values) {
      const {x, xs} = item.values[key];
      if (x !== null && xs.size > 1) {
        arr.push(`${key}=${x}`);
      }
    }
    if (arr.length > 0) {
      duplicateScblDetails.push(`${getMokuaiTitle(item.item)}：${arr.join(", ")}`);
    }
  }
  if (duplicateScblDetails.length > 0) {
    const msg = `输出变量重复`;
    await message.error({content: msg, details: duplicateScblDetails});
    return {fulfilled: false, error: {message: msg, details: duplicateScblDetails}};
  }

  // console.log({toCalc1, shuchubianliang});
  calc.calc.mergeFormulas(materialResult, shuchubianliang);

  const calcCadItem = async (item: ZixuanpeijianCadItem, vars2: Formulas, mokuai?: ZixuanpeijianMokuaiItem): Promise<CalcZxpjResult> => {
    const {data, info} = item;
    const formulas2: Formulas = {};

    const zhankais: [number, CadZhankai][] = [];
    const {门扇名字, 模块名字} = info;
    vars2 = {...vars2, ...getMokuaiVarsCurr(门扇名字 || "", 模块名字 || "")};
    for (const [i, zhankai] of data.zhankai.entries()) {
      let enabled = true;
      let title = `计算展开条件`;
      if (mokuai) {
        title += `（${getMokuaiTitle(mokuai)}）`;
      }
      const result = await matchConditions(zhankai.conditions, vars2, calc, {title});
      if (result.error) {
        return {fulfilled: result.fulfilled, error: result.error};
      }
      if (!result.isMatched) {
        enabled = false;
      }
      if (enabled) {
        if (mokuai) {
          zhankais.push([i, zhankai]);
        } else {
          const zhankai2 = new CadZhankai(zhankai.export());
          const zhankai3 = info.zhankai.find((v) => v.cadZhankaiIndex === i);
          if (zhankai3) {
            zhankai2.zhankaikuan = zhankai3.width;
            zhankai2.zhankaigao = zhankai3.height;
            zhankai2.shuliang = zhankai3.num;
            zhankai2.shuliangbeishu = "1";
          }
          zhankais.push([i, zhankai2]);
        }
      }
    }
    if (zhankais.length < 1) {
      info.hidden = true;
    } else {
      info.hidden = false;
      for (const [j, e] of data.entities.line.entries()) {
        if (e.gongshi) {
          formulas2[`线${j + 1}公式`] = e.gongshi;
        }
      }
      for (const e of data.entities.dimension) {
        if (e.info.显示公式) {
          if (e.info.显示公式 in vars2) {
            e.mingzi = toFixed(vars2[e.info.显示公式], fractionDigits);
          } else {
            e.mingzi = e.info.显示公式;
          }
        }
      }

      const mokuaiTitle = mokuai ? `（${getMokuaiTitle(mokuai)}）` : "";
      const result2Msg = `计算${mokuaiTitle}${data.name}线公式`;
      const result2 = await calc.calcFormulas(formulas2, vars2, {title: result2Msg});
      const calcLinesResult: Formulas = {};
      // console.log({formulas2, vars2, result2});
      if (!result2?.fulfilled) {
        return {fulfilled: false, error: {message: result2Msg + "出错", calc: {formulas: formulas2, vars: vars2, result: result2}}};
      }
      calc.calc.mergeFormulas(varsGlobal, result2.succeedTrim);
      const shaungxiangCads = splitShuangxiangCad(data);
      const shaungxiangRects = getShuangxiangLineRects(shaungxiangCads);
      for (const key in result2.succeedTrim) {
        const match = key.match(/线(\d+)公式/);
        const value = result2.succeedTrim[key];
        if (match) {
          const index = Number(match[1]);
          // if (typeof value !== "number" || !(value > 0)) {
          //     message.error(`线长公式出错<br>${data.name}的第${index}根线<br>${formulas3[key]} = ${value}`);
          //     return false;
          // }
          const e = data.entities.line[index - 1];
          const length = Number(value);
          let name = e.mingzi;
          if (!name) {
            name = "线_" + e.id.replaceAll("-", "");
          }
          calcLinesResult[name] = length;
          if (changeLinesLength) {
            setLinesLength(data, [e], length);
          }
          e.info.线长 = length;
        }
      }
      setShuangxiangLineRects(shaungxiangCads, shaungxiangRects);
      const vars3 = {...vars2, ...getCadLengthVars(data)};
      const zhankais2: ZixuanpeijianInfo["zhankai"] = [];
      for (const [i, zhankai] of zhankais) {
        const formulas3: Formulas = {};
        formulas3.展开宽 = zhankai.zhankaikuan;
        formulas3.展开高 = zhankai.zhankaigao;
        formulas3.数量 = `(${zhankai.shuliang})*(${zhankai.shuliangbeishu})`;
        const result3Msg = `计算${mokuaiTitle}${data.name}的第${i + 1}个展开`;
        const result3 = await calc.calcFormulas(formulas3, vars3, {title: result3Msg});
        if (!result3?.fulfilled) {
          const cads = [data];
          await openDrawCadDialog(dialog, {data: {cads, collection: "cad"}});
          if (info.zhankai.length < 1) {
            info.zhankai.push(getDefaultZhankai());
          }
          return {fulfilled: false, error: {message: result3Msg + "出错", calc: {formulas: formulas3, vars: vars3, result: result3}, cads}};
        }
        calc.calc.mergeFormulas(varsGlobal, result3.succeedTrim);
        const width = toFixed(result3.succeedTrim.展开宽, fractionDigits);
        const height = toFixed(result3.succeedTrim.展开高, fractionDigits);
        let num = Number(result3.succeedTrim.数量);
        const {产品分类, 栋数, 门中门扇数} = materialResult;
        const CAD分类 = data.type;
        const CAD分类2 = data.type2;
        try {
          num *= getCADBeishu(String(产品分类 || ""), String(栋数 || ""), CAD分类, CAD分类2, String(门中门扇数 || ""));
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message);
          }
        }
        zhankais2.push({width, height, num: String(num), originalWidth: zhankai.zhankaikuan, cadZhankaiIndex: i});
      }
      info.zhankai = [...zhankais2, ...info.zhankai.filter((v) => !("cadZhankaiIndex" in v))];
      if (info.zhankai.length < 1) {
        info.zhankai.push(getDefaultZhankai());
      }
      info.calcZhankai = info.zhankai.flatMap((v) => {
        let cadZhankai: CadZhankai | undefined;
        if (v.cadZhankaiIndex && v.cadZhankaiIndex > 0) {
          cadZhankai = data.zhankai[v.cadZhankaiIndex];
        }
        if (!cadZhankai && data.zhankai.length > 0) {
          cadZhankai = new CadZhankai(data.zhankai[0].export());
          cadZhankai.zhankaikuan = v.width;
          cadZhankai.zhankaigao = v.height;
          cadZhankai.shuliang = v.num;
        }
        if (!cadZhankai) {
          return {};
        }
        const calcObj: ObjectOf<any> = {
          name: cadZhankai.name,
          kailiao: cadZhankai.kailiao,
          kailiaomuban: cadZhankai.kailiaomuban,
          neikaimuban: cadZhankai.neikaimuban,
          chai: cadZhankai.chai,
          flip: cadZhankai.flip,
          flipChai: cadZhankai.flipChai,
          neibugongshi: cadZhankai.neibugongshi,
          calcW: Number(v.width),
          calcH: Number(v.height),
          num: Number(v.num),
          包边正面按分类拼接: cadZhankai.包边正面按分类拼接,
          属于正面部分: false,
          属于框型部分: false,
          默认展开宽: !!nameEquals(cadZhankai.zhankaikuan, [
            "ceil(总长)+0",
            "ceil(总长)+0+(总使用差值)",
            "ceil(总长)-0",
            "ceil(总长)-0+(总使用差值)",
            "总长+(总使用差值)",
            "总长+0+(总使用差值)"
          ])
        };
        ["门扇上切", "门扇下切", "门扇上面上切", "门扇下面下切"].forEach((qiekey) => {
          if (cadZhankai?.zhankaigao.includes(qiekey) && Number(materialResult[qiekey]) > 0) {
            if (qiekey.includes("上切")) {
              calcObj["上切"] = materialResult[qiekey];
            } else {
              calcObj["下切"] = materialResult[qiekey];
            }
          }
        });
        if (cadZhankai.chai) {
          calcObj.num = 1;
          const calc2 = [];
          calc2.push(calcObj);
          for (let i = 1; i < calcObj.num; i++) {
            const calc1 = JSON.parse(JSON.stringify(calcObj));
            if (!calc1.flip) {
              calc1.flip = [];
            }
            calc1.name = `${cadZhankai.name}${i}`;
            calc2.push(calc1);
          }
          return calc2;
        }
        calc.calc.mergeFormulas(calcObj, calcLinesResult);
        return calcObj;
      });
    }
    return {fulfilled: true};
  };

  const calcVarsResult = async (keys: string[], vars: Formulas) => {
    const result: Formulas = {};
    for (const key of keys) {
      const value = await calc.calcExpression(key, vars);
      if (value !== null) {
        result[key] = value;
      }
    }
    return result;
  };

  calcVars.result = await calcVarsResult(calcVars.keys, varsGlobal);
  calc.calc.mergeFormulas(materialResult, calcVars.result);
  for (const [i, item] of mokuais.entries()) {
    const vars2: Formulas = {...materialResult, ...lingsanVars, ...shuchubianliang, ...toCalc1[i].succeedTrim};
    if (item.calcVars) {
      item.calcVars.result = await calcVarsResult(item.calcVars.keys, vars2);
    }
    for (const cadItem of item.cads) {
      const calcCadItemResult = await calcCadItem(cadItem, vars2, item);
      if (!calcCadItemResult.fulfilled) {
        return calcCadItemResult;
      }
    }
  }
  for (const item of lingsans) {
    const calcCadItemResult = await calcCadItem(item, {...materialResult, ...lingsanVars, ...shuchubianliang});
    if (!calcCadItemResult.fulfilled) {
      return calcCadItemResult;
    }
  }
  const gongshiCalcResult2 = await calc.calcFormulas(gongshi, materialResult, {title: "计算算料公式"});
  if (!gongshiCalcResult2?.fulfilled) {
    return {
      fulfilled: false,
      error: {message: "计算算料公式出错", calc: {formulas: gongshi, vars: materialResult, result: gongshiCalcResult2}}
    };
  }
  calc.calc.mergeFormulas(materialResult, gongshiCalcResult2.succeedTrim);
  for (const key1 in mokuaiVars) {
    for (const key2 in mokuaiVars[key1]) {
      if (key2 in materialResult) {
        mokuaiVars[key1][key2] = materialResult[key2];
      }
    }
  }
  return {fulfilled: true, 门扇布局大小: mokuaiVars};
};

export const getFromulasFromString = (str: string | undefined | null): Formulas => {
  if (!str) {
    return {};
  }
  const arr = str.split("+").map((v) => v.trim());
  const result: Formulas = {};
  for (const item of arr) {
    const arr2 = item.split("=").map((v) => v.trim());
    if (arr2[0]) {
      if (arr2[1]) {
        result[arr2[0]] = arr2[1];
      } else {
        result[arr2[0]] = "";
      }
    }
  }
  return result;
};

export const step3FetchData = async (
  http: CadDataService,
  lingsanOptions?: ZixuanpeijianInput["lingsanOptions"] | null,
  noCache = false
) => {
  let responseData: {cads: CadData[]} | null = null;
  const {getAll, useTypePrefix, xinghao} = lingsanOptions || {};
  const cacheKey = "_lingsanCadsCache_" + md5(JSON.stringify({getAll, useTypePrefix, xinghao}));
  if (noCache || !(window as any)[cacheKey]) {
    responseData = await http.getData("ngcad/getLingsanCads", {getAll, useTypePrefix, xinghao});
    (window as any)[cacheKey] = responseData;
  } else {
    responseData = (window as any)[cacheKey];
  }
  return responseData;
};
