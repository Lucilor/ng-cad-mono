import {Component, HostBinding, OnInit} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatDividerModule} from "@angular/material/divider";
import {MatTooltipModule} from "@angular/material/tooltip";
import {ActivatedRoute} from "@angular/router";
import {session, setGlobal, timer} from "@app/app.common";
import {setCadData} from "@app/cad/cad-shujuyaoqiu";
import {CadInfo, CadInfoError, CadPortable, PeiheInfo, Slgs, SlgsInfo, SourceCadMap, XinghaoInfo} from "@app/cad/portable";
import {filterCadEntitiesToSave, isShiyitu, reservedDimNames, validateLines} from "@app/cad/utils";
import {InputComponent} from "@app/modules/input/components/input.component";
import {InputInfo} from "@app/modules/input/components/input.types";
import {ProgressBarStatus} from "@components/progress-bar/progress-bar.component";
import {environment} from "@env";
import {CadData, CadDimensionLinear, CadLayer, CadLeader, CadLineLike, CadMtext} from "@lucilor/cad-viewer";
import {downloadByString, keysOf, ObjectOf, ProgressBar, selectFiles, timeout} from "@lucilor/utils";
import {Utils} from "@mixins/utils.mixin";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {HttpOptions} from "@modules/http/services/http.service.types";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import {AppStatusService} from "@services/app-status.service";
import {difference, isEmpty} from "lodash";
import md5 from "md5";
import {NgScrollbar} from "ngx-scrollbar";
import {ProgressBarComponent} from "../../components/progress-bar/progress-bar.component";
import {SpinnerComponent} from "../../modules/spinner/components/spinner/spinner.component";
import {ImportCache, ImportComponentConfig, ImportComponentConfigName, importComponentConfigNames} from "./import.types";
import {BatchUploadChecker} from "./import.utils";

@Component({
  selector: "app-import",
  templateUrl: "./import.component.html",
  styleUrls: ["./import.component.scss"],
  standalone: true,
  imports: [InputComponent, MatButtonModule, MatDividerModule, MatTooltipModule, NgScrollbar, ProgressBarComponent, SpinnerComponent]
})
export class ImportComponent extends Utils() implements OnInit {
  @HostBinding("class") class = "ng-page";

  private _cadNameRegex = /^(?!\d)[\da-zA-Z\u4e00-\u9fa5_]*$/u;
  private _optionsCache: ObjectOf<string[]> = {};
  // private _peiheCadCache: ObjectOf<boolean> = {};
  private _sourceCadMap: SourceCadMap = {cads: {}, slgses: {}};
  private _errorMsgLayer = "导入错误信息";
  sourceFile?: File;
  sourceCad: CadData | null = null;
  batchUploadChecker = new BatchUploadChecker();
  batchCheckData: ReturnType<BatchUploadChecker["batchCheck"]>["data"] | null = null;

  loaderIds = {
    importLoader: "importLoader",
    reimportLoader: "reimportLoader",
    importSuanliaoLoader: "importSuanliaoLoader",
    reimportSuanliaoLoader: "reimportSuanliaoLoader",
    downloadSourceCad: "downloadSourceCad"
  };
  msg = "";
  cads: CadInfo[] = [];
  slgses: SlgsInfo[] = [];
  xinghaoInfo: XinghaoInfo | undefined;
  cadsParsed = false;
  hasError = false;
  isImporting = false;
  progressBar = new ProgressBar(0);
  progressBarStatus: ProgressBarStatus = "hidden";
  importConfigTranslation: Record<ImportComponentConfigName, string> = {
    requireLineId: "上传线必须全部带ID",
    pruneLines: "后台线在上传数据中没有时删除",
    addUniqCode: "没有唯一码生成新CAD数据",
    dryRun: "仅检查数据，不导入",
    noFilterEntities: "示意图不删除小于3的线"
  };
  importConfigNormal: ImportComponentConfig = {
    requireLineId: false,
    pruneLines: true,
    addUniqCode: true,
    dryRun: false,
    noFilterEntities: false
  };
  importConfigSuanliao: ImportComponentConfig = {
    requireLineId: false,
    pruneLines: true,
    addUniqCode: true,
    dryRun: false,
    noFilterEntities: false
  };
  importNormalInputs: InputInfo[] = [];
  importSuanliaoInputs: InputInfo[] = [];
  maxLineLength = 200;
  导入dxf文件时展开名字不改变 = false;
  importCache: ImportCache | null = null;
  compactPage = false;

  constructor(
    private http: CadDataService,
    private message: MessageService,
    private spinner: SpinnerService,
    private status: AppStatusService,
    private route: ActivatedRoute
  ) {
    super();
    setGlobal("importer", this);
  }

  async ngOnInit() {
    if (!environment.production) {
      this.importConfigNormal.requireLineId = false;
      this.importConfigNormal.pruneLines = true;
    }
    this.importSuanliaoInputs.push({
      type: "number",
      label: "使用公式的线段最大长度",
      hint: () => {
        const len = this.maxLineLength;
        if (len > 0) {
          return `长于${len}的线段会被调整至${len}`;
        } else {
          return "最大长度不大于0则不调整";
        }
      },
      model: {data: this, key: "maxLineLength"}
    });

    const {key} = this.route.snapshot.queryParams;
    if (key) {
      this.importCache = session.load<ImportCache>("importParams-" + key);
      if (this.importCache?.yaoqiu?.导入配置) {
        Object.assign(this.importConfigNormal, this.importCache.yaoqiu.导入配置);
      }
      this.compactPage = !!this.importCache?.lurushuju;
    }

    const normalHiddenKeys: ImportComponentConfigName[] = [];
    const suanliaoHiddenKeys: ImportComponentConfigName[] = ["noFilterEntities"];
    if (this.compactPage) {
      const toPush = new Set<ImportComponentConfigName>(importComponentConfigNames);
      if (this.importCache?.yaoqiu?.CAD分类?.includes("算料单示意图")) {
        toPush.delete("noFilterEntities");
      }
      normalHiddenKeys.push(...toPush);
    }
    for (const key of keysOf(this.importConfigTranslation)) {
      const label = this.importConfigTranslation[key];
      this.importNormalInputs.push({
        type: "boolean",
        label,
        appearance: "radio",
        model: {data: this.importConfigNormal, key},
        hidden: normalHiddenKeys.includes(key)
      });
      this.importSuanliaoInputs.push({
        type: "boolean",
        label,
        appearance: "radio",
        model: {data: this.importConfigSuanliao, key},
        hidden: suanliaoHiddenKeys.includes(key)
      });
    }
  }

  private _getImportConfig(isXinghao: boolean) {
    return isXinghao ? this.importConfigSuanliao : this.importConfigNormal;
  }

  private _getImportConfigValues(isXinghao: boolean) {
    const config = this._getImportConfig(isXinghao);
    const values: ObjectOf<boolean> = {};
    this.keysOf(config).forEach((key) => {
      values[key] = !!config[key];
    });
    return values as Record<ImportComponentConfigName, boolean>;
  }

  canSubmit(isXinghao: boolean) {
    if (this.isImporting) {
      return false;
    }
    const {requireLineId, pruneLines} = this._getImportConfig(isXinghao);
    return requireLineId !== null && pruneLines !== null;
  }

  async importDxf(isXinghao: boolean, loaderId: string, file?: File | null): Promise<boolean> {
    timer.start("导入总用时");
    const finish = (hasLoader: boolean, progressBarStatus: ProgressBarStatus, msg?: string) => {
      if (hasLoader) {
        this.spinner.hide(loaderId);
      }
      this.progressBar.end();
      this.progressBarStatus = progressBarStatus;
      this.msg = typeof msg === "string" ? msg : "";
      this.isImporting = false;
      timer.end("导入总用时", "导入总用时");
      return progressBarStatus === "success";
    };
    if (!file) {
      file = (await selectFiles({accept: ".dxf"}))?.[0];
      if (!file) {
        return finish(false, "hidden");
      }
      this.sourceFile = file;
    }
    if (!this.sourceFile) {
      return finish(false, "hidden");
    }
    if (!(await this.message.confirm(`是否确定导入【${this.sourceFile.name}】？`))) {
      return finish(false, "hidden");
    }
    this.isImporting = true;
    this.progressBar.start(1);
    this.progressBarStatus = "progress";
    this.msg = "正在读取dxf";
    timer.start("读取dxf");
    this.spinner.show(loaderId);
    const 导入dxf文件时展开名字不改变 = this.status.projectConfig.getBoolean("导入dxf文件时展开名字不改变");
    const httpOptions: HttpOptions = {silent: true};
    const data = await this.http.uploadDxf(this.sourceFile, {rectLineColor: 3}, {spinner: false});
    if (!data) {
      return finish(true, "error", "读取文件失败");
    }
    timer.end("读取dxf", "读取dxf");
    this.sourceCad = data;
    const removedDimensions = data.info.removedDimensions;
    let errorMsgLayer = data.layers.find((v) => v.name === this._errorMsgLayer);
    if (!errorMsgLayer) {
      errorMsgLayer = new CadLayer();
      errorMsgLayer.name = this._errorMsgLayer;
      data.layers.push(errorMsgLayer);
    }
    data.entities.toArray().forEach((e) => {
      if (e.layer === this._errorMsgLayer) {
        data.entities.remove(e);
      }
    });
    const maxLineLength = isXinghao ? this.maxLineLength : 0;
    this.msg = "正在解析dxf";
    timer.start("解析dxf");
    await timeout(100);
    const {cads, slgses, sourceCadMap, xinghaoInfo} = CadPortable.import({sourceCad: data, maxLineLength, 导入dxf文件时展开名字不改变});
    timer.end("解析dxf", "解析dxf");

    const hasEmptyCad = cads.length < 1 || cads.some((cad) => cad.data.entities.length < 1);
    if (hasEmptyCad) {
      this.message.alert({title: "dxf识别错误", content: "可能原因：<br>cad使用了绿色线<br>数据为空<br>绿色框不封闭"});
      return finish(true, "error", "dxf识别错误");
    }

    if (isXinghao) {
      if (!sourceCadMap.xinghao) {
        this.message.alert("导入文件为非型号文件，请使用左侧按钮。");
        return finish(true, "error", "点错了?");
      }
      const xinghaos = Array.from(new Set(cads.map((v) => v.data.options.型号).filter((v) => v)));
      if (xinghaos.length < 1) {
        return finish(true, "error", "没写型号");
      } else if (xinghaos.length > 1) {
        return finish(true, "error", "型号不一致");
      }
      const xinghao = xinghaos[0];
      const isXinghaoDoneRes = await this.http.post<boolean>("ngcad/isXinghaoDone", {xinghao});
      if (isXinghaoDoneRes?.data === true) {
        this.message.alert("型号已经检查完成，不允许导入。如果需要导入，请先设置型号进度为否。");
        return finish(true, "error", "型号已经检查完成");
      }
    } else {
      if (sourceCadMap.xinghao) {
        this.message.alert("导入文件为型号文件，请使用右侧按钮。");
        return finish(true, "error", "点错了?");
      }
    }
    if (Array.isArray(removedDimensions)) {
      removedDimensions.forEach((v) => {
        data.entities.dimension.push(new CadDimensionLinear(v));
      });
    }
    this._sourceCadMap = sourceCadMap;
    const totalCad = cads.length;
    const totalSlgs = slgses.length;
    this.msg = "正在检查cad";
    timer.start("检查cad");
    await this.parseCads(cads, slgses, isXinghao, httpOptions, xinghaoInfo);
    timer.end("检查cad", "检查cad");
    if (this.hasError && isXinghao) {
      return finish(true, "error", "数据有误");
    }

    timer.start("上传cad");
    const {pruneLines, dryRun} = this._getImportConfigValues(isXinghao);
    if (dryRun) {
      return finish(true, "success", `检查结束`);
    }
    let skipped = 0;
    if (isXinghao) {
      const xinghao = cads[0].data.options.型号;
      const uniqCodes = cads.map((v) => v.data.info.唯一码);
      const oldCadsRaw = await this.http.queryMongodb<HoutaiCad>({
        collection: "cad",
        where: {"选项.型号": xinghao, 分类: "算料", 名字: {$regex: "^((?!分体|上下包边).)*$"}}
      });
      const oldSlgsRaw = await this.http.queryMongodb({collection: "material", where: {"选项.型号": xinghao}});
      const toDelete = {cad: [] as string[], material: [] as string[]};
      oldCadsRaw.forEach((v) => {
        if (!uniqCodes.includes(v.json?.info?.唯一码)) {
          toDelete.cad.push(v._id);
        }
      });
      oldSlgsRaw.forEach((v) => {
        toDelete.material.push(v._id);
      });
      // if (toDelete.cad.length > 0) {
      //     this.msg = "正在删除多余的cad";
      //     await this.dataService.removeCads("cad", toDelete.cad, {silent: true});
      // }
      if (toDelete.material.length > 0) {
        this.msg = "正在删除旧的算料公式";
        await this.http.removeCads("material", toDelete.material, {silent: true});
      }
    }
    this.progressBar.start(totalCad);
    for (let i = 0; i < totalCad; i++) {
      if (cads[i].errors.length > 0) {
        skipped++;
        continue;
      }
      const result = await this.http.setCad(
        {
          collection: "cad",
          cadData: cads[i].data,
          force: true,
          importConfig: {pruneLines}
        },
        true,
        httpOptions
      );
      this.msg = `正在导入dxf数据(${i + 1}/${totalCad})`;
      if (!result) {
        skipped++;
        this.cads[i].errors.push(this.http.lastResponse?.msg || "保存失败");
      }
      this.progressBar.forward();
    }
    this.progressBar.start(totalSlgs);
    for (let i = 0; i < totalSlgs; i++) {
      const responseData = await this.http.getData("ngcad/updateSuanliaogonshi", {data: this.slgses[i].data}, httpOptions);
      this.msg = `正在导入算料公式(${i + 1}/${totalSlgs})`;
      if (!responseData) {
        skipped++;
        this.slgses[i].errors.push(this.http.lastResponse?.msg || "保存失败");
      }
      this.progressBar.forward();
    }
    timer.end("上传cad", "上传cad");

    this.progressBar.start(1);
    this.msg = `正在保存dxf文件`;
    if (isXinghao) {
      const xinghao = this.cads[0].data.options.型号;
      const result = await this.http.post<boolean>("ngcad/setImportDxf", {file: this.sourceFile, xinghao});
      if (!result) {
        return finish(true, "error", this.http.lastResponse?.msg || "保存失败");
      }
    }
    const total = totalCad + totalSlgs;
    let status: ProgressBarStatus;
    if (skipped === total) {
      status = "error";
    } else if (skipped === 0) {
      status = "success";
    } else {
      status = "warning";
    }
    return finish(true, status, `导入结束, ${total - skipped}个成功(共${total}个)`);
  }

  private _getSlgsMd5(slgs: Slgs) {
    const options: [string, string[]][] = [];
    const optionKeys = Object.keys(slgs.选项).sort();
    optionKeys.forEach((key) => {
      options.push([key, CadPortable.splitOptionValue(slgs.选项[key]).sort()]);
    });
    if (Array.isArray(slgs.条件)) {
      slgs.条件.sort();
    }
    return md5(
      JSON.stringify({
        type: slgs.分类,
        conditions: slgs.条件,
        options
      })
    );
  }

  private _clearCache() {
    this._optionsCache = {};
    this._peiheCadCache = {};
  }

  async parseCads(cads: CadInfo[], slgses: SlgsInfo[], isXinghao: boolean, httpOptions: HttpOptions, xinghaoInfo?: XinghaoInfo) {
    this.cadsParsed = false;
    this.hasError = false;
    this._clearCache();
    const uniqCodesCount: ObjectOf<number> = {};
    const {requireLineId, addUniqCode, noFilterEntities} = this._getImportConfigValues(isXinghao);
    for (const v of cads) {
      const data = v.data;
      let uniqCode = data.info.唯一码;
      if (!uniqCode) {
        if (addUniqCode) {
          if (isXinghao) {
            v.data.info.唯一码 = CadPortable.getUniqCode(v.data, this.importCache, this.status.user$.value);
          } else {
            const 唯一码 = await this.http.getData<string>(
              "ngcad/generateUniqCode",
              {uniqCode: CadPortable.getUniqCode(v.data, this.importCache, this.status.user$.value)},
              httpOptions
            );
            if (唯一码) {
              v.data.info.唯一码 = 唯一码;
            } else {
              v.errors.push("无法生成唯一码");
            }
          }
          uniqCode = v.data.info.唯一码;
        }
      }
      if (!uniqCode) {
        continue;
      }
      if (uniqCodesCount[uniqCode] === undefined) {
        uniqCodesCount[uniqCode] = 1;
      } else {
        uniqCodesCount[uniqCode]++;
      }

      if (!noFilterEntities) {
        const {entities} = filterCadEntitiesToSave(data);
        data.entities = entities;
      }

      const {xinghao, searchYaoqiu} = this.importCache || {};
      let yaoqiu = this.importCache?.yaoqiu;
      if (!yaoqiu && searchYaoqiu) {
        await this.status.fetchCad数据要求List();
        yaoqiu = this.status.getCad数据要求(data.type);
      }
      if (yaoqiu) {
        setCadData(data, yaoqiu.新建CAD要求);
        for (const {cadKey, key, key2, required} of yaoqiu.新建CAD要求) {
          const dataAny = data as any;
          if (cadKey && required) {
            if (key2 && !dataAny[cadKey][key2]) {
              v.errors.push(`【${key}${key2}】不能为空`);
            } else if (!dataAny[cadKey]) {
              v.errors.push(`【${key}】不能为空`);
            }
          }
        }
      }
      if (xinghao) {
        data.options.型号 = xinghao;
      }
      const ellipses = data.entities.filter((e) => e.info.isEllipse);
      if (ellipses.length > 0) {
        v.errors.push("不能在CAD里画椭圆，不支持椭圆");
        ellipses.forEach((e) => {
          const e2 = this.sourceCad?.entities.find(e.id);
          if (e2) {
            e2.setColor("red");
            e2.layer = this._errorMsgLayer;
          }
        });
      }
    }

    this.cads = cads;
    this.slgses = slgses;
    this.xinghaoInfo = xinghaoInfo;

    const slgsMd5Map: ObjectOf<SlgsInfo[]> = {};
    slgses.forEach((slgs) => {
      const md5Str = this._getSlgsMd5(slgs.data);
      if (slgsMd5Map[md5Str]) {
        slgsMd5Map[md5Str].push(slgs);
      } else {
        slgsMd5Map[md5Str] = [slgs];
      }
    });
    for (const md5Str in slgsMd5Map) {
      if (slgsMd5Map[md5Str].length > 1) {
        this.hasError = true;
        slgsMd5Map[md5Str].forEach((slgs) => {
          slgs.errors.push("算料公式重复");
        });
      }
    }

    const totalCad = cads.length;
    const totalSlgs = slgses.length;
    this.progressBar.start(totalCad);
    for (let i = 0; i < totalCad; i++) {
      this.msg = `正在检查dxf数据(${i + 1}/${totalCad})`;
      this.progressBar.forward();
      await timeout(200);
      await this._validateCad(cads[i], uniqCodesCount, requireLineId, httpOptions);
    }
    this.progressBar.start(totalSlgs);
    for (let i = 0; i < totalSlgs; i++) {
      this.msg = `正在检查算料公式数据(${i + 1}/${totalSlgs})`;
      this.progressBar.forward();
      await timeout(100);
      await this._validateSlgs(slgses[i], httpOptions);
    }
    this.progressBar.start(1);

    const {data} = this.batchUploadChecker.batchCheck(cads);
    this.batchCheckData = data;

    if (xinghaoInfo) {
      this.msg = `正在检查型号配置`;
      this.progressBar.forward();
      if (xinghaoInfo.errors.length > 0) {
        this.hasError = true;
      }
    }

    const sourceCad = this.sourceCad;
    if (sourceCad) {
      for (const e of sourceCad.entities.dimension) {
        if (e.layer === "0") {
          e.layer = "标注线";
        }
      }
      for (const cad of this.cads) {
        if (cad.errors.length > 0) {
          this.hasError = true;
          const sourceCadInfo = this._sourceCadMap.cads[cad.data.id];
          const mtext = new CadMtext();
          mtext.text = cad.errors.map((v) => (typeof v === "string" ? v : v.text)).join("\n");
          mtext.setColor("red");
          mtext.layer = this._errorMsgLayer;
          mtext.insert.set(sourceCadInfo.rect.left, sourceCadInfo.rect.bottom - 10);
          sourceCad.entities.add(mtext);
          cad.data.entities.forEach((e) => {
            if (!(e instanceof CadLineLike)) {
              return;
            }
            const errors = e.info.errors;
            if (!Array.isArray(errors) || errors.length < 1) {
              return;
            }
            const leader = new CadLeader({layer: this._errorMsgLayer});
            const pointTo = e.middle.clone();
            const pointFrom = pointTo.clone().sub(20, 20);
            leader.vertices = [pointTo, pointFrom];
            leader.size = 10;
            leader.setColor("red");
            leader.layer = this._errorMsgLayer;
            sourceCad.entities.add(leader);
            const e2 = sourceCad.entities.find(e.id);
            if (e2) {
              e2.setColor("red");
            }
          });
        }
      }
    }
    this.cadsParsed = true;
  }

  private async _validateOptions(options: ObjectOf<string>, httpOptions: HttpOptions) {
    const errors: string[] = [];
    for (const optionKey in options) {
      const optionValues = CadPortable.splitOptionValue(options[optionKey]);
      const tmpVals: string[] = [];
      const duplicateValues: string[] = [];
      optionValues.forEach((v) => {
        if (tmpVals.includes(v)) {
          duplicateValues.push(v);
        } else {
          tmpVals.push(v);
        }
      });
      if (duplicateValues.length > 0) {
        errors.push(`选项【${optionKey}】重复: ${duplicateValues.join(", ")}`);
      }
      if (this._optionsCache[optionKey] === undefined) {
        const optionInfo = await this.http.getOptions({name: optionKey}, httpOptions);
        this._optionsCache[optionKey] = (optionInfo?.data || []).map((v) => v.name);
      }
      const optionsNotExist = difference(optionValues, this._optionsCache[optionKey], ["所有", "不选", "不选无"]);
      if (optionsNotExist.length > 0) {
        errors.push(`选项【${optionKey}】不存在或已停用: ${optionsNotExist.join(", ")}`);
      }
    }
    return errors;
  }

  private async _validateCad(cad: CadInfo, uniqCodesCount: ObjectOf<number>, requireLineId: boolean, httpOptions: HttpOptions) {
    if (cad.data.info.isEmpty) {
      cad.errors = cad.data.info.errors;
      return;
    }
    const data = cad.data;

    if (Array.isArray(data.info.errors)) {
      cad.errors = cad.errors.concat(data.info.errors);
      delete data.info.errors;
    }

    if (!isEmpty(data.blocks)) {
      cad.errors.push("不能包含块实体");
    }

    const uniqCode = data.info.唯一码;
    if (!uniqCode) {
      cad.errors.push("没有唯一码");
    } else if (uniqCodesCount[uniqCode] > 1) {
      cad.errors.push("唯一码重复: " + uniqCode);
    }
    if (!data.type && !cad.skipErrorCheck.has("分类")) {
      cad.errors.push("没有分类");
    }
    CadPortable.addLineId(data);

    data.name = data.name.replaceAll("-", "_");
    if (/^\d+/.test(data.name)) {
      data.name = "_" + data.name;
    } else if (!this._cadNameRegex.test(data.name) && !cad.skipErrorCheck.has("名字")) {
      cad.errors.push("CAD名字只能是：中文、英文字母、数字、下划线");
    }
    if (/分体\d?$/.test(data.name) && data.type.includes("算料") && /包边|企料|锁料|铰料/.test(data.name)) {
      cad.errors.push("算料CAD名字不能包含【包边、企料、锁料、铰料】");
    }
    let 修改包边正面宽规则 = data.info.修改包边正面宽规则;
    if (data.type === "包边正面") {
      if (修改包边正面宽规则) {
        修改包边正面宽规则 = "修改包边正面宽规则:\n" + 修改包边正面宽规则;
        const result = this.batchUploadChecker.parseBaobianzhengmianRules(修改包边正面宽规则, data.info.vars);
        cad.errors.push(...result.errors);
      }
    } else if (修改包边正面宽规则) {
      cad.errors.push("分类不为【包边正面】不能写【修改包边正面宽规则】");
    }
    if (data.info.锁边自动绑定可搭配铰边 && !/锁企料|扇锁企料/.test(data.type)) {
      cad.errors.push("分类不为【锁企料】或【扇锁企料】不能有【锁边自动绑定可搭配铰边】");
    }
    if (data.kailiaoshibaokeng && data.zhidingweizhipaokeng.length > 0) {
      cad.errors.push("不能同时设置【全部刨坑】和【指定位置刨坑】");
    }
    const entities = data.getAllEntities();
    if (requireLineId) {
      const lines = entities.filter((v) => v instanceof CadLineLike).toArray() as CadLineLike[];
      if (lines.some((v) => !v.线id)) {
        cad.errors.push("存在没有id的线");
      }
    }
    cad.errors = cad.errors.concat(validateLines(data).errors);
    cad.errors = cad.errors.concat(await this._validateOptions(data.options, httpOptions));
    cad.errors = cad.errors.concat(await this._validateOptions(data.对应计算条数的配件, httpOptions));

    const infoObj: ObjectOf<PeiheInfo[]> = {
      锁企料: [
        "锁框",
        "顶框"
        // "中锁料",
      ],
      扇锁企料: [{type: "小锁料", options: {isNot: {产品分类: ["单门", "", undefined, null]}}}]
      // 铰企料: ["中铰料"]
    };
    CadPortable.splitOptionValue(data.info.锁边自动绑定可搭配铰边).forEach((v) => {
      infoObj.锁企料.push({type: "铰企料", options: {is: {铰边: v}}, hint: v});
    });
    let infoArray: PeiheInfo[] | undefined;
    const types = CadPortable.getTypes(data);
    for (const t of types) {
      if (infoObj[t]) {
        infoArray = infoObj[t];
        break;
      }
    }
    if (infoArray !== undefined) {
      const infoArray2: PeiheInfo[] = [];
      for (const info of infoArray) {
        const dataArr = this.cads.map((v) => v.data);
        const {value} = CadPortable.hasPeiheCad(dataArr, info, data.options);
        if (!value) {
          infoArray2.push(info);
        }
      }
      const result = await this._matchPeiheCad(infoArray2, data.options);
      result.forEach((matched, i) => {
        const info = infoArray2[i];
        if (!matched) {
          if (typeof info === "string") {
            cad.errors.push(`缺少对应${info}`);
          } else {
            let error = `缺少对应${info.type}`;
            if (info.hint) {
              error += `: ${info.hint}`;
            }
            cad.errors.push(error);
          }
        }
      });
    }

    if (this.slgses.length > 0) {
      const optionKeys = ["型号", "产品分类"];
      optionKeys.forEach((key) => {
        if (!data.options[key]) {
          cad.errors.push(`缺少选项: 【${key}】`);
        }
      });
    }

    data.entities.dimension.forEach((e) => {
      if (e instanceof CadDimensionLinear) {
        if (reservedDimNames.includes(e.mingzi)) {
          cad.errors.push(`标注名字不能是【${e.mingzi}】`);
        }
        if (e.defPoints) {
          cad.errors.push(`标注【${e.mingzi}】没有标到直线端点`);
        }
        if (isShiyitu(data)) {
          if (e.mingzi.includes("=")) {
            cad.errors.push("示意图标注不能有=号");
          } else if (!e.mingzi.includes("显示公式")) {
            e.mingzi = "显示公式: " + e.mingzi;
          }
        } else {
          if (e.info.isGongshi) {
            if (!e.mingzi.includes("显示公式")) {
              e.mingzi = "显示公式: " + e.mingzi;
            }
            const id1 = e.entity1.id;
            const id2 = e.entity2.id;
            if (!(id1 && id2)) {
              cad.errors.push(`公式标注【=${e.mingzi}】识别错误, 必须标到两个端点`);
            }
          }
        }
      }
    });
    for (const e of data.entities.line) {
      if (e.gongshi.match(/[,.;，。；]/)) {
        cad.errors.push(`线公式不能包含逗号、句号或分号`);
        break;
      }
    }
  }

  private async _validateSlgs(slgs: SlgsInfo, httpOptions: HttpOptions) {
    const data = slgs.data;
    slgs.errors = slgs.errors.concat(await this._validateOptions(data.选项, httpOptions));
    if (Object.keys(data.公式).length > 0) {
      const strict = this.http.strict;
      this.http.strict = false;
      const response = await this.http.post("ngcad/validateFormulas", {formulas: data.公式}, httpOptions);
      this.http.strict = strict;
      if (response?.code !== 0) {
        const msg = response?.msg || "验证算料公式时出错";
        slgs.errors.push(msg);
      }
      for (const key in data.公式) {
        if (key.includes("-")) {
          slgs.errors.push(`算料公式名字不能包含-号: ${key}`);
        }
      }
    } else {
      slgs.errors.push("公式内容为空");
    }

    if (slgs.errors.length > 0) {
      this.hasError = true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _matchPeiheCad(infoArray: PeiheInfo[], options: ObjectOf<string>) {
    return infoArray.map(() => true);
    // const result: boolean[] = [];
    // const indice: number[] = [];
    // const cache = this._peiheCadCache;
    // const keys = infoArray.map((info, i) => {
    //   const key = md5(JSON.stringify({info, options}));
    //   if (cache[key] !== undefined) {
    //     result[i] = cache[key];
    //   } else {
    //     result[i] = false;
    //     indice.push(i);
    //   }
    //   return key;
    // });
    // infoArray.forEach((_, i) => {
    //   if (cache[keys[i]] !== undefined) {
    //     result[i] = cache[keys[i]];
    //   } else {
    //     indice.push(i);
    //   }
    // });
    // if (indice.length > 0) {
    //   infoArray = infoArray.filter((_, i) => indice.includes(i));
    //   const response = await this.dataService.post<boolean[]>("peijian/cad/matchPeiheCad", {infoArray, options});
    //   this.dataService.getResponseData(response)?.forEach((matched, i) => {
    //     const j = indice[i];
    //     result[j] = matched;
    //     cache[keys[j]] = matched;
    //   });
    // }
    // return result;
  }

  async downloadSourceCad() {
    if (!this.sourceCad) {
      return;
    }
    this.spinner.show(this.loaderIds.downloadSourceCad);
    await this.http.downloadDxf(this.sourceCad);
    this.spinner.hide(this.loaderIds.downloadSourceCad);
  }

  downloadBatchCheckData() {
    let filename: string | undefined;
    if (this.sourceFile) {
      filename = this.sourceFile.name.split(".")[0] + ".json";
    }
    downloadByString(JSON.stringify(this.batchCheckData), {filename});
  }

  isString(v: any): v is string {
    return typeof v === "string";
  }

  alertError(error: CadInfoError) {
    this.message.alert(error.detail);
  }
}
