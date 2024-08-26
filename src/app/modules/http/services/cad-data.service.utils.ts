import {exportCadData} from "@app/cad/utils";
import {CadData} from "@lucilor/cad-viewer";
import {keysOf} from "@lucilor/utils";
import {HoutaiCad, TableDataBase, TableUpdateParams} from "./cad-data.service.types";

export const getHoutaiCad = (data = new CadData(), info?: {houtaiId?: string}) => {
  const cad: HoutaiCad = {
    _id: data.id,
    名字: data.name,
    分类: data.type,
    分类2: data.type2,
    选项: data.options,
    条件: data.conditions,
    显示名字: data.xianshimingzi,
    json: exportCadData(data)
  };
  const {houtaiId} = info || {};
  if (houtaiId) {
    cad.json.houtaiId = houtaiId;
  }
  return cad;
};

export const getTableUpdateData = <T extends TableDataBase>(dataBefore: T, dataAfter: T) => {
  const data = {vid: dataAfter.vid} as TableUpdateParams<T>["data"];
  for (const key of keysOf(dataAfter)) {
    if (key === "vid" || dataAfter[key] === undefined) {
      continue;
    }
    if (dataAfter[key] !== dataBefore[key]) {
      (data as any)[key] = dataAfter[key];
    }
  }
  if (Object.keys(data).length < 2) {
    return null;
  }
  return data;
};
