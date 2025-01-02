import {TableRenderData, TableRenderDataColumn} from "@modules/http/services/cad-data.service.types";
import {InputInfo, InputInfoPart} from "@modules/input/components/input.types";
import {ColumnInfo, TableRenderInfo} from "./table.types";

export const convertTableRenderData = <T>(data: TableRenderData, info: TableRenderInfo<T>) => {
  const columns: ColumnInfo<T>[] = [];
  const getItem = (column: TableRenderDataColumn): ColumnInfo<T> | null => {
    if (!column.field) {
      return null;
    }
    const base: Omit<ColumnInfo<T>, "type"> = {
      field: column.field as keyof T,
      name: column.title,
      editable: column.editable,
      required: !!column.inputOnAdd,
      width: column.width > 0 ? column.width + "px" : undefined,
      hidden: !!column.hide
    };
    if (!column.type2) {
      return null;
    }
    switch (column.type2) {
      case "文本":
        return {...base, type: "string"};
      case "数字":
        return {...base, type: "number"};
      case "判断":
        return {...base, type: "boolean"};
      case "时间":
        return {...base, type: "time"};
      case "关联":
        return {
          ...base,
          type: "link",
          links: column.link || {},
          linkedTable: column.guanLian || "",
          multiSelect: !column.dbType.includes("int")
        };
      case "小图":
        return {...base, type: "image"};
      case "图片":
        return {...base, type: "image", hasSmallImage: true};
      case "cad":
        return {...base, type: "cad"};
      case "文件":
        return {...base, type: "file"};
      case "按钮":
        break;
      default:
        console.warn("Unknown type: ", column);
    }
    return null;
  };
  for (const column of data.table.cols[0] || []) {
    const item = getItem(column);
    if (item) {
      columns.push(item);
    }
  }
  info.columns = columns;
};

export const getInputInfosFromTableColumns = <T>(
  columns: ColumnInfo<T>[],
  extra?: InputInfoPart<InputInfo<T>> | ((col: ColumnInfo<T>) => InputInfoPart<InputInfo<T>>)
) => {
  const result: InputInfo<T>[] = [];
  const getInfo = (column: ColumnInfo<T>): InputInfo<T> | null => {
    let extra2: InputInfoPart<InputInfo<T>> | undefined;
    if (typeof extra === "function") {
      extra2 = extra(column);
    } else {
      extra2 = extra;
    }
    const field = column.field as string;
    const base: Omit<InputInfo<T>, "type" | "onChange"> = {
      name: field,
      label: column.name || field,
      ...extra2
    };
    const type = column.type;
    switch (type) {
      case "string":
      case "number":
      case "boolean":
        return {...base, type};
      case "link":
        return {
          ...base,
          type: "string",
          optionRequired: true,
          optionMultiple: column.multiSelect,
          optionsDialog: {
            optionKey: column.linkedTable,
            optionsUseId: true
          }
        };
      default:
        console.warn("Unknown type: ", type);
    }
    return null;
  };
  for (const column of columns) {
    const info = getInfo(column);
    if (info) {
      result.push(info);
    }
  }
  return result;
};
