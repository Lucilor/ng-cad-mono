import {CadCollection} from "@app/cad/collections";
import {算料公式} from "@app/components/lurushuju/xinghao-data";
import {InputInfo} from "@app/modules/input/components/input.types";
import {MessageService} from "@app/modules/message/services/message.service";
import {AppStatusService} from "@app/services/app-status.service";
import {CadData, CadLine, CadLineLike, CadViewer, setLinesLength} from "@lucilor/cad-viewer";
import {keysOf} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {getData} from "../cad-info/cad-info.utils";

export const cadLineFields = {
  名字: "mingzi",
  名字2: "mingzi2",
  公式: "gongshi",
  显示线长: "显示线长",
  关联变化公式: "guanlianbianhuagongshi",
  双向折弯附加值: "双向折弯附加值"
} as const;

export const getLine = (data: CadLineLike | (() => CadLineLike)) => (typeof data === "function" ? data() : data);

export const getCadLineInputs = (
  keys: string[],
  data: CadData | (() => CadData),
  line: CadLineLike | (() => CadLineLike),
  status: AppStatusService,
  gongshis: 算料公式[] | null | undefined
) => {
  const result: InputInfo<CadLineLike>[] = [];
  line = getLine(line);
  const isLine = line instanceof CadLine;
  const lineLength = Number(line.length.toFixed(2));
  const gongshiOptions = status.getGongshiOptions(gongshis);
  for (const key of keys) {
    if (result.some((v) => v.label === key)) {
      continue;
    }
    let info: InputInfo;
    switch (key) {
      case "名字":
      case "名字2":
      case "显示线长":
      case "关联变化公式":
      case "双向折弯附加值":
        info = {type: "string", label: key, model: {data: line, key: cadLineFields[key]}};
        break;
      case "公式":
        info = {type: "string", label: key, options: gongshiOptions, model: {data: line, key: cadLineFields[key]}};
        break;
      case "线长":
        info = {type: "number", label: key, value: lineLength, readonly: !isLine};
        break;
      case "可改名字":
        {
          const vars = getData(data).info.vars || {};
          let value: string | undefined;
          for (const key in vars) {
            if (vars[key] === line.id) {
              value = key;
              break;
            }
          }
          info = {
            type: "string",
            label: key,
            value,
            onChange: (val) => {
              const info = getData(data).info;
              if (val) {
                if (!info.vars) {
                  info.vars = {};
                }
                for (const key in info.vars) {
                  if (info.vars[key] === line.id) {
                    delete info.vars[key];
                  }
                }
                info.vars[val] = line.id;
              }
            },
            validators: (control) => {
              const val = control.value;
              const vars = getData(data).info.vars || {};
              for (const key in vars) {
                if (key === val && vars[key] !== line.id) {
                  return {名字已存在: true};
                }
              }
              return null;
            }
          };
        }
        break;
      default:
        info = {type: "string", label: key + "（未实现）", disabled: true};
    }
    info.clearable = true;
    result.push(info);
  }
  return result;
};

export const openCadLineForm = async (
  collection: CadCollection,
  status: AppStatusService,
  message: MessageService,
  cad: CadViewer,
  line: CadLineLike,
  gongshis: 算料公式[] | null | undefined
) => {
  const line2 = line.clone();
  const lineLength = Number(line.length.toFixed(2));
  const isLine = line instanceof CadLine;
  await status.fetchCad数据要求List();
  const data = cad.data;
  const yaoqiu = status.getCad数据要求(data.type);
  const vars = cloneDeep(data.info.vars);
  const form = getCadLineInputs(yaoqiu?.线段弹窗修改属性 || [], data, line2, status, gongshis);
  if (collection === "kailiaocadmuban" && !form.some((v) => v.label === "关联变化公式")) {
    form.push({type: "string", label: "关联变化公式", model: {data: line, key: "guanlianbianhuagongshi"}});
  }
  let title = "编辑线";
  const name = line.mingzi || line.mingzi2;
  if (name) {
    title += `【${name}】`;
  }
  const result = await message.form(form, {title});
  if (result) {
    for (const key of keysOf(cadLineFields)) {
      const key2 = cadLineFields[key];
      line[key2] = line2[key2] as any;
    }
    let toChange = [line];
    if (isLine && result.线长 !== lineLength) {
      toChange = cad.data.entities.line;
      setLinesLength(cad.data, [line], result.线长);
    }
    await cad.render(toChange);
  } else {
    data.info.vars = vars;
  }
  return result;
};
