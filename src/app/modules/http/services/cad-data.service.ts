import {Injectable, Injector} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {imgCadEmpty, XiaodaohangStructure} from "@app/app.common";
import {CadCollection} from "@app/cad/collections";
import {exportCadData} from "@app/cad/utils";
import {CadData} from "@lucilor/cad-viewer";
import {dataURLtoBlob, downloadByUrl, DownloadOptions, isTypeOf, keysOf, ObjectOf} from "@lucilor/utils";
import {
  BancaiCad,
  BancaiList,
  BancaiListData,
  CadSearchData,
  Changelog,
  DeleteMongodbParams,
  GetCadParams,
  GetOptionsParams,
  GetShortUrlParams,
  HoutaiCad,
  MongodbCopyOptions,
  MongodbDataBase,
  MongodbInsertOptions,
  OptionsData,
  OptionsDataData,
  QueryMongodbParams,
  QueryMysqlParams,
  SetCadParams,
  TableDataBase,
  TableDeleteFile,
  TableDeleteParams,
  TableInsertParams,
  TableRenderData,
  TableUpdateParams,
  TableUploadFile,
  UpdateMongodbParams
} from "./cad-data.service.types";
import {CadImgCache} from "./cad-img-cache";
import {HttpService} from "./http.service";
import {CustomResponse, HttpOptions} from "./http.service.types";

@Injectable({
  providedIn: "root"
})
export class CadDataService extends HttpService {
  public cadImgCache = new CadImgCache();
  private route: ActivatedRoute;

  constructor(injector: Injector) {
    super(injector);
    this.route = injector.get(ActivatedRoute);
    this.route.queryParams.subscribe((params) => {
      const {token} = params;
      if (token) {
        this.token = token;
      }
    });
  }

  private async _resolveMissingCads(response: CustomResponse<any>) {
    const missingCads: CadData[] = response.data?.missingCads;
    if (missingCads) {
      const names = missingCads.map((v) => v.name).join(", ");
      const toHide = document.querySelectorAll<HTMLElement>(".ngx-overlay.loading-foreground");
      toHide.forEach((el) => {
        el.classList.add("hidden");
      });
      const button = await this.message.button({
        content: "CAD模块中不存在以下数据，你可以选择生成这些CAD，或从模板中删除这些CAD。<br>" + names,
        disableCancel: true,
        buttons: ["生成CAD", "删除CAD"]
      });
      toHide.forEach((el) => {
        el.classList.remove("hidden");
      });
      return button === "生成CAD";
    }
    return null;
  }

  async getCad(params: GetCadParams, options?: HttpOptions): Promise<{cads: CadData[]; total: number}> {
    const result: {cads: CadData[]; total: number} = {cads: [], total: 0};
    const response = await this.post<any>("ngcad/getCad", params, {bypassCodes: [10], ...options});
    if (response && response.data) {
      if (response.code === 10) {
        const data = new CadData(response.data.cad);
        delete data.info.imgId;
        result.cads = [data];
      } else {
        const restore = await this._resolveMissingCads(response);
        if (typeof restore === "boolean") {
          return await this.getCad({...params, restore});
        } else {
          result.cads = response.data.map((v: any) => {
            const v2 = new CadData(v);
            delete v2.info.imgId;
            return v2;
          });
          result.total = response.count || 0;
        }
      }
    }
    return result;
  }

  async getCadRaw(params: GetCadParams) {
    return await this.getDataAndCount<HoutaiCad[]>("ngcad/getCad", {...params, raw: true});
  }

  async setCad(params: SetCadParams, hideLineLength: boolean, options?: HttpOptions): Promise<CadData | null> {
    const cadData = exportCadData(params.cadData);
    const data = {...params, cadData};
    const response = await this.post<any>("ngcad/setCad", data, options);
    if (response && response.data) {
      const resData = response.data;
      const restore = await this._resolveMissingCads(response);
      if (typeof restore === "boolean") {
        if (params.collection === "CADmuban") {
          params.cadData.components.data.forEach((v) => {
            const entities = v.entities;
            entities.image = entities.image.filter((e) => !e.info.convertCadToImage);
          });
        }
        return await this.setCad({...params, restore}, hideLineLength, options);
      } else {
        this.cadImgCache.remove(resData.id);
        return new CadData(resData);
      }
    } else {
      return null;
    }
  }

  async getYuanshicadwenjian(params: GetCadParams) {
    const response = await this.post<any[]>("peijian/cad/getYuanshicadwenjian", params);
    const result: {cads: any[]; total: number} = {cads: [], total: 0};
    if (response && response.data) {
      result.cads = response.data;
      result.total = response.count || 0;
    }
    return result;
  }

  async getCadSearchForm() {
    const response = await this.get("peijian/cad/getSearchForm");
    if (response) {
      return response.data as CadSearchData;
    }
    return [];
  }

  async getCadSearchOptions(table: string) {
    const response = await this.post("peijian/cad/getSearchOptions", {table});
    if (response) {
      return response.data as CadSearchData[0]["items"][0];
    }
    return null;
  }

  async downloadDxf(data: CadData, downloadOptions?: DownloadOptions, options?: HttpOptions) {
    const result = await this.post<any>("peijian/cad/downloadDxf", {cadData: JSON.stringify(data.export())}, options);
    if (result) {
      try {
        downloadByUrl(origin + "/" + result.data.path, downloadOptions);
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    }
    return false;
  }

  async uploadDxf(dxf: File, options?: {skipLineContent?: boolean; rectLineColor?: number}, httpOptions?: HttpOptions) {
    const data = await this.getData<any>("ngcad/uploadDxf", {dxf, options}, httpOptions);
    if (data) {
      return new CadData(data);
    }
    return null;
  }

  async replaceData(source: CadData, target: string, collection: CadCollection) {
    source.sortComponents();
    const response = await this.post<any>("peijian/cad/replaceCad", {
      source: JSON.stringify(source.export()),
      target,
      collection
    });
    if (response) {
      return new CadData(response.data);
    }
    return null;
  }

  async getOptions<T extends OptionsDataData = OptionsDataData>(params: GetOptionsParams, httpOptions?: HttpOptions) {
    const postData: ObjectOf<any> = {...params};
    if (params.data instanceof CadData) {
      delete postData.data;
      const exportData = params.data.export();
      postData.mingzi = exportData.name;
      postData.fenlei = exportData.type;
      postData.xuanxiang = exportData.options;
      postData.tiaojian = exportData.conditions;
    }
    const result = await this.getDataAndCount<T[]>("ngcad/getOptions", postData, httpOptions);
    if (result && !Array.isArray(result.data)) {
      result.data = [];
    }
    return result as OptionsData<T> | null;
  }

  async removeBackup(name: string, time: number) {
    const response = await this.post("peijian/cad/removeBackup", {name, time});
    return response ? true : false;
  }

  async getSuanliaodan(codes: string[]) {
    const data = await this.getData<any[]>("order/order/suanliaodan", {codes});
    return (data || []).map((v) => new CadData(v));
  }

  async removeCads(collection: CadCollection, ids: string[], options?: HttpOptions) {
    return await this.getData<string[]>("peijian/cad/removeCad", {collection, ids}, options);
  }

  async getBancais(table: string, codes: string[]) {
    return await this.getData<{
      bancaiList: BancaiList[];
      bancaiCads: BancaiCad[];
      errors: {code: string; msg: string}[];
      downloadName: string;
      上下走线: string;
      开料孔位配置: string;
      开料参数: string;
    }>("order/order/getBancais", {table, codes});
  }

  async getChangelog(params?: {page?: number; pageSize?: number; branch?: string}, options?: HttpOptions) {
    const result = await this.getData<Changelog>("ngcad/getChangelog", params, options);
    return result || [];
  }

  async removeChangelogItem(index: number, options?: HttpOptions) {
    return await this.getData("ngcad/removeChangelogItem", {index}, options);
  }

  async queryMongodb<T extends MongodbDataBase>(params: QueryMongodbParams, options?: HttpOptions) {
    const data = await this.getData<T[]>("ngcad/queryMongodb", params, options);
    for (const item of data || []) {
      if (isTypeOf(item, "object")) {
        const info = (item as any).json?.info;
        if (isTypeOf(info, "object")) {
          delete info.imgId;
        }
      }
    }
    return data || [];
  }

  async queryMySql<T extends TableDataBase>(params: QueryMysqlParams, options?: HttpOptions) {
    const data = await this.getData<T[]>("ngcad/queryMysql", params, options);
    return data || [];
  }

  async updateMongodb<T extends MongodbDataBase = any>(params: UpdateMongodbParams<T>, options?: HttpOptions) {
    const data = await this.getData<boolean>("ngcad/updateMongodb", params, options);
    return !!data;
  }

  async deleteMongodb(params: DeleteMongodbParams, options?: HttpOptions) {
    const data = await this.getData<boolean>("ngcad/deleteMongodb", params, options);
    return !!data;
  }

  getCadImgUrl(id: string) {
    let url = "";
    if (id) {
      const params: ObjectOf<any> = {id};
      url = this.getUrl("ngcad/cadImg", params);
    }
    if (!url) {
      url = imgCadEmpty;
    }
    return url;
  }
  async setCadImg(id: string, dataURL: string, options?: HttpOptions) {
    const blob = dataURLtoBlob(dataURL);
    const file = new File([blob], `${id}.png`);
    await this.post("ngcad/setCadImg", {id, file}, options);
  }
  async clearCadImgs() {
    await this.post("ngcad/clearCadImgs");
  }

  async getShortUrl(name: string, data?: GetShortUrlParams, options?: HttpOptions) {
    return await this.getData<string>("ngcad/getShortUrl", {name, data}, options);
  }

  async tableInsert<T extends TableDataBase = TableDataBase>(params: TableInsertParams<T>, options?: HttpOptions) {
    return await this.getData<T>("jichu/jichu/table_insert", params, options);
  }

  async tableUpdate<T extends TableDataBase = TableDataBase>(params: TableUpdateParams<T>, options?: HttpOptions) {
    const data = params.data;
    const getParams2 = (params1: TableUpdateParams<T>) => {
      const params2: ObjectOf<any> = {...params1};
      params2.tableData = params2.data;
      delete params2.data;
      return params2;
    };
    const fields = keysOf(data).filter((v) => v !== "vid" && data[v] !== undefined);
    const results = await Promise.all(
      fields.map(async (field) => {
        const data2 = {vid: data.vid, [field]: data[field]} as any;
        const params2 = getParams2({...params, data: data2});
        const response = await this.post<void>("jichu/jichu/table_update", params2, options);
        return response?.code === 0;
      })
    );
    return results.every(Boolean);
  }

  async tableDelete(params: TableDeleteParams, options?: HttpOptions) {
    const response = await this.post<void>("jichu/jichu/table_delete", params, options);
    return response?.code === 0;
  }

  async tableUploadFile<T extends TableDataBase = TableDataBase>(params: TableUploadFile<T>, options?: HttpOptions) {
    const response = await this.post<void>("jichu/jichu/upload_file", params, options);
    return response?.code === 0;
  }

  async tableDeleteFile<T extends TableDataBase = TableDataBase>(params: TableDeleteFile<T>, options?: HttpOptions) {
    const response = await this.post<void>("jichu/jichu/delete_file", params, options);
    return response?.code === 0;
  }

  async getRedisData(key: string, isString = true, options?: HttpOptions) {
    const data = await this.getData<{value: any}>("ngcad/getRedisData", {key, isString}, options);
    return data?.value;
  }

  async setRedisData(value: any, key?: string, expireTime?: number, options?: HttpOptions) {
    await this.post<{key: string; expireTime: number}>("ngcad/setRedisData", {key, value, expireTime}, options);
  }

  async getBancaiList(fubanNumber?: number, options?: HttpOptions) {
    return await this.getData<BancaiListData>("ngcad/getBancaiList", {fubanNumber}, options);
  }

  async getTableRenderData(table: string) {
    return await this.getData<TableRenderData>("ngcad/getTableData", {table});
  }

  async downloadExcel(data: string[][], title?: string, filename?: string) {
    const response = await this.post("ngcad/downloadExcel", {data, title, filename}, {responseType: "blob"});
    return response?.code === 0;
  }

  async uploadImage(file: File | FileList, options?: HttpOptions) {
    if (file instanceof FileList) {
      file = file[0];
    }
    if (!file) {
      return null;
    }
    type UploadImageResult = {url: string; name: string; size: number};
    return await this.getData<UploadImageResult>("ngcad/uploadImage", {key: "file", file}, options);
  }

  async mongodbInsert(collection: CadCollection, data: ObjectOf<any>, optionsInsert?: MongodbInsertOptions, options?: HttpOptions) {
    return await this.getData<string>("ngcad/mongodbTableInsert", {collection, data, ...optionsInsert}, options);
  }

  async mongodbInsertMulti(collection: CadCollection, data: ObjectOf<any>[], optionsInsert?: MongodbInsertOptions, options?: HttpOptions) {
    return await this.getData<string[]>("ngcad/mongodbTableInsertMulti", {collection, data, ...optionsInsert}, options);
  }

  async mongodbUpdate(collection: CadCollection, data: ObjectOf<any>, extraData?: ObjectOf<any>, options?: HttpOptions) {
    const response = await this.post("ngcad/mongodbTableUpdate", {collection, data, extraData}, options);
    if (response?.code === 0) {
      return true;
    }
    return false;
  }

  async mongodbDelete(collection: CadCollection, data: {id: string} | {ids: string[]} | {filter: ObjectOf<any>}, options?: HttpOptions) {
    const params: ObjectOf<any> = {collection};
    if ("id" in data) {
      params.vids = [data.id];
    } else if ("ids" in data) {
      params.vids = data.ids;
    } else if ("filter" in data) {
      params.filter = data.filter;
    }
    const response = await this.post("ngcad/mongodbTableDelete", params, options);
    if (response?.code === 0) {
      return true;
    }
    return false;
  }

  async mongodbCopy(collection: CadCollection, ids: string | string[], optionsCopy?: MongodbCopyOptions, options?: HttpOptions) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    return await this.getData<string[]>("ngcad/mongodbTableCopy", {collection, vids: ids, ...optionsCopy}, options);
  }

  async getXiaodaohangStructure(xiaodaohang: string, options?: HttpOptions) {
    return await this.getData<XiaodaohangStructure>("ngcad/getXiaodaohangStructure", {xiaodaohang}, options);
  }
  async getXiaodaohangStructures(xiaodaohangs: string[], options?: HttpOptions) {
    return await this.getData<ObjectOf<XiaodaohangStructure>>("ngcad/getXiaodaohangStructures", {xiaodaohangs}, options);
  }

  async getMongoId(options?: HttpOptions) {
    return await this.getData<string>("ngcad/getMongoId", {}, options);
  }
}
