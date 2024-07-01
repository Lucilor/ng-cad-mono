import {Injectable} from "@angular/core";
import {ActivatedRoute, Params, Router, UrlCreationOptions} from "@angular/router";
import {setCadData, unsetCadData} from "@app/cad/cad-data-transform";
import {getCadPreview, updateCadPreviewImg} from "@app/cad/cad-preview";
import {Cad数据要求, Cad数据要求Raw} from "@app/cad/cad-shujuyaoqiu";
import {CadCollection} from "@app/cad/collections";
import {
  exportCadData,
  filterCadEntitiesToSave,
  generateLineTexts2,
  getCadTotalLength,
  getLineLengthTextSize,
  prepareCadViewer,
  removeIntersections,
  showIntersections,
  suanliaodanZoomIn,
  suanliaodanZoomOut,
  validateCad,
  validateLines
} from "@app/cad/utils";
import {ProjectConfig, ProjectConfigRaw} from "@app/utils/project-config";
import {getXinghaoQuery, 算料公式} from "@components/lurushuju/xinghao-data";
import {environment} from "@env";
import {
  CadData,
  CadEntities,
  CadEntity,
  CadHatch,
  CadLine,
  CadLineLike,
  CadMtext,
  CadViewer,
  generatePointsMap,
  PointsMap,
  setLinesLength
} from "@lucilor/cad-viewer";
import {FileSizeOptions, getFileSize, isTypeOf, ObjectOf, timeout} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {getHoutaiCad} from "@modules/http/services/cad-data.service.utils";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import {clamp, differenceWith} from "lodash";
import {BehaviorSubject, Subject} from "rxjs";
import {local, remoteHost, timer} from "../app.common";
import {AppConfig, AppConfigService} from "./app-config.service";
import {AppUser, CadPoints, OpenCadOptions} from "./app-status.types";
import {CadStatus, CadStatusNormal} from "./cad-status";

const 合型板示意图 = new CadData();
合型板示意图.entities.add(new CadLine({start: [0, 20], end: [0, -20]}));
合型板示意图.entities.add(new CadLine({start: [0, 20], end: [8, 20]}));
合型板示意图.entities.add(new CadLine({start: [0, -20], end: [8, -20]}));
合型板示意图.entities.add(new CadLine({start: [20, 0], end: [-20, 0]}));
合型板示意图.entities.add(new CadLine({start: [20, 0], end: [20, 8]}));
合型板示意图.entities.add(new CadLine({start: [-20, 0], end: [-20, 8]}));
合型板示意图.entities.add(new CadLine({start: [20, 0], end: [20, 8]}));
const replaceMap: ObjectOf<CadData> = {合型板示意图};

@Injectable({
  providedIn: "root"
})
export class AppStatusService {
  project = "";
  collection$ = new BehaviorSubject<CadCollection>("cad");
  cadTotalLength$ = new BehaviorSubject<number>(0);
  cadStatus = new CadStatusNormal();
  cadStatusEnter$ = new BehaviorSubject<CadStatus>(new CadStatusNormal());
  cadStatusExit$ = new BehaviorSubject<CadStatus>(new CadStatusNormal());
  cad = new CadViewer(setCadData(new CadData({name: "新建CAD", info: {isLocal: true}}), this.project, "cad", this.config.getConfig()));
  components = {
    selected$: new BehaviorSubject<CadData[]>([]),
    mode$: new BehaviorSubject<"single" | "multiple">("single"),
    selectable$: new BehaviorSubject<boolean>(true)
  };
  openCad$ = new BehaviorSubject<OpenCadOptions>({});
  saveCadStart$ = new Subject<void>();
  saveCadEnd$ = new Subject<{data: CadData}>();
  saveCadLocked$ = new BehaviorSubject<boolean>(false);
  cadPoints$ = new BehaviorSubject<CadPoints>([]);
  setProject$ = new Subject<void>();
  user$ = new BehaviorSubject<AppUser | null>(null);
  isAdmin$ = new BehaviorSubject<boolean>(false);
  updateTimeStamp$ = new BehaviorSubject<number>(-1);
  zhewanLengths$ = new BehaviorSubject<[number, number]>([1, 3]);
  changeProject$ = new Subject<string>();
  private _isZhewanLengthsFetched = false;
  projectConfig = new ProjectConfig();

  forceUpdateCadImg = false;
  forceUpdateCadImg2 = false;
  updateCadImglLock$ = new BehaviorSubject<number>(0);
  cadImgToUpdate: ObjectOf<{t: number}> = {};

  constructor(
    private config: AppConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private http: CadDataService,
    private message: MessageService,
    private spinner: SpinnerService
  ) {
    this.cad.setConfig(this.config.getConfig());
    this.config.configChange$.subscribe(({newVal}) => {
      const cad = this.cad;
      cad.setConfig(newVal);
    });
    this.components.mode$.subscribe((mode) => {
      this.config.setConfig("subCadsMultiSelect", mode === "multiple");
    });
    this.cad.on("click", (event) => {
      if (this.config.getConfig("cadPointsAnywhere")) {
        const {clientX: x, clientY: y} = event;
        this.cadPoints$.next([...this.cadPoints$.value, {x, y, lines: [], active: true}]);
      }
    });
  }

  private _replaceText(source: CadData, text: string, data: CadData) {
    const mtexts = source.getAllEntities().filter((e) => e instanceof CadMtext && e.text === text);
    mtexts.forEach((mtext) => {
      const insert = (mtext as CadMtext).insert;
      const entities = data.getAllEntities().clone();
      entities.transform({translate: insert.toArray()}, true);
      source.entities.merge(entities);
    });
    source.separate(new CadData({entities: mtexts.export()}));
  }

  get refreshTimeStamp() {
    return Number(local.load("refreshTimeStamp") || -1);
  }
  set refreshTimeStamp(value) {
    local.save("refreshTimeStamp", value);
  }

  async getUpdateTimeStamp() {
    const s = await this.http.getData<string>("ngcad/getUpdateTime", {beta: environment.beta}, {spinner: false});
    let n = Number(s);
    if (typeof n !== "number" || isNaN(n)) {
      n = 0;
    }
    this.updateTimeStamp$.next(n);
    return n;
  }

  async setProject(queryParams: Params) {
    this.checkEnvBeta();
    const {project, action} = queryParams;
    if (project && project !== this.project) {
      this.project = project;
      this.http.baseURL = `${origin}/n/${project}/index/`;
      if (action) {
        this.config.noUser = true;
      } else {
        const response = await this.http.get<AppUser>("ngcad/getUser", {timeStamp: new Date().getTime()}, {silent: true});
        if (!response) {
          this.http.offlineMode = true;
        }
        if (response?.data) {
          this.user$.next(response.data);
          this.isAdmin$.next(response.data.isAdmin);
        }
        await this.config.getUserConfig();
      }
      const updateTimeStamp = await this.getUpdateTimeStamp();
      if (environment.production && updateTimeStamp > this.refreshTimeStamp) {
        this.message.snack("版本更新，自动刷新页面");
        this.refreshTimeStamp = new Date().getTime();
        await timeout(1000);
        location.reload();
        return false;
      }
      this.updateTimeStamp$.next(updateTimeStamp);
      this.setProject$.next();

      {
        const data = await this.http.getData<ProjectConfigRaw>("ngcad/getProjectConfig", {spinner: false});
        this.projectConfig.setRaw(data || {});
      }
    }
    return true;
  }

  setCadStatus(value: CadStatus, confirmed = false) {
    this.cadStatus.confirmed = confirmed;
    this.cadStatusExit$.next(this.cadStatus);
    this.cadStatus = value;
    this.cadStatusEnter$.next(value);
  }

  toggleCadStatus(cadStatus: CadStatus) {
    const {name, index} = this.cadStatus;
    if (name === cadStatus.name && index === cadStatus.index) {
      this.setCadStatus(new CadStatusNormal());
    } else {
      this.setCadStatus(cadStatus);
    }
  }

  async openCad(opts: OpenCadOptions = {}) {
    const timerName = "openCad";
    timer.start(timerName);
    const cad = this.cad;
    opts = {center: false, isLocal: false, ...opts};
    const {data, center, beforeOpen, isDialog} = opts;
    let collection = opts.collection;
    if (data) {
      cad.data = data;
    }
    const isLocal = opts.isLocal || cad.data.info.isLocal || false;
    const newConfig: Partial<AppConfig> = {};
    if (collection && this.collection$.value !== collection) {
      this.collection$.next(collection);
    } else {
      collection = this.collection$.value;
    }
    if (collection === "CADmuban") {
      this.config.setConfig({hideLineLength: true, hideLineGongshi: true}, {sync: false});
    }
    const parentEl = cad.dom.parentElement;
    if (parentEl) {
      this.cad.resize(parentEl.clientWidth, parentEl.clientHeight);
    }

    const id = cad.data.id;
    const {id: id2, collection: collection2} = this.route.snapshot.queryParams;
    if (!isLocal && (id !== id2 || collection !== collection2)) {
      if (this.router.url.startsWith("/index")) {
        this.router.navigate(["/index"], {queryParams: {id, collection}, queryParamsHandling: "merge"});
      }
    }
    this.config.setUserConfig(newConfig);
    await prepareCadViewer(cad);

    const updatePreview = async (data2: CadData, mode: Parameters<typeof updateCadPreviewImg>[1]) => {
      const result = await Promise.all(data2.components.data.map(async (v) => await updateCadPreviewImg(v, mode, !shouldUpdatePreview)));
      return result.flat();
    };
    const 算料单CAD模板使用图片装配 = this.projectConfig.getBoolean("算料单CAD模板使用图片装配");
    const shouldUpdatePreview = collection === "CADmuban" && 算料单CAD模板使用图片装配;
    const prevConfig = this.config.setConfig({hideLineLength: true, hideLineGongshi: true}, {sync: false});
    await cad.reset().render();
    if (data) {
      setCadData(data, this.project, collection, this.config.getConfig());
      if (!environment.production) {
        showIntersections(data, this.projectConfig);
      }
      for (const key in replaceMap) {
        this._replaceText(data, key, replaceMap[key]);
      }
      if (Object.keys(data.对应计算条数的配件).length < 1) {
        data.对应计算条数的配件[""] = "";
      }
      suanliaodanZoomIn(data);
      if (collection === "cad") {
        validateLines(data);
      }
      this.generateLineTexts();
      await updatePreview(data, "pre");
    }

    if (center) {
      cad.center();
    }
    this.config.setConfig(prevConfig);
    this.updateCadTotalLength();
    if (!isDialog) {
      this.updateTitle();
    }

    if (data) {
      await cad.render(await updatePreview(data, "post"));
    } else {
      await cad.render();
    }

    if (beforeOpen) {
      const res = beforeOpen(cad.data);
      if (res instanceof Promise) {
        await res;
      }
    }
    this.openCad$.next(opts);
    timer.end(timerName, "打开CAD");
    return opts;
  }

  closeCad(data?: CadData) {
    if (!data) {
      data = this.cad.data;
    }
    const data2 = data.clone();
    unsetCadData(data2);
    if (!environment.production) {
      removeIntersections(data2);
    }
    data2.getAllEntities().forEach((e) => (e.visible = true));
    suanliaodanZoomOut(data2);
    return data2;
  }

  async saveCad(loaderId?: string): Promise<CadData | null> {
    this.saveCadStart$.next();
    this.saveCadLocked$.next(true);
    await timeout(100); // 等待input事件触发
    const {http, message, spinner} = this;
    const collection = this.collection$.value;

    let data = this.cad.data;
    const {entities, minLineLength} = filterCadEntitiesToSave(data);
    const toDeleteCount = data.entities.length - entities.length;
    if (toDeleteCount > 0) {
      const btn = await this.message.button({
        content: `需要删除${toDeleteCount}条线长小于${minLineLength}的线`,
        buttons: ["删除", "不删除保存"],
        btnTexts: {cancel: "取消保存"}
      });
      if (btn === "取消保存") {
        return null;
      } else if (btn === "删除") {
        data.entities = entities;
      }
    }

    let resData: CadData | null = null;
    let errMsg = this.validate(true)?.errors || [];
    const blockError = "不能包含块";
    if (errMsg.includes(blockError)) {
      const button = await message.button({content: blockError, buttons: ["删除块实体"]});
      if (button !== "删除块实体") {
        return null;
      }
      data.blocks = {};
      data.entities.insert = [];
      errMsg = errMsg.filter((v) => v !== blockError);
    }
    if (errMsg.length > 0) {
      const yes = await message.confirm("当前打开的CAD存在错误，是否继续保存？<br>" + errMsg.join("<br>"));
      if (!yes) {
        return null;
      }
    }
    data = this.closeCad();
    const isLocal = this.openCad$.value.isLocal;
    if (isLocal) {
      this.saveCadEnd$.next({data});
      this.saveCadLocked$.next(false);
      return data;
    }
    if (!loaderId) {
      loaderId = spinner.defaultLoaderId;
    }
    const {hideLineLength} = this.config.getConfig();
    spinner.show(loaderId, {text: `正在保存CAD: ${data.name}`});
    const xinghaoQuery = getXinghaoQuery(this.route);
    if (xinghaoQuery) {
      const params: ObjectOf<any> = {...xinghaoQuery, id: data.id, data: getHoutaiCad(data)};
      const resData2 = await this.http.getData<HoutaiCad>("shuju/api/getOrSetCad", params);
      resData = resData2 ? new CadData(resData2.json) : null;
    } else {
      delete data.info.imgId;
      delete data.info.imgUpdate;
      resData = await http.setCad({collection, cadData: data, force: true}, hideLineLength);
    }
    if (resData) {
      this.saveCadEnd$.next({data: resData});
      await this.openCad({
        data: resData,
        collection,
        beforeOpen: async (data2) => {
          const url = await getCadPreview(collection, data2);
          const img = new Image();
          img.style.background = "black";
          img.src = url;
          document.body.prepend(img);
          await http.setCadImg(data2.id, url, {silent: true});
          this.cadImgToUpdate[data2.id] = {t: Date.now()};
        }
      });
      this.saveCadLocked$.next(false);
    }
    spinner.hide(loaderId);
    return resData;
  }

  generateLineTexts() {
    const data = this.cad.data;
    if (this.collection$.value === "CADmuban") {
      data.entities.line.forEach((e) => {
        e.children.mtext = e.children.mtext.filter((mt) => !mt.info.isLengthText && !mt.info.isGongshiText);
      });
      data.components.data.forEach((v) => generateLineTexts2(v));
    } else {
      generateLineTexts2(data);
    }
  }

  getCadPoints(map?: PointsMap | CadEntities, mid?: boolean) {
    if (!map) {
      return [];
    }
    if (map instanceof CadEntities) {
      const midPoints: PointsMap = [];
      if (mid) {
        map.forEach((e) => {
          if (e instanceof CadLineLike) {
            midPoints.push({point: e.middle, lines: [e], selected: false});
          }
        }, true);
      }
      map = generatePointsMap(map).concat(midPoints);
    }
    return map.map((v) => {
      const {x, y} = this.cad.getScreenPoint(v.point.x, v.point.y);
      return {x, y, active: v.selected, lines: v.lines.map((vv) => vv.id)} as CadPoints[0];
    });
  }

  setCadPoints(map: PointsMap | CadEntities = [], opts: {include?: CadPoints; exclude?: {x: number; y: number}[]; mid?: boolean} = {}) {
    const {exclude, mid} = opts;
    const points = this.getCadPoints(map, mid);
    this.cadPoints$.next(differenceWith(points, exclude || [], (a, b) => a.x === b.x && a.y === b.y).concat(opts.include || []));
  }

  addCadPoint(point: CadPoints[0], i?: number) {
    const points = this.cadPoints$.value;
    if (typeof i !== "number") {
      i = points.length;
    }
    points.splice(i, 0, point);
    this.cadPoints$.next(points);
  }

  removeCadPoint(i: number) {
    const points = this.cadPoints$.value;
    i = clamp(i, 0, points.length - 1);
    points.splice(i, 1);
    this.cadPoints$.next(points);
  }

  validate(force?: boolean) {
    const noInfo = !this.config.getConfig("validateLines");
    if (this.collection$.value !== "cad") {
      return null;
    }
    if (!force && noInfo) {
      return null;
    }
    const result = validateCad(this.cad.data, noInfo);
    this.cad.render();
    return result;
  }

  updateCadTotalLength() {
    this.cadTotalLength$.next(getCadTotalLength(this.cad.data));
  }

  setLinesLength(lines: CadLine[], length: number) {
    setLinesLength(this.cad.data, lines, length);
    for (const line of lines) {
      line.lengthTextSize = getLineLengthTextSize(line);
    }
    this.updateCadTotalLength();
  }

  updateTitle() {
    document.title = this.cad.data.name || "无题";
  }

  focus(entities?: CadEntities | CadEntity[], opt?: {selected?: boolean | ((e: CadEntity) => boolean | null)}) {
    entities = entities ?? this.cad.data.getAllEntities();
    const selected = opt?.selected ?? false;
    entities.forEach((e) => {
      if (!e.visible) {
        return;
      }
      e.selectable = !(e instanceof CadHatch);
      e.selected = (typeof selected === "function" ? selected(e) : selected) ?? false;
      e.opacity = 1;
    });
  }

  blur(entities?: CadEntities | CadEntity[], opt?: {selected?: boolean | ((e: CadEntity) => boolean | null)}) {
    entities = entities ?? this.cad.data.getAllEntities();
    const selected = opt?.selected ?? false;
    entities.forEach((e) => {
      if (!e.visible) {
        return;
      }
      e.selectable = false;
      e.selected = (typeof selected === "function" ? selected(e) : selected) ?? false;
      e.opacity = 0.3;
    });
  }

  openCadInNewTab(id: string, collection: CadCollection) {
    if (!id) {
      return;
    }
    const params = {project: this.project, collection, id};
    open("index?" + new URLSearchParams(params).toString());
  }

  openInNewTab(commands: any[], navigationExtras?: UrlCreationOptions | undefined) {
    if (!navigationExtras) {
      navigationExtras = {};
    }
    navigationExtras.queryParams = {...navigationExtras.queryParams, project: this.project};
    const url = this.router.createUrlTree(commands, navigationExtras).toString();
    if (environment.production) {
      open(`${remoteHost}/static/ng-cad2${url}`);
    } else {
      open(url);
    }
  }

  async updateZhewanLengths() {
    if (this._isZhewanLengthsFetched) {
      return;
    }
    const data = await this.http.getData<[number, number]>("ngcad/getZhewan");
    if (data) {
      this.zhewanLengths$.next(data);
      this._isZhewanLengthsFetched = true;
    }
  }

  exportSelected() {
    const entities = this.cad.selected();
    const data = new CadData();
    data.entities = entities;
    return exportCadData(data).entities;
  }

  exportCadData() {
    return exportCadData(this.cad.data);
  }

  getItemSize(item: any, options?: FileSizeOptions) {
    if (isTypeOf(item, "undefined")) {
      return getFileSize(0, options);
    }
    if (isTypeOf(item, "string")) {
      return getFileSize(item.length, options);
    }
    const num = JSON.stringify(item).length;
    return getFileSize(num, options);
  }

  getCadSize(options?: FileSizeOptions) {
    return this.getItemSize(this.exportCadData(), options);
  }

  getSelectedSize(options?: FileSizeOptions) {
    return this.getItemSize(this.exportSelected(), options);
  }

  changeProject(project: string, clearParams?: boolean) {
    const {url} = this.route.snapshot;
    const opts: UrlCreationOptions = {};
    if (!project) {
      project = this.project;
    }
    this.changeProject$.next(project);
    setTimeout(() => {
      opts.queryParams = {project};
      if (!clearParams) {
        opts.queryParamsHandling = "merge";
      }
      const url2 = this.router.createUrlTree(url, opts);
      location.href = document.baseURI + url2.toString().slice(1);
    }, 0);
  }

  cad数据要求List: Cad数据要求[] = [];
  isCad数据要求ListFetched = false;
  async fetchCad数据要求List(forced?: boolean) {
    if (!forced && this.isCad数据要求ListFetched) {
      return;
    }
    const cad数据要求Raws = await this.http.queryMySql<Cad数据要求Raw>({table: "p_tongyongcadshujujiemianyaoqiu"});
    this.cad数据要求List = cad数据要求Raws.map((v) => new Cad数据要求(v));
    this.isCad数据要求ListFetched = true;
  }
  getCad数据要求(name: string) {
    let result = this.cad数据要求List.find((v) => v.CAD分类 === name);
    if (!result) {
      result = this.cad数据要求List.find((v) => v.CAD分类 === "配件库");
    }
    return result;
  }

  checkEnvBeta() {
    if (!environment.production) {
      return;
    }
    const testMode = this.config.getConfig("testMode");
    const masterPath = "ng-cad2";
    const nextPath = "ng-cad2-beta";
    const masterReg = new RegExp(`/${masterPath}/`);
    const nextReg = new RegExp(`/${nextPath}/`);
    const url = location.href;
    if (masterReg.test(url) && testMode) {
      location.href = url.replace(masterReg, `/${nextPath}/`);
    } else if (nextReg.test(url) && !testMode) {
      location.href = url.replace(nextReg, `/${masterPath}/`);
    }
  }

  private _gongshiOptions: string[] | null = null;
  private _xuanxiangOptions: string[] | null = null;
  private _isInputOptionsFetched = false;
  async fetchInputOptions() {
    if (this._isInputOptionsFetched) {
      return;
    }
    const result = await this.http.getData<ObjectOf<string[]>>("shuju/api/getInputNames", {spinner: false});
    if (!result || !isTypeOf(result, "object")) {
      return;
    }
    this._gongshiOptions = result.公式;
    this._xuanxiangOptions = result.选项;
    this._isInputOptionsFetched = true;
  }
  getGongshiOptions(gongshis: 算料公式[] | null | undefined) {
    const result = new Set<string>(this._gongshiOptions);
    for (const gongshi of gongshis || []) {
      for (const key in gongshi.公式 || {}) {
        result.add(key);
      }
    }
    return Array.from(result);
  }
  getXuanxiangOptions() {
    return this._xuanxiangOptions || [];
  }
}
