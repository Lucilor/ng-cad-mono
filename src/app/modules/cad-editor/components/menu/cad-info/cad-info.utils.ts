import {Validators} from "@angular/forms";
import {MatDialog} from "@angular/material/dialog";
import {Cad数据要求Item} from "@app/cad/cad-shujuyaoqiu";
import {cadOptions} from "@app/cad/options";
import {算料公式} from "@app/components/lurushuju/xinghao-data";
import {openCadListDialog} from "@components/dialogs/cad-list/cad-list.component";
import {environment} from "@env";
import {CadData, CadZhankai} from "@lucilor/cad-viewer";
import {InputInfo} from "@modules/input/components/input.types";
import {AppStatusService} from "@services/app-status.service";
import {openCadDataAttrsDialog} from "../../dialogs/cad-data-attrs/cad-data-attrs.component";

export const cadFields = {
  id: "id",
  名字: "name",
  分类: "type",
  分类2: "type2",
  显示名字: "xianshimingzi",
  开孔对应名字: "开孔对应名字",
  切内空对应名字: "切内空对应名字",
  全部刨坑: "kailiaoshibaokeng",
  板材纹理方向: "bancaiwenlifangxiang",
  默认开料板材: "morenkailiaobancai",
  算料处理: "suanliaochuli",
  显示宽度标注: "showKuandubiaozhu",
  双向折弯: "shuangxiangzhewan",
  算料特殊要求: "算料特殊要求",
  算料单显示: "suanliaodanxianshi",
  装配位置: "装配位置",
  企料包边门框配合位增加值: "企料包边门框配合位增加值",
  对应门扇厚度: "对应门扇厚度",
  主CAD: "主CAD",
  固定开料板材: "gudingkailiaobancai",
  选项: "options",
  条件: "conditions",
  对应计算条数的配件: "对应计算条数的配件",
  指定板材分组: "指定板材分组",
  默认开料材料: "默认开料材料",
  默认开料板材厚度: "默认开料板材厚度",
  算料单显示放大倍数: "suanliaodanZoom",
  自动生成双折宽双折高公式: "自动生成双折宽双折高公式",
  开料时刨坑: "kailiaoshibaokeng",
  变形方式: "bianxingfangshi",
  开料排版方式: "kailiaopaibanfangshi",
  板材厚度方向: "bancaihoudufangxiang",
  型号花件: "xinghaohuajian",
  必须绑定花件: "needsHuajian",
  可独立板材: "kedulibancai",
  必须选择板材: "必须选择板材",
  企料前后宽同时改变: "企料前后宽同时改变",
  算料单展开显示位置: "算料单展开显示位置",
  属于门框门扇: "属于门框门扇",
  内开做分体: "内开做分体",
  板材绑定选项: "板材绑定选项",
  算料单线长显示的最小长度: "算料单线长显示的最小长度",
  检查企料厚度: "检查企料厚度",
  显示厚度: "显示厚度",
  跟随CAD开料板材: "跟随CAD开料板材",
  正面宽差值: "正面宽差值",
  墙厚差值: "墙厚差值",
  企料翻转: "企料翻转",
  企料门框配合位增加值: "企料包边门框配合位增加值",
  企料包边类型: "企料包边类型",
  指定封口厚度: "指定封口厚度",
  拼接料拼接时垂直翻转: "拼接料拼接时垂直翻转",
  拉码碰撞判断: "拉码碰撞判断"
} as const;

export const getData = (data: CadData | (() => CadData)) => (typeof data === "function" ? data() : data);

export const getCadInfoInputs = (
  keys: string[],
  data: CadData | (() => CadData),
  dialog: MatDialog,
  status: AppStatusService,
  parseOptionString: boolean,
  gongshis?: 算料公式[] | null | undefined
) => {
  const result: InputInfo<CadData>[] = [];
  const attrGetter =
    <T extends keyof CadData>(key: T) =>
    () => {
      return getData(data)[key];
    };
  const gongshiOptions = status.getGongshiOptions(gongshis);
  for (const key of keys) {
    if (result.some((v) => v.label === key)) {
      continue;
    }
    let info: InputInfo;
    switch (key) {
      case "id":
        info = {type: "string", label: key, model: {data, key: cadFields[key]}, readonly: true, copyable: true};
        break;
      case "名字":
      case "分类":
      case "分类2":
      case "显示名字":
      case "开孔对应名字":
      case "切内空对应名字":
      case "板材绑定选项":
      case "显示厚度":
      case "跟随CAD开料板材":
      case "指定封口厚度":
        info = {type: "string", label: key, model: {data, key: cadFields[key]}};
        break;
      case "算料特殊要求":
        info = {type: "string", label: key, model: {data, key: cadFields[key]}, textarea: {autosize: {maxRows: 5}}};
        break;
      case "算料单显示放大倍数":
      case "算料单线长显示的最小长度":
        info = {type: "number", label: key, model: {data, key: cadFields[key]}, min: 0};
        break;
      case "正面宽差值":
      case "墙厚差值":
      case "企料门框配合位增加值":
      case "对应门扇厚度":
        info = {type: "number", label: key, model: {data, key: cadFields[key]}};
        break;
      case "开料时刨坑":
      case "显示宽度标注":
      case "必须绑定花件":
      case "可独立板材":
      case "必须选择板材":
      case "双向折弯":
      case "自动生成双折宽双折高公式":
      case "企料前后宽同时改变":
      case "主CAD":
      case "内开做分体":
      case "检查企料厚度":
      case "企料翻转":
      case "拼接料拼接时垂直翻转":
      case "拉码碰撞判断":
        info = {type: "boolean", label: key, model: {data, key: cadFields[key]}};
        break;
      case "变形方式":
      case "板材纹理方向":
      case "开料排版方式":
      case "算料处理":
      case "板材厚度方向":
      case "算料单显示":
      case "算料单展开显示位置":
      case "属于门框门扇":
      case "企料包边类型":
      case "指定板材分组":
        info = {type: "select", label: key, model: {data, key: cadFields[key]}, options: cadOptions[cadFields[key]].values.slice()};
        break;
      case "选项":
      case "型号花件":
        info = {
          type: "object",
          label: key,
          model: {data, key: cadFields[key]},
          optionsDialog: {},
          optionMultiple: true,
          parseString: parseOptionString,
          isXuanxiang: key === "选项"
        };
        break;
      case "条件":
        info = {type: "array", label: key, model: {data, key: cadFields[key]}};
        break;
      case "默认开料板材":
      case "固定开料板材":
        info = {
          type: "string",
          label: key,
          model: {data, key: cadFields[key]},
          optionMultiple: true,
          optionsDialog: {optionKey: "板材"}
        };
        break;
      case "默认开料材料":
        info = {
          type: "string",
          label: key,
          model: {data, key: cadFields[key]},
          optionMultiple: true,
          optionsDialog: {optionKey: "材料"}
        };
        break;
      case "默认开料板材厚度":
        info = {
          type: "string",
          label: key,
          model: {data, key: cadFields[key]},
          optionsDialog: {optionKey: "板材厚度", optionField: "kailiaohoudu"}
        };
        break;
      case "唯一码":
        info = {type: "string", label: key, model: {data: attrGetter("info"), key}};
        break;
      case "激光开料是否翻转":
      case "激光开料打标":
        info = {type: "boolean", label: key, model: {data: attrGetter("info"), key}};
        break;
      case "自定义属性":
        info = {
          type: "string",
          label: key,
          readonly: true,
          suffixIcons: [
            {
              name: "list",
              onClick: async () => {
                const data2 = getData(data);
                const result = await openCadDataAttrsDialog(dialog, {data: data2.attributes});
                if (result) {
                  data2.attributes = result;
                }
              }
            }
          ]
        };
        break;
      case "正面线到见光线展开模板":
        info = {
          type: "string",
          label: key,
          model: {data: attrGetter("info"), key},
          suffixIcons: [
            {
              name: "open_in_new",
              onClick: () => {
                status.openCadInNewTab(getData(data).info[key], "kailiaocadmuban");
              }
            },
            {
              name: "list",
              onClick: async () => {
                const checkedItems = [];
                const dataInfo = getData(data).info;
                if (dataInfo[key]) {
                  checkedItems.push(dataInfo[key]);
                }
                const result = await openCadListDialog(dialog, {
                  data: {selectMode: "single", collection: "kailiaocadmuban", checkedItems}
                });
                if (result?.length) {
                  dataInfo[key] = result[0].id;
                }
              }
            }
          ]
        };
        break;
      case "展开信息":
        {
          const getter = () => {
            const data2 = getData(data);
            if (!data2.zhankai) {
              data2.zhankai = [];
            }
            if (!data2.zhankai[0]) {
              data2.zhankai[0] = new CadZhankai({name: data.name});
            }
            const zhankai = data2.zhankai[0];
            return zhankai;
          };
          const style: InputInfo["style"] = {flex: "1 1 0", width: 0, margin: "2px"};
          info = {
            type: "group",
            label: key,
            groupStyle: {display: "flex"},
            infos: [
              {
                type: "string",
                label: "宽",
                style,
                options: gongshiOptions,
                model: {data: getter, key: "zhankaikuan"},
                validators: Validators.required
              },
              {
                type: "string",
                label: "高",
                style,
                options: gongshiOptions,
                model: {data: getter, key: "zhankaigao"},
                validators: Validators.required
              },
              {type: "string", label: "数量", style, model: {data: getter, key: "shuliang"}, validators: Validators.required}
            ]
          };
        }
        break;
      case "上传dxf文件":
        info = {
          type: "file",
          label: key,
          accept: ".dxf",
          clearable: true,
          onChange: (files) => {
            const file = files?.[0];
            getData(data).info.uploadDxf = file;
          }
        };
        break;
      default:
        info = {type: "string", label: key + "（未实现）", disabled: true};
    }
    const requiredKeys = ["名字"];
    if (requiredKeys.includes(key)) {
      if (Array.isArray(info.validators)) {
        info.validators.push(Validators.required);
      } else if (info.validators) {
        info.validators = [info.validators, Validators.required];
      } else {
        info.validators = Validators.required;
      }
    }
    info.clearable = true;
    result.push(info);
  }
  return result;
};

export const getCadInfoInputs2 = (
  items: Cad数据要求Item[] | null | undefined,
  items2: Cad数据要求Item[] | null | undefined,
  data: CadData | (() => CadData),
  dialog: MatDialog,
  status: AppStatusService,
  parseOptionString: boolean,
  gongshis: 算料公式[] | null | undefined
) => {
  const result: InputInfo[] = [];
  for (const {key, value, cadKey, key2, readonly, required} of items || []) {
    let info: InputInfo;
    if (key === "选项" && key2) {
      info = {
        type: "select",
        label: key2,
        model: {data: () => getData(data).options, key: key2},
        options: [],
        optionsDialog: {optionKey: key2, openInNewTab: true}
      };
    } else {
      info = getCadInfoInputs([key], data, dialog, status, parseOptionString, gongshis)[0];
      if (key === "选项" && info.type === "object") {
        const requiredOptionItems = items2?.filter((v) => v.key === "选项" && v.key2 && v.required);
        const requiredKeys: string[] = [];
        for (const {key2} of requiredOptionItems || []) {
          if (key2) {
            requiredKeys.push(key2);
          }
        }
        info.requiredKeys = requiredKeys;
      }
    }
    if (!info) {
      info = {type: "string", label: key + "（未实现）", disabled: true};
    } else {
      if (readonly) {
        if (environment.production) {
          info.hidden = true;
        } else {
          info.readonly = true;
        }
      }
      const setInfo = (info2: InputInfo) => {
        if (info2.type === "group") {
          for (const info3 of info2.infos || []) {
            setInfo(info3);
          }
        } else {
          if (required) {
            info2.validators = Validators.required;
          } else {
            delete info2.validators;
          }
        }
      };
      setInfo(info);
      if (value && cadKey) {
        if (key2) {
          (data as any)[cadKey][key2] = value;
        } else {
          (data as any)[cadKey] = value;
        }
      }
    }
    result.push(info);
  }
  return result;
};
