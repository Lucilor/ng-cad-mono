import {OptionsDataData} from "@app/modules/http/services/cad-data.service.types";

export interface WorkSpaceData {
  user?: number;
  favorites?: WorkSpaceFavoriteItem[];
  types?: WorkSpaceFavoriteType[];
}

export interface WorkSpaceFavoriteItem {
  id: number;
  tou: string;
  da: string;
  xiao: string;
  type: string;
  order?: number;
}

export interface WorkSpaceFavoriteType {
  name: string;
  order?: number;
}

export interface DefaultWorkDataFormInfo {
  defaultWorkDataPathKeys: DefaultWorkDataFormInfoItem;
  jueses: DefaultWorkDataFormInfoItem;
  xiaodaohangsDocs?: XiaodaohangDocs[];
}
export interface DefaultWorkDataFormInfoItem {
  labelSet: string;
  labelUnset: string;
  options: OptionsDataData[];
}
export interface XiaodaohangDocs {
  xiaodaohang: string;
  docs: XiaodaohangDoc[];
}
export interface XiaodaohangDoc {
  name: string;
  url: string;
}

export interface DefaultWorkDataListItem {
  key: string;
  path: string;
  data: WorkSpaceData;
}
