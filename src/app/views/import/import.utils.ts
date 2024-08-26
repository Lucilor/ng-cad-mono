import {inject} from "@angular/core";
import {addJs, session} from "@app/app.common";
import {addCadInfoError, CadInfo, CadInfoError} from "@app/cad/portable";
import {MessageService} from "@app/modules/message/services/message.service";
import {AppStatusService} from "@app/services/app-status.service";
import {ObjectOf} from "@lucilor/utils";
import {ImportCache} from "./import.types";

export const openImportPage = (status: AppStatusService, data: ImportCache) => {
  const key = new Date().getTime().toString(16);
  session.save("importParams-" + key, data);
  status.openInNewTab(["import"], {queryParams: {key}});
};

export class BatchUploadChecker {
  private message = inject(MessageService);

  constructor() {
    addJs("batchUploadChecker");
  }

  private getErrorMsg(error: any, methodName: string): CadInfoError {
    console.error(error);
    let errMsg = `【batchUploadChecker.js】调用【${methodName}】出错`;
    if (error instanceof Error) {
      errMsg += `: ${error.message}`;
    }
    return {text: "【batchUploadChecker.js】出错", detail: errMsg};
  }

  parseBaobianzhengmianRules(content: string, vars?: ObjectOf<any>) {
    let result: {errors: CadInfo["errors"]};
    try {
      result = (window as any).parseBaobianzhengmianRules(content, vars);
    } catch (error) {
      result = {errors: [this.getErrorMsg(error, this.parseBaobianzhengmianRules.name)]};
    }
    return result;
  }

  batchCheck(cads: CadInfo[]) {
    const data = cads.map((v) => {
      const json = v.data.export();
      json.选项 = json.options;
      json.条件 = json.conditions;
      return {
        json,
        _id: json.id,
        选项: json.options,
        条件: json.conditions,
        名字: json.name,
        显示名字: json.xianshimingzi,
        分类: json.type,
        分类2: json.type2
      };
    });
    let result: ObjectOf<string[]> | null = null;
    try {
      result = (window as any).batchCheck(data);
    } catch (error) {
      this.message.alert(this.getErrorMsg(error, this.batchCheck.name).detail);
    }
    if (result) {
      for (const cad of cads) {
        const errors = result[cad.data.id];
        if (Array.isArray(errors)) {
          for (const error of errors) {
            addCadInfoError(cad, {text: error, detail: "【batchUploadChecker.js】的报错"});
          }
        }
      }
    }
    return {data, result};
  }
}
