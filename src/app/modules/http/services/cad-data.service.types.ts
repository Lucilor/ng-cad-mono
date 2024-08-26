import {CadCollection} from "@app/cad/collections";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf} from "@lucilor/utils";

export interface GetCadParams {
  collection: CadCollection;
  id?: string;
  ids?: string[];
  page?: number;
  limit?: number;
  search?: ObjectOf<any>;
  standaloneSearch?: boolean;
  qiliao?: boolean;
  options?: CadData["options"];
  optionsMatchType?: "and" | "or";
  sync?: boolean;
  restore?: boolean;
  fields?: string[] | ObjectOf<boolean>;
}

export interface SetCadParams {
  collection: CadCollection;
  cadData: CadData;
  force?: boolean;
  restore?: boolean;
  importConfig?: {pruneLines: boolean};
}

export type CadSearchData = {
  title: string;
  items: {
    value: string;
    label: string;
    options: {value: string; label: string}[];
  }[];
}[];

export interface GetOptionsParams {
  name: string;
  search?: string;
  page?: number;
  limit?: number;
  data?: CadData;
  xinghao?: string;
  includeTingyong?: boolean;
  values?: any[];
  filter?: ObjectOf<any>;
  fields?: string[];
  nameField?: string;
  info?: ObjectOf<any>;
}

export interface OptionsData<T extends OptionsDataData = OptionsDataData> {
  data: T[];
  count: number;
}

export interface OptionsDataData {
  vid: number;
  name: string;
  img: string;
  disabled: boolean;
  label?: string;
}

export interface BancaiList {
  mingzi: string;
  cailiaoList: string[];
  houduList: string[];
  guigeList: number[][];
  zidingyi?: string;
}
export interface BancaiCad {
  id: string;
  name: string;
  peihe?: string;
  width: number;
  height: number;
  num: number;
  bancai: {mingzi: string; cailiao: string | null; houdu: string | null; guige: number[] | null; gas?: string};
}

export type Changelog = ObjectOf<any>[];

export interface QueryMongodbParams {
  collection: CadCollection;
  where?: ObjectOf<any>;
  fields?: string[] | ObjectOf<any>;
  limit?: number;
  skip?: number;
  genUnqiCode?: boolean;
}

export interface QueryMysqlParams {
  table: string;
  filter?: ObjectOf<any>;
  fields?: string[];
  page?: number;
  limit?: number;
  token?: string;
}

export interface UpdateMongodbParams<T extends MongodbDataBase> {
  collection: CadCollection;
  data: Omit<Partial<T>, "vid">;
  where: ObjectOf<any>;
  upsert?: boolean;
  multi?: boolean;
  notFindError?: boolean;
}

export interface DeleteMongodbParams {
  collection: CadCollection;
  where: ObjectOf<any>;
  limit?: boolean;
}

export interface TableInsertParams<T extends TableDataBase = TableDataBase> {
  table: string;
  data: Omit<Partial<T>, "vid">;
}

export interface TableUpdateParams<T extends TableDataBase = TableDataBase> {
  table: string;
  data: {vid: number} & Omit<Partial<T>, "vid">;
}

export interface TableDeleteParams {
  table: string;
  vids: number[];
}

export interface TableUploadFile<T extends TableDataBase = TableDataBase> {
  table: string;
  vid: number;
  field: keyof T;
  file: File;
}

export interface TableDeleteFile<T extends TableDataBase = TableDataBase> {
  table: string;
  vid: number;
  field: keyof T;
}

export interface TableDataBase {
  vid: number;
  mingzi: string;
}
export interface TableDataBase2 extends TableDataBase {
  paixu: number;
  tingyong: boolean;
}

export interface MongodbDataBase {
  _id: string;
  名字: string;
}

export interface BancaiListData {
  bancais: BancaiList[];
  bancaiKeys: string[];
  bancaiKeysRequired: string[];
  qiliaos: string[];
}

export interface TableRenderData {
  table: {
    id: string;
    cols: TableRenderDataColumn[][];
  };
}

export interface TableRenderDataColumn {
  field: string;
  title: string;
  editable: boolean;
  hide: boolean;
  width: number;
  dbType: string;
  type2: string;
  link?: ObjectOf<string>;
  guanLian?: string;
  inputOnAdd?: number;
}

export interface HoutaiCad extends MongodbDataBase {
  分类: string;
  分类2: string;
  选项: ObjectOf<string>;
  条件: string[];
  显示名字: string;
  json: ObjectOf<any>;
}

export interface GetShortUrlParams {
  search?: ObjectOf<any>;
  search2?: ObjectOf<any>;
  extraData?: ObjectOf<any>;
  useData?: ObjectOf<any>[];
  noToolbar?: boolean;
  noHeader?: boolean;
  showCols?: string[];
  hideCols?: string[];
  showBtns?: string[];
  hideBtns?: string[];
  forceInsert?: boolean;
}

export interface MongodbInsertOptions {
  extraData?: ObjectOf<any>;
  force?: boolean;
}

export interface MongodbCopyOptions {
  extraData?: ObjectOf<any>;
  force?: boolean;
}
