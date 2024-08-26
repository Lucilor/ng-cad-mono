import {ObjectOf} from "@lucilor/utils";
import {TableRenderDataColumn} from "@modules/http/services/cad-data.service.types";
import {MessageService} from "@modules/message/services/message.service";
import {InputComponent} from "./input.component";
import {InputInfo} from "./input.types";

export const getInputValues = (inputs: InputComponent[], message: MessageService) => {
  const values: ObjectOf<any> = {};
  for (const input of inputs) {
    const errorMsg = input.errorMsg;
    if (errorMsg) {
      message.error(errorMsg);
      return null;
    }
    const key = input.info.name || input.info.label;
    values[key] = input.value;
  }
  return values;
};

export const getInputInfosFromTableRenderCols = <T>(
  cols: TableRenderDataColumn[],
  extra?: Partial<InputInfo<T>> | ((col: TableRenderDataColumn) => Partial<InputInfo<T>>)
) => {
  const result: InputInfo<T>[] = [];
  const getInfo = (col: TableRenderDataColumn): InputInfo<T> | null => {
    let extra2: Partial<InputInfo<T>> | undefined;
    if (typeof extra === "function") {
      extra2 = extra(col);
    } else {
      extra2 = extra;
    }
    const base: Omit<InputInfo<T>, "type"> = {
      name: col.field,
      label: col.title,
      ...extra2
    };
    switch (col.type2) {
      case "文本":
        return {...base, type: "string"};
      case "数字":
        return {...base, type: "number"};
      case "判断":
        return {...base, type: "boolean"};
      case "关联":
        return {
          ...base,
          type: "string",
          optionsDialog: {optionKey: col.guanLian, optionsUseId: true},
          optionRequired: true,
          optionMultiple: !col.dbType.includes("int")
        };
      default:
        console.warn("Unknown type: ", col.type2);
    }
    return null;
  };
  for (const col of cols) {
    const info = getInfo(col);
    if (info) {
      result.push(info);
    }
  }
  return result;
};
