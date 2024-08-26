import {Validators} from "@angular/forms";
import {Cad数据要求} from "@app/cad/cad-shujuyaoqiu";
import {InputInfo, InputInfoSelect} from "@app/modules/input/components/input.types";
import {convertOptions} from "@app/modules/input/components/input.utils";
import {CadListInput} from "@components/dialogs/cad-list/cad-list.types";
import {CadData} from "@lucilor/cad-viewer";
import {isTypeOf, keysOf, ObjectOf} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {getHoutaiCad} from "@modules/http/services/cad-data.service.utils";
import {Properties} from "csstype";
import {difference} from "lodash";
import {OptionsAll2} from "../lurushuju-index/lurushuju-index.types";
import {getOptionInputInfo} from "../lurushuju-index/lurushuju-index.utils";
import {
  get算料数据2,
  MenjiaoCadType,
  menjiaoCadTypes,
  SuanliaoDataParams,
  企料分体CadKeys,
  企料组合,
  企料组合共享,
  孔位CAD名字对应关系,
  算料数据,
  算料数据2,
  算料数据2Keys,
  配合框组合,
  门缝配置,
  门缝配置输入
} from "../xinghao-data";

export const autoFillMenjiao = (data: 算料数据, menjiaoOptionsAll: OptionsAll2) => {
  const setOption = (data0: any, key: string) => {
    if (Array.isArray(data0[key]) && data0[key].length > 0) {
      return;
    }
    const {options, multiple, disabled} = menjiaoOptionsAll[key] || {};
    if (disabled || !options || options.length < 1) {
      return;
    }
    data0[key] = multiple ? [options[0].name] : options[0].name;
  };
  for (const key1 in data) {
    if (key1 in menjiaoOptionsAll && key1 !== "选项要求") {
      setOption(data, key1);
    } else if (key1 === menjiaoCadTypes[0]) {
      setOption(data[key1], "双开门扇宽生成方式");
      for (const key2 of 算料数据2Keys) {
        for (const key3 of keysOf(data[key1][key2])) {
          if (!data[key1][key2][key3].cad) {
            const name = 孔位CAD名字对应关系[key3] || key3;
            data[key1][key2][key3].cad = getHoutaiCad(new CadData({name}));
          }
        }
      }
    }
  }
  for (const item of 门缝配置输入) {
    if (typeof data.门缝配置[item.name] !== "number") {
      data.门缝配置[item.name] = isTypeOf(item.defaultValue, "number") ? (item.defaultValue as number) : 1;
    }
  }
  if (!data.名字) {
    data.名字 = "autoFill";
  }
  for (const key in data.选项要求) {
    if (data.选项要求[key].length < 1) {
      const option = menjiaoOptionsAll[key]?.options[0];
      if (option) {
        data.选项要求[key].push({vid: option.vid, mingzi: option.name});
      }
    }
  }
  updateMenjiaoData(data);
};

export const updateMenjiaoData = (data: 算料数据) => {
  for (const value of 门缝配置输入) {
    if (typeof value.defaultValue === "number") {
      data.门缝配置[value.name] = 0;
    }
  }
  const 产品分类 = data.产品分类;
  for (const key1 of menjiaoCadTypes) {
    if (!data[key1]) {
      data[key1] = get算料数据2();
    }
    if (!isTypeOf(data[key1].板材分组, "object")) {
      data[key1].板材分组 = {};
    }
    for (const key2 of 算料数据2Keys) {
      if (!data[key1][key2]) {
        data[key1][key2] = {};
      }
      if (!isTypeOf(data[key1].配合框CAD, "object")) {
        data[key1].配合框CAD = {};
      }
      for (const name of 配合框组合[产品分类] || []) {
        if (!isTypeOf(data[key1].配合框CAD[name], "object")) {
          data[key1].配合框CAD[name] = {};
        }
      }
      for (const name in data[key1].配合框CAD) {
        if (!(配合框组合[产品分类] || []).includes(name)) {
          delete data[key1].配合框CAD[name];
        }
      }
      if (!isTypeOf(data[key1].企料CAD, "object")) {
        data[key1].企料CAD = {};
      }
      for (const name of 企料组合[产品分类] || []) {
        if (!isTypeOf(data[key1].企料CAD[name], "object")) {
          const sharedNames = 企料组合共享.find((v) => v.includes(name));
          const key1Shared = sharedNames?.filter((v) => v !== name)[0];
          if (key1Shared && data[key1].企料CAD[key1Shared]) {
            data[key1].企料CAD[name] = data[key1].企料CAD[key1Shared];
            const cad = data[key1].企料CAD[name].cad;
            if (cad) {
              cad.名字 = name;
              cad.json.name = name;
            }
          } else {
            data[key1].企料CAD[name] = {};
          }
        }
        const 企料CAD = data[key1].企料CAD[name];
        if (!企料CAD.企料分体CAD || !isTypeOf(企料CAD.企料分体CAD, "object")) {
          企料CAD.企料分体CAD = {};
        }
        for (const key of 企料分体CadKeys) {
          if (!(key in 企料CAD.企料分体CAD)) {
            企料CAD.企料分体CAD[key] = null;
          }
        }
      }
      for (const name in data[key1].企料CAD) {
        if (!(企料组合[产品分类] || []).includes(name)) {
          delete data[key1].企料CAD[name];
        }
      }
    }
  }
  data.开启 = [];
  const menjiaoCadInfos = getMenjiaoCadInfos(data);
  for (const key1 in menjiaoCadInfos) {
    const key2 = key1.split("+")[1];
    if (menjiaoCadInfos[key1].isFull && !data.开启.includes(key2)) {
      data.开启.push(key2);
    }
  }
  for (const key of ["门扇厚度"] as const) {
    if (!Array.isArray(data[key])) {
      data[key] = data[key] ? [data[key] as any] : [];
    }
  }
  const keys = ["vid", "产品分类", "开启", "门铰", "门扇厚度", "锁边", "铰边"] as const;
  const values = keys
    .map((k) => {
      const value = data[k];
      if (Array.isArray(value)) {
        return value.join(",");
      } else {
        return value;
      }
    })
    .filter(Boolean);
  data.名字2 = values.join("_");
};

export const getMenjiaoCadInfos = (data: 算料数据) => {
  const menjiaoCadInfos: ObjectOf<{isEmpty: boolean; isFull: boolean}> = {};
  for (const key1 of menjiaoCadTypes) {
    if (!data[key1]) {
      continue;
    }
    menjiaoCadInfos[key1] = {isEmpty: true, isFull: true};
    for (const key2 of 算料数据2Keys) {
      for (const key3 in data[key1][key2]) {
        if (data[key1][key2][key3].cad) {
          menjiaoCadInfos[key1].isEmpty = false;
        } else {
          menjiaoCadInfos[key1].isFull = false;
        }
      }
    }
  }
  return menjiaoCadInfos;
};

const matchOptionFn = `
function (value1, value2, falseIfEmpty) {
  if (value2 === undefined || value2 === null || value2 === "") {
    return !falseIfEmpty;
  }
  if (value2 === "所有") {
    return true;
  }
  if (typeof value2 === "string") {
    value2 = value2.split(";");
  }
  if (!Array.isArray(value1)) {
    value1 = [value1];
  }
  for (var i = 0; i < value1.length; i++) {
    var v = value1[i];
    if (value2.indexOf(v) >= 0) {
      return true;
    }
  }
  return false;
}`;

export const getCadSearch = (data: 算料数据, yaoqiu: Cad数据要求, key1: MenjiaoCadType, key2: string, key3: string) => {
  const 分类0 = yaoqiu.search.分类;
  const 分类: string[] = [];
  if (分类0) {
    分类.push(分类0);
  }
  if (!分类.includes(key3)) {
    分类.push(key3);
  }
  const 选项: (keyof 算料数据)[] = [];
  const formValues: ObjectOf<any> = {};
  for (const name of 选项) {
    const value = data[name];
    formValues[name] = value;
  }
  const [包边方向, 开启] = key1.split("+");
  const filter = `
    function fn() {
      if (!this.选项) {
        return false;
      }
      var 分类 = ${JSON.stringify(分类)};
      var 选项 = ${JSON.stringify(选项)};
      var form = ${JSON.stringify(formValues)};
      var 包边方向1 = ${JSON.stringify(包边方向)};
      var 开启1 = ${JSON.stringify(开启)};
      var 包边方向2 = this.选项.包边方向;
      var 开启2 = this.选项.开启;
      var matchOption = ${matchOptionFn};
      var check = function () {
        if (包边方向1 === "包边在外") {
          return matchOption(包边方向1, 包边方向2) && matchOption(开启1, 开启2, true);
        } else if (包边方向1 === "包边在内") {
          return matchOption(开启1, 开启2, true);
        }
      }
      if (!check()) {
        return false;
      }
      if (分类.indexOf(this.分类) < 0) {
        return false;
      }
      for (var i = 0; i < 选项.length; i++) {
        var name = 选项[i];
        var value1 = form[name];
        var value2 = this.选项[name];
        if (!matchOption(value1, value2)) {
          return false;
        }
      }
      return true;
    }
    `;
  const search: CadListInput["search"] = {$where: filter};
  const addCadData: CadListInput["addCadData"] = {type: 分类0 || key3, options: {开启}};
  return {search, addCadData};
};

export const getShiyituCadSearch = (data: 算料数据, key1: MenjiaoCadType) => {
  const 开启 = key1.split("+")[1];
  const 产品分类 = data.产品分类;
  const 分类 = "算料单示意图";
  const filter = `
    function fn() {
      if (!this.选项) {
        return false;
      }
      var 产品分类1 = ${JSON.stringify(产品分类)};
      var 产品分类2 = this.选项.产品分类;
      var 开启1 = ${JSON.stringify(开启)};
      var 开启2 = this.选项.开启;
      var matchOption = ${matchOptionFn};
      return matchOption(产品分类1, 产品分类2) && matchOption(开启1, 开启2);
    }
    `;
  const search: CadListInput["search"] = {$where: filter, 分类, 名字: {$ne: "开启锁向示意图"}};
  const addCadData: CadListInput["addCadData"] = {type: 分类, options: {产品分类, 开启}};
  return {search, addCadData};
};

export const copySuanliaoData = async (
  http: CadDataService,
  fromData: 算料数据2,
  toData: 算料数据2,
  fromParams: SuanliaoDataParams,
  toParams: SuanliaoDataParams
) => {
  const mubanIds: ObjectOf<string> = {};
  const toChangeMubanId: any[] = [];
  const clear = (cad: HoutaiCad | undefined | null) => {
    if (cad?.json?.info?.imgId) {
      delete cad.json.info.imgId;
    }
  };
  for (const v of Object.values(toData.企料CAD).concat(Object.values(toData.配合框CAD))) {
    clear(v.cad);
  }
  for (const v of Object.values(toData.示意图CAD)) {
    if (Array.isArray(v)) {
      for (const vv of v) {
        clear(vv);
      }
    } else {
      clear(v);
    }
  }
  for (const key2 in fromData.算料CAD) {
    const cadFrom = fromData.算料CAD[key2].json;
    const cadTo = toData.算料CAD[key2].json;
    clear(toData.算料CAD[key2]);
    if (!cadFrom || !cadTo) {
      return;
    }
    const mubanIdFrom = cadFrom.zhankai?.[0]?.kailiaomuban;
    if (typeof mubanIdFrom === "string" && mubanIdFrom) {
      mubanIds[cadTo.id] = mubanIdFrom;
      toChangeMubanId.push(cadTo);
    }
  }
  const copyResult = await http.getData<{mubanIds: typeof mubanIds}>("shuju/api/copySuanliaoData", {
    from: fromParams,
    to: toParams,
    mubanIds
  });
  if (!copyResult) {
    return false;
  }
  const mubanIds2 = copyResult.mubanIds;
  for (const cad of toChangeMubanId) {
    cad.zhankai[0].kailiaomuban = mubanIds2[cad.id];
  }
  return true;
};

export const getGroupStyle = (style?: Properties): Properties => {
  return {display: "flex", flexWrap: "wrap", ...style};
};
export const getInfoStyle = (n: number, style?: Properties): Properties => {
  const percent = 100 / n;
  const margin = 5;
  return {width: `calc(${percent}% - ${margin * 2}px)`, margin: `${margin}px`, ...style};
};
export const getMenjiaoOptionInputInfo = (data: any, key: string, n: number, optionsAll: OptionsAll2): InputInfoSelect => {
  return getOptionInputInfo(optionsAll, key, (info) => {
    info.model = {data, key};
    if (!info.readonly && !info.disabled) {
      info.validators = Validators.required;
    }
    info.onChange = () => {
      updateMenjiaoData(data);
    };
    info.style = getInfoStyle(n);
    const dialogKeys = ["门铰"];
    const openInNewTabKeys = ["门扇厚度", "锁边", "铰边"];
    if (dialogKeys.includes(key)) {
      info.optionsDialog = {
        noImage: true,
        defaultValue: {value: data.选项默认值[key] || "", required: true},
        optionKey: key,
        useLocalOptions: true,
        openInNewTab: true,
        onChange(val) {
          if (val.defaultValue) {
            data.选项默认值[key] = val.defaultValue;
          }
        }
      };
    } else if (openInNewTabKeys.includes(key)) {
      info.openInNewTab = {
        optionKey: key,
        onOptionsChange: (options) => {
          info.options = convertOptions(options.data);
        }
      };
    }
    if (key === "锁边") {
      info.hint = "请使用和实际对应的名字";
    } else if (key === "门扇厚度") {
      let valueBefore = data.门扇厚度;
      if (!Array.isArray(valueBefore)) {
        data.门扇厚度 = [];
        if (isTypeOf(valueBefore, ["string", "number"])) {
          data.门扇厚度.push(valueBefore);
        }
      }
      if (valueBefore.length > 1) {
        valueBefore = [valueBefore[0]];
      }
      info.onChange = (val: any) => {
        const diff = difference(val, valueBefore);
        if (diff.length > 0) {
          data.门扇厚度 = [diff[0]];
          valueBefore = diff;
        }
      };
    }
  });
};
export const getMenfengInputs = (data: 算料数据): InputInfo<门缝配置> => {
  const getMenfengInputInfo = (value: (typeof 门缝配置输入)[number]): InputInfo => {
    return {
      type: "number",
      label: value.name,
      model: {data: data.门缝配置, key: value.name},
      validators: Validators.required,
      style: getInfoStyle(4)
    };
  };
  return {
    type: "group",
    label: "门缝配置",
    infos: 门缝配置输入.map(getMenfengInputInfo),
    style: {marginBottom: "5px"},
    groupStyle: getGroupStyle()
  };
};
