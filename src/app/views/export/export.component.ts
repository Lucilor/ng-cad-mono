import {Component, OnInit} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {ActivatedRoute} from "@angular/router";
import {session, setGlobal} from "@app/app.common";
import {CadExportParams, CadPortable, CadSourceParams, ExportType} from "@app/cad/portable";
import {openCadListDialog} from "@components/dialogs/cad-list/cad-list.component";
import {ProgressBarStatus} from "@components/progress-bar/progress-bar.component";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf, ProgressBar} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService} from "@services/app-status.service";
import {DateTime} from "luxon";
import {ProgressBarComponent} from "../../components/progress-bar/progress-bar.component";
import {ExportCache} from "./export.types";

@Component({
  selector: "app-export",
  templateUrl: "./export.component.html",
  styleUrls: ["./export.component.scss"],
  standalone: true,
  imports: [InputComponent, MatButtonModule, ProgressBarComponent]
})
export class ExportComponent implements OnInit {
  progressBar = new ProgressBar(0);
  progressBarStatus: ProgressBarStatus = "hidden";
  msg = "";
  exportCache: ExportCache | null = null;
  exportParams: CadExportParams = {
    cads: [],
    type: "自由选择",
    exportId: false,
    exportUniqCode: false,
    exportOptions: true
  };
  inputInfos: InputInfo<CadExportParams>[] = [];

  constructor(
    private dialog: MatDialog,
    private http: CadDataService,
    private message: MessageService,
    private status: AppStatusService,
    private route: ActivatedRoute
  ) {
    setGlobal("exporter", this);
  }

  ngOnInit() {
    const {key} = this.route.snapshot.queryParams;
    this.exportCache = session.load<ExportCache>("exportParams-" + key);
    if (this.exportCache?.direct) {
      this.exportCads("导出选中");
    }
    if (!this.exportCache?.lurushuju) {
      const data = this.exportParams;
      this.inputInfos = [
        {type: "boolean", label: "导出ID", appearance: "radio", model: {data, key: "exportId"}},
        {type: "boolean", label: "导出唯一码", appearance: "radio", model: {data, key: "exportUniqCode"}},
        {type: "boolean", label: "导出选项", appearance: "radio", model: {data, key: "exportOptions"}}
      ];
    }
  }

  private async _queryIds(where: ObjectOf<any>, limit?: number) {
    const result: string[][] = [];
    const data = await this.http.queryMongodb({collection: "cad", fields: ["_id"], where});
    const idsAll = data.map((v) => v._id);
    if (typeof limit === "number" && limit > 0) {
      for (let i = 0; i < idsAll.length; i += limit) {
        result.push(idsAll.slice(i, i + limit));
      }
    } else {
      result.push(idsAll);
    }
    return result;
  }

  async exportCads(type: ExportType) {
    this.progressBar.start(1);
    this.progressBarStatus = "progress";
    this.msg = "正在获取数据";
    let idsList: Awaited<ReturnType<typeof this._queryIds>>;
    const finish = (progressBarStatus: ProgressBarStatus, msg?: string) => {
      this.progressBar.end();
      this.progressBarStatus = progressBarStatus;
      this.msg = typeof msg === "string" ? msg : "";
    };
    this.exportParams.type = type;
    delete this.exportParams.sourceParams;
    let filename0: string;
    switch (type) {
      case "包边正面":
        idsList = await this._queryIds({$or: [{分类: "包边正面"}, {分类2: "包边正面"}]});
        filename0 = "包边正面";
        break;
      case "框型":
        idsList = await this._queryIds({
          $or: [{分类: {$regex: "^中横框|锁框|铰框|顶框|底框$"}}, {分类2: {$regex: "^中横框|锁框|铰框|顶框|底框$"}}]
        });
        filename0 = "框型";
        break;
      case "企料":
        idsList = await this._queryIds({
          $or: [
            {分类: {$regex: "^锁企料|扇锁企料|小锁料|中锁料|铰企料|中铰料$"}},
            {分类2: {$regex: "^锁企料|扇锁企料|小锁料|中锁料|铰企料|中铰料$"}}
          ]
        });
        filename0 = "企料";
        break;
      case "框型和企料":
        idsList = await this._queryIds({
          $or: [
            {分类: {$regex: "^中横框|锁框|铰框|顶框|底框|锁企料|扇锁企料|小锁料|中锁料|铰企料|中铰料$"}},
            {分类2: {$regex: "^中横框|锁框|铰框|顶框|底框|锁企料|扇锁企料|小锁料|中锁料|铰企料|中铰料$"}}
          ]
        });
        filename0 = "框型和企料";
        break;
      case "企料分体":
        idsList = await this._queryIds({
          $or: [{名字: {$regex: "分体1|分体2"}}]
        });
        filename0 = "企料分体";
        break;
      case "指定型号": {
        const xinghao = await this.message.prompt({
          type: "string",
          label: "指定型号",
          validators: Validators.required
        });
        if (!xinghao) {
          finish("hidden");
          return;
        }
        const response = await this.http.post<any>("ngcad/getImportDxf", {
          xinghao
        });
        if (response && response.code === 0 && response.data) {
          const xinghaoInfo = response.data.xinghaoInfo;
          let sourceCad: CadData;
          try {
            sourceCad = new CadData(response.data.cad);
          } catch (error) {
            finish("error", "CAD数据错误");
            return;
          }
          const importResult = CadPortable.import({sourceCad});
          const slgses: CadSourceParams["slgses"] = await this.http.queryMongodb({
            collection: "material",
            where: {"选项.型号": xinghao}
          });
          this.exportParams.sourceParams = {sourceCad, importResult, xinghaoInfo, slgses};
        } else {
          finish("error", this.http.lastResponse?.msg || "读取文件失败");
          return;
        }
        idsList = await this._queryIds({$where: `this.选项&&this.选项.型号&&this.选项.型号.split(";").indexOf("${xinghao}")>-1`});
        filename0 = xinghao;
        break;
      }
      case "自由选择":
        {
          let search = this.exportCache?.search;
          if (!search) {
            search = {分类: "^.+$"};
          }
          const cads = await openCadListDialog(this.dialog, {data: {selectMode: "multiple", collection: "cad", search}});
          if (cads) {
            idsList = [cads.map((v) => v.id)];
            filename0 = "自由选择";
          } else {
            finish("hidden");
            return;
          }
        }
        break;
      case "导出选中":
        idsList = [this.exportCache?.ids || []];
        filename0 = "导出选中";
        break;
      case "导出所有": {
        const limit = await this.message.prompt({
          type: "number",
          label: "每次导出数量",
          hint: "必须为自然数，若为0则一次性导出全部cad",
          validators: (control) => {
            const value = control.value;
            if (typeof value === "number" && value >= 0 && Math.floor(value) === value) {
              return null;
            } else {
              return {请输入一个自然数: true};
            }
          }
        });
        if (typeof limit !== "number") {
          finish("hidden");
          return;
        }
        idsList = await this._queryIds(this.exportCache?.search || {}, limit);
        filename0 = "导出所有";
        break;
      }
      default:
        return;
    }
    if (idsList.length > 0) {
      const total = idsList.reduce((p, c) => p + c.length, 0);
      this.progressBar.start(total + idsList.length);
      const step = 20;
      let sum = 0;
      let success = true;
      filename0 += `@${DateTime.now().toFormat("yyyy-MM-dd")}`;
      for (const [i, ids] of idsList.entries()) {
        const cads: CadData[] = [];
        const total2 = ids.length;
        for (let j = 0; j < total2; j += step) {
          const end = Math.min(total2, j + step);
          const currIds = ids.slice(j, end);
          if (j + 1 === end) {
            this.msg = `正在导出数据(${end + sum}/${total})`;
          } else {
            this.msg = `正在导出数据((${j + 1 + sum}~${end + sum})/${total})`;
          }
          const data = await this.http.queryMongodb<HoutaiCad>(
            {collection: "cad", where: {_id: {$in: currIds}}, genUnqiCode: true},
            {spinner: false}
          );
          data.forEach((v) => cads.push(new CadData(v.json)));
          this.progressBar.forward(end - j);
        }
        this.exportParams.cads = cads;
        let result: CadData | undefined;
        try {
          result = await CadPortable.export(this.exportParams, this.status.projectConfig);
        } catch (error) {
          console.error(error);
          finish("error", this.http.lastResponse?.msg || "导出失败");
          return;
        }
        this.msg = "正在下载dxf文件";
        let filename = filename0;
        if (idsList.length > 1) {
          filename += `(${i + 1})`;
        }
        filename += ".dxf";
        const downloadResult = await this.http.downloadDxf(result, {filename}, {spinner: false});
        if (downloadResult) {
          sum += ids.length;
        } else {
          success = false;
          break;
        }
        this.progressBar.forward(1);
      }
      if (success) {
        finish("success", "导出成功");
      } else {
        finish("error", "导出失败");
      }
    } else {
      finish("error", "没有CAD数据");
    }
  }
}
