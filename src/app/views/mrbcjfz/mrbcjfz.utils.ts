import {ObjectOf} from "@lucilor/utils";
import {InputInfo, InputInfoSelect, InputInfoString} from "@modules/input/components/input.types";
import {difference, isEqual} from "lodash";
import {CadData} from "packages/cad-viewer/lib";
import {MrbcjfzHuajian, MrbcjfzInfo, MrbcjfzInfoShowItem, mrbcjfzInfoShowItems, mrbcjfzMsxzItems, MrbcjfzXinghao} from "./mrbcjfz.types";

export class MrbcjfzXinghaoInfo {
  默认板材: ObjectOf<MrbcjfzInfo> = {};
  inputInfos: ObjectOf<InputInfo[][]> = {};

  constructor(
    public table: string,
    public raw: MrbcjfzXinghao
  ) {
    try {
      this.默认板材 = JSON.parse(raw.morenbancai || "");
    } catch {}
    this.update();
  }

  update() {
    this.inputInfos = {};
    for (const key in this.默认板材) {
      this.默认板材[key] = {...getEmptyMrbcjfzInfo(key), ...this.默认板材[key]};
      const value = this.默认板材[key];
      const showItemOptions = ["全都显示", "只显示颜色", "只显示颜色+结果不显示", "全不显示"] as const;
      let 显示内容: (typeof showItemOptions)[number] | undefined;
      const isListEqual = (arr1: MrbcjfzInfoShowItem[], arr2: MrbcjfzInfoShowItem[]) => {
        if (arr1.length !== arr2.length) {
          return false;
        }
        return arr1.every((v) => arr2.includes(v));
      };
      if (value.不显示) {
        if (value.不显示内容 && value.不显示内容.length > 0) {
          const showItems = difference(mrbcjfzInfoShowItems, value.不显示内容);
          if (showItems.length > 0) {
            if (isListEqual(showItems, ["颜色", "结果"])) {
              显示内容 = "只显示颜色";
            } else if (isListEqual(showItems, ["颜色"])) {
              显示内容 = "只显示颜色+结果不显示";
            } else {
              显示内容 = "全都显示";
            }
          } else {
            显示内容 = "全不显示";
          }
        } else {
          显示内容 = "全不显示";
        }
      } else {
        显示内容 = "全都显示";
      }
      if (!value.门扇使用限制 || !mrbcjfzMsxzItems.includes(value.门扇使用限制)) {
        value.门扇使用限制 = "无限制";
      }
      const 板材分组别名InputInfo: InputInfoString = {
        type: "string",
        label: "板材分组别名",
        model: {data: value, key: "板材分组别名"},
        style: {flex: "20 20 0"},
        validators: (control) => {
          const val = String(control.value);
          if (["p_luomatou", "p_luomazhu", "p_qianhoubankuanshi"].includes(this.table)) {
            const data = this.默认板材[key];
            if (!isMrbcjfzInfoEmpty1(key, data) && !val) {
              return {required: true};
            }
          }
          if (val) {
            if (!/(板材|颜色)$/.test(val)) {
              return {pattern: "必须以“板材”或“颜色”结尾"};
            }
            for (const key2 in this.默认板材) {
              if (key2 !== key && this.默认板材[key2].板材分组别名 === val) {
                return {pattern: "不能重复"};
              }
            }
          }
          return null;
        },
        onChange: () => {
          for (const key2 in this.默认板材) {
            if (key2 !== key) {
              板材分组别名InputInfo.forceValidateNum = (板材分组别名InputInfo.forceValidateNum || 0) + 1;
            }
          }
        }
      };
      const 显示内容InputInfo: InputInfoSelect = {
        type: "select",
        label: "显示内容",
        options: showItemOptions.slice(),
        value: 显示内容,
        style: {flex: "16 16 0"},
        onChange: (val: string) => {
          switch (val) {
            case "全都显示":
              value.不显示 = false;
              delete value.不显示内容;
              break;
            case "只显示颜色":
              value.不显示 = true;
              value.不显示内容 = ["材料", "厚度"];
              break;
            case "只显示颜色+结果不显示":
              value.不显示 = true;
              value.不显示内容 = ["材料", "厚度", "结果"];
              break;
            case "全不显示":
              value.不显示 = true;
              delete value.不显示内容;
              break;
            default:
              console.error("未知的显示内容选项", val);
          }
          if (显示内容InputInfo.style) {
            显示内容InputInfo.style.opacity = value.不显示 ? "0.5" : "1";
          }
        }
      };
      this.inputInfos[key] = [
        [板材分组别名InputInfo],
        [
          {type: "boolean", label: "允许修改", model: {data: value, key: "允许修改"}, style: {flex: "8 8 0"}},
          {
            type: "boolean",
            label: "独立变化",
            model: {data: value, key: "独立变化"},
            style: {flex: "8 8 0"},
            readonly: key === "底框板材"
          },
          显示内容InputInfo,
          {
            type: "select",
            label: "门扇使用限制",
            options: mrbcjfzMsxzItems.slice(),
            model: {data: value, key: "门扇使用限制"},
            style: {flex: "12 12 0"}
          }
        ]
      ];
      if (this.raw.编辑默认对应板材分组) {
        this.inputInfos[key][1].push({
          type: "select",
          label: "默认对应板材分组",
          model: {data: value, key: "默认对应板材分组"},
          style: {flex: "40 40 0"},
          options: ["门框板材", "门扇板材"],
          clearable: true
        });
      }
    }
  }

  getBancaiTitle(key: string, placeholder = "") {
    const info = this.默认板材[key];
    if (!info) {
      return "";
    }
    const {默认开料板材, 默认开料材料, 默认开料板材厚度, 选中板材, 选中材料, 选中板材厚度} = info;
    const arr1 = [默认开料板材, 默认开料材料, 默认开料板材厚度].filter(Boolean);
    const arr2 = [选中板材, 选中材料, 选中板材厚度].filter(Boolean);
    if (arr2.length > 0) {
      return arr2.join("/");
    } else if (arr1.length > 0) {
      return arr1.join("/");
    }
    return placeholder;
  }
}

export const getMrbcjfzInfo = (source: Partial<MrbcjfzInfo> = {}): MrbcjfzInfo => ({
  默认开料板材: "",
  默认开料材料: "",
  默认开料板材厚度: "",
  默认对应板材分组: "",
  选中板材: "",
  选中材料: "",
  选中板材厚度: "",
  选中板材分组: "",
  花件: [],
  CAD: [],
  企料: [],
  ...source
});

export const filterCad = (data: CadData, options?: {skipTpyeCheck?: boolean}) => {
  if (data.gudingkailiaobancai || data.板材绑定选项 || data.指定板材分组) {
    return false;
  }
  if (!options?.skipTpyeCheck) {
    const typeReg = /激光花|花件|示意图|装配示意图|特定企料|横截面示意图|纵截面示意图/;
    if (typeReg.test(data.type) || typeReg.test(data.type2)) {
      return false;
    }
  }
  if (data.options.花件 || Object.keys(data.options).some((v2) => v2.includes("压条"))) {
    return false;
  }
  return true;
};

export const filterHuajian = (data: MrbcjfzHuajian) => {
  if (data.shihuajian || data.bangdinghoubankuanshicad || data.bangdingqianbankuanshicad) {
    return false;
  }
  if (/阴影/.test(data.mingzi)) {
    return false;
  }
  const getProperHuajianName = (rawName: string) => {
    if (!rawName) return "";

    let newName = rawName;

    const newNameParts = newName.split("-"); // 两段或以上的，第一段基本都是做法名字，直接去掉

    if (newNameParts.length > 1) {
      newNameParts.shift();

      newName = newNameParts.join("-");
    }
    /**
     * 门扇做法有叫以下名字的话，会影响到上下板花件的判断
     * 无上下板", "有上下板
     * +压条", "加压条", "无压条
     */
    newName = newName.replace(/无上下板|有上下板|\+压条|加压条|无压条|拉手板/g, "");
    return newName;
  };
  const mingziReg = /压条|压边|门徽|猫眼|LOGO|商标|花件|木板|门铰|拉手|企料开槽饰条/;
  if (mingziReg.test(getProperHuajianName(data.mingzi))) {
    return false;
  }
  return true;
};

export const getEmptyMrbcjfzInfo = (name: string) => {
  const result: MrbcjfzInfo = {
    默认开料板材: "",
    默认开料材料: "",
    默认开料板材厚度: "",
    默认对应板材分组: "",
    选中板材: "",
    选中材料: "",
    选中板材厚度: "",
    选中板材分组: "",
    可选板材: [],
    花件: [],
    CAD: [],
    企料: [],
    板材分组别名: "",
    允许修改: true,
    独立变化: false,
    不显示: false
  };
  if (name === "底框板材") {
    result.独立变化 = true;
  }
  return result;
};

export const emptyMrbcjfzInfoValues = (name: string, info: MrbcjfzInfo, keys: (keyof MrbcjfzInfo)[]) => {
  const emptyInfo = getEmptyMrbcjfzInfo(name);
  for (const key of keys) {
    info[key] = emptyInfo[key] as never;
  }
};

export const isMrbcjfzInfoEmpty = (name: string, info: MrbcjfzInfo | null | undefined, keys: (keyof MrbcjfzInfo)[]) => {
  if (!info) {
    return true;
  }
  const emptyInfo = getEmptyMrbcjfzInfo(name);
  return keys.every((key) => {
    const value = info[key];
    if (value === undefined || isEqual(value, emptyInfo[key])) {
      return true;
    }
    return false;
  });
};

export const isMrbcjfzInfoEmpty1 = (name: string, info: MrbcjfzInfo) => isMrbcjfzInfoEmpty(name, info, ["CAD", "企料", "花件"]);
export const isMrbcjfzInfoEmpty2 = (name: string, info: MrbcjfzInfo) =>
  isMrbcjfzInfoEmpty(name, info, ["默认开料材料", "默认开料板材", "默认开料板材厚度"]);
