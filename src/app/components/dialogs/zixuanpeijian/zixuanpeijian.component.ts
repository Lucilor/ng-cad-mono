import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray} from "@angular/cdk/drag-drop";
import {NestedTreeControl} from "@angular/cdk/tree";
import {KeyValuePipe, NgTemplateOutlet} from "@angular/common";
import {Component, ElementRef, HostBinding, HostListener, Inject, OnInit, ViewChild} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule, MatMenuTrigger} from "@angular/material/menu";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatTreeModule, MatTreeNestedDataSource} from "@angular/material/tree";
import {getNameWithSuffix, imgCadEmpty, remoteFilePath, session, setGlobal} from "@app/app.common";
import {setCadData} from "@app/cad/cad-shujuyaoqiu";
import {CadCollection} from "@app/cad/collections";
import {setDimensionText, uploadAndReplaceCad} from "@app/cad/utils";
import {CadItemComponent} from "@app/components/lurushuju/cad-item/cad-item.component";
import {CadItemButton} from "@app/components/lurushuju/cad-item/cad-item.types";
import {getCadInfoInputs2} from "@app/modules/cad-editor/components/menu/cad-info/cad-info.utils";
import {getHoutaiCad} from "@app/modules/http/services/cad-data.service.utils";
import {convertOptions} from "@app/modules/input/components/input.utils";
import {toFixed} from "@app/utils/func";
import {openExportPage} from "@app/views/export/export.utils";
import {ImportCache} from "@app/views/import/import.types";
import {openImportPage} from "@app/views/import/import.utils";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {Debounce} from "@decorators/debounce";
import {environment} from "@env";
import {CadData, CadLine, CadLineLike, CadMtext, CadViewer, CadViewerConfig, setLinesLength} from "@lucilor/cad-viewer";
import {getElementVisiblePercentage, ObjectOf, queryStringList, timeout} from "@lucilor/utils";
import {ContextMenu} from "@mixins/context-menu.mixin";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {BancaiList} from "@modules/http/services/cad-data.service.types";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService} from "@services/app-status.service";
import {CalcService} from "@services/calc.service";
import {cloneDeep, debounce, uniq, uniqueId} from "lodash";
import {NgScrollbar} from "ngx-scrollbar";
import {BehaviorSubject} from "rxjs";
import {ClickStopPropagationDirective} from "../../../modules/directives/click-stop-propagation.directive";
import {TypedTemplateDirective} from "../../../modules/directives/typed-template.directive";
import {ImageComponent} from "../../../modules/image/components/image/image.component";
import {InputComponent} from "../../../modules/input/components/input.component";
import {SpinnerComponent} from "../../../modules/spinner/components/spinner/spinner.component";
import {openBancaiListDialog} from "../bancai-list/bancai-list.component";
import {openCadEditorDialog} from "../cad-editor-dialog/cad-editor-dialog.component";
import {getOpenDialogFunc} from "../dialog.common";
import {openKlcsDialog} from "../klcs-dialog/klcs-dialog.component";
import {openKlkwpzDialog} from "../klkwpz-dialog/klkwpz-dialog.component";
import {
  CadItemContext,
  CadItemInputInfo,
  LingsanCadItemInfo,
  LingsanTypesData,
  MokuaiInputInfos,
  Step1Data,
  TypesMapNode,
  ZixuanpeijianCadItem,
  ZixuanpeijianInfo,
  ZixuanpeijianInput,
  ZixuanpeijianlingsanCadItem,
  ZixuanpeijianMokuaiItem,
  ZixuanpeijianOutput,
  ZixuanpeijianTypesInfo2
} from "./zixuanpeijian.types";
import {
  calcZxpj,
  getDefaultZhankai,
  getMokuaiTitle,
  getStep1Data,
  getZixuanpeijianCads,
  importZixuanpeijian,
  step3FetchData,
  updateMokuaiItems
} from "./zixuanpeijian.utils";

@Component({
  selector: "app-zixuanpeijian",
  templateUrl: "./zixuanpeijian.component.html",
  styleUrls: ["./zixuanpeijian.component.scss"],
  standalone: true,
  imports: [
    CadImageComponent,
    CadItemComponent,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    ClickStopPropagationDirective,
    ImageComponent,
    InputComponent,
    KeyValuePipe,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatTreeModule,
    NgScrollbar,
    NgTemplateOutlet,
    SpinnerComponent,
    TypedTemplateDirective
  ]
})
export class ZixuanpeijianComponent extends ContextMenu() implements OnInit {
  @HostBinding("class") class = "ng-page";

  spinnerId = "zixuanpeijian-" + uniqueId();
  step$ = new BehaviorSubject<{value: number; refresh: boolean; noCache?: boolean; preserveImgs?: boolean}>({value: 0, refresh: false});
  type1 = "";
  type2 = "";
  urlPrefix = remoteFilePath;
  typesInfo: ZixuanpeijianTypesInfo2 = {};
  typesInfoType1: ObjectOf<{hidden: boolean}> = {};
  options: ObjectOf<string[]> = {};
  bancaiList: BancaiList[] = [];
  result: ZixuanpeijianOutput = importZixuanpeijian();
  cadViewers: {模块: ObjectOf<ObjectOf<CadViewer[]>>; 零散: CadViewer[]} = {模块: {}, 零散: []};
  getMokuaiTitle = getMokuaiTitle;
  @ViewChild(MatMenuTrigger) contextMenu!: MatMenuTrigger;
  @ViewChild("lingsanTypesScrollbar") lingsanTypesScrollbar?: NgScrollbar;
  @ViewChild("lingsanTypesTree", {read: ElementRef}) lingsanTypesTreeEl?: ElementRef<HTMLElement>;
  @ViewChild("lingsanLeftScrollbar") lingsanLeftScrollbar?: NgScrollbar;
  @ViewChild("lingsanRightScrollbar") lingsanRightScrollbar?: NgScrollbar;
  contextMenuData = {i: -1, j: -1};
  fractionDigits = 1;
  _step1Fetched = false;
  _step2Fetched = false;
  _step3Fetched = false;
  cadItemType!: CadItemContext;
  production = environment.production;

  collection: CadCollection = "cad";
  mokuaiInputInfos: MokuaiInputInfos[] = [];
  lingsanInputInfos: CadItemInputInfo[] = [];
  dropDownOptions: {label: string; value: string; customClass?: string}[] = [];
  lingsanCads: ObjectOf<ZixuanpeijianlingsanCadItem[] | undefined> = {};
  lingsanCadType = "";
  lingsanTypesTables: LingsanTypesData["tables"] = [];
  lingsanTypesDataSource = new MatTreeNestedDataSource<TypesMapNode>();
  lingsanTypesTreeControl = new NestedTreeControl<TypesMapNode>((node) => node.children);
  lingsanTypesEditMode = false;
  lingsanTypesShowCount = true;
  hasChild = (_: number, node: TypesMapNode) => !!node.children && node.children.length > 0;
  searchLingsanValueKey = "zixuanpeijian-searchLingsanValue";
  searchLingsanValue = session.load<string>(this.searchLingsanValueKey) || "";
  lingsanCadsSearchInput: InputInfo = {
    type: "string",
    label: "搜索",
    clearable: true,
    model: {data: this, key: "searchLingsanValue"},
    onInput: debounce(this.filterLingsanItems.bind(this), 200)
  };
  searchLingsanTypeKey = "zixuanpeijian-searchLingsanType";
  searchLingsanType = session.load<string>(this.searchLingsanTypeKey) || "";
  lingsanTypesSearchInput: InputInfo = {
    type: "string",
    label: "搜索",
    clearable: true,
    model: {data: this, key: "searchLingsanType"},
    onInput: debounce(this.filterLingsanTypes.bind(this), 200),
    style: {width: "100px"}
  };
  lingsanCadViewers: CadViewer[] = [];
  imgCadEmpty = imgCadEmpty;
  selectAllForm = {baicai: "", cailiao: "", houdu: ""};
  searchMokuaiValueKey = "zixuanpeijian-searchMokuaiValue";
  searchMokuaiValue = session.load(this.searchMokuaiValueKey) || "";
  searchMokuaiInputInfo: InputInfo = {
    type: "string",
    label: "搜索",
    clearable: true,
    model: {data: this, key: "searchMokuaiValue"},
    onInput: debounce(this.filterMokuaiItems.bind(this), 200)
  };
  downloadApi = this.http.getUrl("ngcad/downloadFile");
  lingsanCadItemButtons: CadItemButton<LingsanCadItemInfo>[];
  multiDeleting = false;

  get summitBtnText() {
    if (this.data?.stepFixed) {
      return "提交";
    }
    switch (this.step$.value.value) {
      case 1:
        return "打开算料CAD";
      case 2:
        return "提交保存";
      default:
        return "提交";
    }
  }

  get materialResult() {
    return this.data?.order?.materialResult;
  }

  constructor(
    public dialogRef: MatDialogRef<ZixuanpeijianComponent, ZixuanpeijianOutput>,
    @Inject(MAT_DIALOG_DATA) public data: ZixuanpeijianInput | null,
    private http: CadDataService,
    private message: MessageService,
    private dialog: MatDialog,
    private elRef: ElementRef<HTMLElement>,
    private calc: CalcService,
    private status: AppStatusService
  ) {
    super();
    this.lingsanCadItemButtons = [
      {name: "复制", onClick: this.copyLingsanCad.bind(this)},
      {name: "删除", onClick: this.deleteLingsanCad.bind(this)}
    ];
  }

  async ngOnInit() {
    setGlobal("zxpj", this);
    await timeout(0);
    this.step$.subscribe(this._onStep.bind(this));
    let stepValue = 1;
    if (this.data) {
      const {step, data} = this.data;
      if (data) {
        this.result = cloneDeep(importZixuanpeijian(data));
      }
      if (typeof step === "number") {
        stepValue = step;
      }
    }
    this._updateInputInfos();
    this.setStep(stepValue, true);
  }

  async step1Fetch(updateInputInfos = true) {
    let step1Data: Step1Data | undefined | null;
    if (this.data?.step1Data) {
      step1Data = this.data.step1Data;
    } else {
      const {code, type} = this.data?.order || {};
      if (code && type) {
        step1Data = await getStep1Data(this.http, {spinner: this.spinnerId}, {code, type});
      }
    }
    if (step1Data) {
      this.typesInfo = step1Data.typesInfo;
      this.options = step1Data.options;
      updateMokuaiItems(this.result.模块, step1Data.typesInfo);
    } else {
      this.typesInfo = {};
      this.options = {};
    }
    if (updateInputInfos) {
      this._updateInputInfos();
    }
    this._step1Fetched = true;
  }

  async step2Fetch(updateInputInfos = true) {
    const typesInfo: ObjectOf<ObjectOf<1>> = {};
    this.result.模块.forEach(({type1, type2}) => {
      if (!typesInfo[type1]) {
        typesInfo[type1] = {};
      }
      if (!typesInfo[type1][type2]) {
        typesInfo[type1][type2] = 1;
      }
    });
    const zxpjCads = await getZixuanpeijianCads(this.http, {spinner: this.spinnerId}, typesInfo, this.materialResult);
    if (zxpjCads) {
      const {cads, bancais} = zxpjCads;
      this.bancaiList = bancais;
      const cadViewers = this.cadViewers;
      for (const type1 in cadViewers.模块) {
        for (const type2 in cadViewers.模块[type1]) {
          cadViewers.模块[type1][type2].forEach((v) => v.destroy());
        }
      }
      cadViewers.模块 = {};
      for (const v of cadViewers.零散) {
        v.destroy();
      }
      cadViewers.零散 = [];
      const initCadViewer = (data: CadData, selector: string, type: CadItemContext["type"]) => {
        const data2 = data.clone(true);
        this._configCad(data2);
        data2.entities.mtext = data2.entities.mtext.filter((e) => !e.info.isZhankaiText);

        const config: Partial<CadViewerConfig> = {
          entityDraggable: ["MTEXT"],
          selectMode: "single",
          backgroundColor: "black"
        };
        if (type === "模块") {
          config.entityDraggable = false;
          config.selectMode = "none";
        }
        const viewer = new CadViewer(data2, config);
        if (this.data?.cadConfig) {
          viewer.setConfig(this.data.cadConfig);
        }
        (async () => {
          await viewer.render();
          if (type !== "模块") {
            viewer.on("entitydblclick", async (_, entity) => {
              if (entity instanceof CadMtext) {
                const parent = entity.parent;
                if (!entity.info.isLengthText || !(parent instanceof CadLine)) {
                  return;
                }
                if (parent.gongshi) {
                  if (!(await this.message.confirm("该线已有公式，是否覆盖？"))) {
                    return;
                  }
                }
                const lineLength = await this.message.prompt(
                  {value: Number(entity.text), type: "number", label: "线长"},
                  {title: "修改线长"}
                );
                if (lineLength === null) {
                  return;
                }
                setLinesLength(data2, [parent], lineLength);
                parent.gongshi = "";
                await this._calc();
                await viewer.render();
                viewer.center();
              } else if (entity instanceof CadLineLike) {
                const name = await this.message.prompt({value: entity.mingzi, type: "string", label: "线名字"}, {title: "修改线名字"});
                if (name) {
                  entity.mingzi = name;
                  await viewer.render();
                }
              }
            });
          }

          await timeout(0);
          const el = this.elRef.nativeElement.querySelector(selector);
          if (el instanceof HTMLElement) {
            viewer.appendTo(el);
            // this.resizeCadViewers([i, length - 1]);
          }
        })();
        return {data2, viewer};
      };
      for (const [i, item] of this.result.模块.entries()) {
        const {type1, type2} = item;
        const cads1 = cads[type1]?.[type2] || [];
        const cads2: CadData[] = [];
        const infos: ObjectOf<ZixuanpeijianInfo> = {};
        for (const {info} of item.cads) {
          const found = cads1.find((v) => v.id === info.houtaiId);
          if (found) {
            cads2.push(found);
            infos[found.id] = info;
          }
        }
        const toAdd: CadData[] = [];
        for (const cad of cads1) {
          const found = cads2.find((v) => {
            const info = infos[v.id];
            return info && info.houtaiId === cad.id;
          });
          if (!found) {
            toAdd.push(cad);
          }
        }
        cads2.push(...toAdd);
        item.cads = [];

        cads2.forEach(async (data, j) => {
          let info: ZixuanpeijianInfo | undefined = infos[data.id];
          if (!info) {
            info = {houtaiId: data.id, zhankai: [], calcZhankai: []};
          }
          const cadItem: ZixuanpeijianCadItem = {data, info};
          item.cads.push(cadItem);
          const {data2, viewer} = initCadViewer(data, `#cad-viewer-模块-${i}-${j}`, "模块");
          cadItem.data = data2;

          if (!cadViewers.模块[type1]) {
            cadViewers.模块[type1] = {};
          }
          if (!cadViewers.模块[type1][type2]) {
            cadViewers.模块[type1][type2] = [];
          }
          cadViewers.模块[type1][type2].push(viewer);
        });
      }
      for (const [i, item] of this.result.零散.entries()) {
        const {data2, viewer} = initCadViewer(item.data, `#cad-viewer-零散-${i}-0`, "零散");
        item.data = data2;
        cadViewers.零散.push(viewer);
      }
    }
    if (await this._calc()) {
      setTimeout(async () => {
        for (const type1 in this.cadViewers.模块) {
          for (const type2 in this.cadViewers.模块[type1]) {
            const cadViewers = this.cadViewers.模块[type1][type2];
            for (const cadViewer of cadViewers) {
              await cadViewer.render();
              await cadViewer.render(cadViewer.data.entities.dimension);
              cadViewer.center();
            }
          }
        }
        for (const cadViewer of this.cadViewers.零散) {
          await cadViewer.render();
          await cadViewer.render(cadViewer.data.entities.dimension);
          cadViewer.center();
        }
      }, 0);
    }
    if (updateInputInfos) {
      this._updateInputInfos();
    }
    this._step2Fetched = true;
  }

  async step3Fetch(noUpdateInputInfos = false, noCache = false, preserveImgs = false) {
    const lingsanOptions = this.data?.lingsanOptions;
    const responseData = await step3FetchData(this.http, lingsanOptions, noCache);
    if (responseData) {
      if (!preserveImgs) {
        this.lingsanCadImgs = {};
      }
      this.lingsanCadInfos = [];
      this.lingsanCads = {};
      for (const v of responseData.cads) {
        const data = new CadData(v);
        const item: ZixuanpeijianlingsanCadItem = {data, hidden: false, isFetched: false};
        const type = item.data.type;
        if (!this.lingsanCads[type]) {
          this.lingsanCads[type] = [];
        }
        this.lingsanCads[type]?.push(item);
      }
      const responseData2 = await this.http.getData<LingsanTypesData>("ngcad/getLingsanTypes", {
        allTypes: Object.keys(this.lingsanCads),
        ...lingsanOptions
      });
      this.lingsanTypesTables = responseData2?.tables || [];
      this.lingsanTypesDataSource.data = responseData2?.typesMap || [];
      const {noValidateCads} = this.data || {};
      const toRemove: number[] = [];
      for (const [i, item] of this.result.零散.entries()) {
        let found: ZixuanpeijianlingsanCadItem | undefined;
        if (!noValidateCads) {
          for (const type in this.lingsanCads) {
            found = this.lingsanCads[type]?.find((v) => v.data.id === item.info.houtaiId);
            if (found) {
              break;
            }
          }
        }
        if (found) {
          item.data = found.data;
        } else {
          if (noValidateCads) {
            if (!preserveImgs) {
              // TODO
            }
          } else {
            toRemove.push(i);
          }
        }
      }
      if (toRemove.length > 0) {
        this.result.零散 = this.result.零散.filter((_, i) => !toRemove.includes(i));
      }
    }
    if (noUpdateInputInfos) {
      this._updateInputInfos();
    }
    this.status.fetchCad数据要求List();
    this._step3Fetched = true;
    this.filterLingsanItems();
  }

  step3Refresh(preserveImgs = false, noCache = true) {
    this.step$.next({value: 3, refresh: true, noCache, preserveImgs});
  }

  getLingsanYaoqiu() {
    return this.status.getCad数据要求(this.lingsanCadType || "分类为空");
  }

  async step3Add() {
    const yaoqiu = this.getLingsanYaoqiu();
    const cadData = new CadData({type: this.lingsanCadType});
    const yaoqiuItems = yaoqiu?.新建CAD要求 || [];
    const yaoqiuItems2 = yaoqiu?.选中CAD要求 || [];
    setCadData(cadData, yaoqiuItems);
    const form = getCadInfoInputs2(yaoqiuItems, yaoqiuItems2, cadData, this.dialog, this.status, true, this.data?.gongshis);
    const result = await this.message.form<typeof data>(form);
    if (!result) {
      return;
    }
    const {uploadDxf} = cadData.info;
    if (uploadDxf instanceof File) {
      await uploadAndReplaceCad(uploadDxf, cadData, true, this.message, this.http);
    }
    const {xinghao} = this.data?.lingsanOptions || {};
    if (xinghao) {
      cadData.options.型号 = xinghao;
    }
    const data: ObjectOf<any> = getHoutaiCad(cadData);
    delete data._id;
    const {collection} = this;
    const id = await this.http.mongodbInsert(collection, data, {force: !!yaoqiu});
    if (id) {
      if (await this.message.confirm("是否编辑新的CAD？")) {
        const {cads} = await this.http.getCad({collection, id});
        const data = cads[0];
        if (data) {
          const gongshis = this.data?.gongshis;
          await openCadEditorDialog(this.dialog, {data: {data, collection, center: true, gongshis}});
        }
      }
      this.step3Refresh();
    }
  }

  async allFetch() {
    await Promise.all([this.step1Fetch(), this.step3Fetch(true)]);
    await this.step2Fetch();
    this._updateInputInfos();
    await timeout(0);
  }

  private _configCad(data: CadData) {
    data.entities.dimension.forEach((e) => {
      const {显示公式} = setDimensionText(e, {});
      if (显示公式 !== null) {
        e.info.显示公式 = 显示公式;
      } else if (e.mingzi === "<>") {
        e.info.显示公式 = "<>";
      } else if (isNaN(Number(e.mingzi))) {
        e.visible = false;
      }
      e.setStyle({text: {size: 36}});
    });
  }

  resizeCadViewers(indexes?: [number, number]) {
    for (const [i, item] of this.result.模块.entries()) {
      const {type1, type2} = item;
      const cadViewers = this.cadViewers.模块[type1]?.[type2];
      if (cadViewers) {
        for (const [j, cadViewer] of cadViewers.entries()) {
          if (indexes && indexes[0] !== i && indexes[1] !== j) {
            continue;
          }
          const el = cadViewer.dom.parentElement;
          if (!el) {
            continue;
          }
          const {width} = el.getBoundingClientRect();
          cadViewer.resize(width, width / 2);
          cadViewer.center();
        }
      }
    }
  }

  @HostListener("window:resize")
  @Debounce(500)
  onWindowResize() {
    this.resizeCadViewers();
  }

  async openKlkwpzDialog(item: ZixuanpeijianCadItem) {
    const result = await openKlkwpzDialog(this.dialog, {data: {source: item.info.开料孔位配置 || {}, cadId: item.info.houtaiId}});
    if (result) {
      item.info.开料孔位配置 = result;
    }
  }

  async openKlcsDialog(item: ZixuanpeijianCadItem) {
    const result = await openKlcsDialog(this.dialog, {
      data: {
        source: item.info.开料参数 || {_id: "", 名字: item.data.name + "中空参数", 分类: "切中空", 参数: []},
        cadId: item.info.houtaiId
      }
    });
    if (result) {
      item.info.开料参数 = result;
    }
  }

  onContextMenu(event: MouseEvent, i: number, j: number): void {
    super.onContextMenu(event);
    this.contextMenuData.i = i;
    this.contextMenuData.j = j;
  }

  centerCad() {
    const {i, j} = this.contextMenuData;
    const {type1, type2} = this.result.模块[i];
    const cadViewer = this.cadViewers.模块[type1]?.[type2]?.[j];
    if (cadViewer) {
      cadViewer.center();
    }
  }

  private async _onStep({value, refresh, noCache, preserveImgs}: ZixuanpeijianComponent["step$"]["value"]) {
    let isRefreshed = false;
    if (value === 1) {
      if (refresh || !this._step1Fetched) {
        await this.step1Fetch();
        isRefreshed = true;
      }
      if (isRefreshed || !this.type1) {
        this.setTypesInfo1(Object.keys(this.typesInfo)[0] || "");
      }
      this.filterMokuaiItems();
    } else if (value === 2) {
      if (refresh || !this._step2Fetched) {
        await this.step2Fetch();
        isRefreshed = true;
      }
    } else if (value === 3) {
      const scrollTop = this.lingsanLeftScrollbar?.nativeElement.scrollTop;
      const lingsanCadTypePrev = this.lingsanCadType;
      if (refresh || !this._step3Fetched) {
        await this.step3Fetch(false, noCache, preserveImgs);
        isRefreshed = true;
      }
      await timeout(500);
      if (lingsanCadTypePrev === this.lingsanCadType) {
        this.lingsanLeftScrollbar?.scrollTo({top: scrollTop});
      }
    }
  }

  async submit() {
    const {value} = this.step$.value;
    const stepFixed = this.data?.stepFixed;
    if (value === 1) {
      const errors = new Set<string>();
      if (this.data?.checkEmpty) {
        for (const {totalWidth, totalHeight, gongshishuru, xuanxiangshuru, shuruzongkuan, shuruzonggao} of this.result.模块) {
          if (!totalWidth && shuruzongkuan) {
            errors.add("总宽不能为空");
          }
          if (!totalHeight && shuruzonggao) {
            errors.add("总高不能为空");
          }
          if (!gongshishuru.every((v) => v.every(Boolean))) {
            errors.add("公式输入不能为空");
          }
          if (!xuanxiangshuru.every((v) => v.every(Boolean))) {
            errors.add("选项输入不能为空");
          }
        }
      }
      if (errors.size > 0 && this.data?.checkEmpty) {
        this.message.error(Array.from(errors).join("<br>"));
      } else {
        if (stepFixed) {
          this.dialogRef.close(this.result);
        } else {
          this.setStep(2, true);
        }
      }
    } else if (value === 2) {
      const errors = new Set<string>();
      if (this.data?.checkEmpty) {
        for (const {cads} of this.result.模块) {
          for (const {info} of cads) {
            if (info.hidden) {
              continue;
            }
            const bancai = info.bancai;
            if (!bancai || !bancai.cailiao || !bancai.houdu) {
              errors.add("板材没有填写完整");
            }
            for (const {width, height, num} of info.zhankai) {
              if (!width || !height || !num) {
                errors.add("展开没有填写完整");
                break;
              }
              // if (data.zhankai[i]) {
              //     data.zhankai[i].zhankaikuan = width;
              //     data.zhankai[i].zhankaigao = height;
              //     data.zhankai[i].shuliang = num;
              // } else {
              //     data.zhankai[i] = new CadZhankai({zhankaikuan: width, zhankaigao: height, shuliang: num});
              // }
            }
          }
        }
      }
      if (errors.size > 0) {
        this.message.error(Array.from(errors).join("<br>"));
      } else {
        if (await this._calc()) {
          this.dialogRef.close(this.result);
        }
      }
    } else if (value === 3) {
      if (stepFixed) {
        this.dialogRef.close(this.result);
      } else {
        this.setStep(2, true);
      }
    }
  }

  cancel() {
    const stepFixed = this.data?.stepFixed;
    if (this.step$.value.value === 2 || stepFixed) {
      this.dialogRef.close();
    } else {
      this.setStep(2, true);
    }
  }

  setStep(value: number, refresh = false, preserveImgs = false) {
    this.step$.next({value, refresh, preserveImgs});
  }

  setTypesInfo1(type1: string) {
    this.type1 = type1;
  }

  private async _updateInputInfos() {
    this.dropDownOptions.length = 0;
    const vars = this.materialResult || {};

    // const bancaiOptions: InputInfoString["options"] = this.bancaiList.map((v) => v.mingzi);
    const shuchubianliangKeys = new Set<string>();
    const fixedBancaiOptions: string[] = [];
    const bancaiMap: ObjectOf<{cailiao: string[]; houdu: string[]}> = {};
    for (const type1 in this.typesInfo) {
      for (const type2 in this.typesInfo[type1]) {
        const item = this.typesInfo[type1][type2];
        if (item.unique) {
          const item2 = this.result.模块.find((v) => v.type1 === type1 && v.type2 === type2);
          item.disableAdd = !!item2;
        }
      }
    }
    for (const item of this.result.模块) {
      for (const {info} of item.cads) {
        if (info.bancai) {
          const {mingzi, cailiao, houdu} = info.bancai;
          fixedBancaiOptions.push(mingzi);
          if (!bancaiMap[mingzi]) {
            bancaiMap[mingzi] = {cailiao: [], houdu: []};
          }
          if (cailiao && !bancaiMap[mingzi].cailiao.includes(cailiao)) {
            bancaiMap[mingzi].cailiao.push(cailiao);
          }
          if (houdu && !bancaiMap[mingzi].houdu.includes(houdu)) {
            bancaiMap[mingzi].houdu.push(houdu);
          }
        }
      }
      for (const key of item.shuchubianliang) {
        shuchubianliangKeys.add(key);
      }
    }

    const dropDownKeys = new Set<string>(this.data?.dropDownKeys);
    for (const key of shuchubianliangKeys) {
      dropDownKeys.delete(key);
    }
    for (const key of dropDownKeys) {
      const value = Number(vars[key]);
      if (value > 0) {
        this.dropDownOptions.push({label: key, value: String(value)});
      }
    }
    for (const key of shuchubianliangKeys) {
      const value = key in vars ? String(vars[key]) : "";
      this.dropDownOptions.push({label: key, value, customClass: "shuchubianliang"});
    }
    const options = this.dropDownOptions.map((v) => v.label);

    const getCadItemInputInfos = (items: ZixuanpeijianCadItem[], type: CadItemContext["type"]) =>
      items.map<CadItemInputInfo>(({info}) => {
        const {zhankai, bancai} = info;
        let bancaiName = bancai?.mingzi || "";
        if (bancai && bancaiName === "自定义") {
          bancaiName += `: ${bancai.zidingyi || ""}`;
        }
        const zhankaiReadOnly = type === "模块";
        return {
          zhankai: zhankai.map<CadItemInputInfo["zhankai"][0]>((v) => ({
            width: {
              type: "string",
              label: "展开宽",
              options,
              model: {key: "width", data: v},
              readonly: zhankaiReadOnly,
              showEmpty: true
            },
            height: {
              type: "string",
              label: "展开高",
              options,
              model: {key: "height", data: v},
              readonly: zhankaiReadOnly,
              showEmpty: true
            },
            num: {
              type: "string",
              label: "数量",
              model: {key: "num", data: v},
              readonly: zhankaiReadOnly,
              showEmpty: true
            }
          })),
          板材: {
            type: "string",
            label: "板材",
            value: bancaiName,
            showEmpty: true
          },
          材料: {
            type: "select",
            label: "材料",
            options: bancai?.cailiaoList || [],
            model: {key: "cailiao", data: bancai},
            showEmpty: true
          },
          厚度: {
            type: "select",
            label: "厚度",
            options: bancai?.houduList || [],
            model: {key: "houdu", data: bancai},
            showEmpty: true
          }
        };
      });

    const checkEmpty = this.data?.checkEmpty;
    this.mokuaiInputInfos = await Promise.all(
      this.result.模块.map<Promise<MokuaiInputInfos>>(async (item, i) => ({
        总宽: {type: "string", label: "总宽", model: {key: "totalWidth", data: item}, showEmpty: checkEmpty && item.shuruzongkuan, options},
        总高: {type: "string", label: "总高", model: {key: "totalHeight", data: item}, showEmpty: checkEmpty && item.shuruzonggao, options},
        公式输入: (item.gongshishuru || []).map((group) => ({
          type: "string",
          label: group[0],
          model: {key: "1", data: group},
          showEmpty: checkEmpty,
          options,
          onChange: () => {
            const gongshishuru: ObjectOf<string> = {};
            for (const [k, v] of item.gongshishuru) {
              gongshishuru[k] = v;
            }
            if (!item.standalone) {
              for (const [j, item2] of this.result.模块.entries()) {
                if (i === j || item2.standalone) {
                  continue;
                }
                for (const group2 of item2.gongshishuru) {
                  if (group2[0] in gongshishuru) {
                    group2[1] = gongshishuru[group2[0]];
                  }
                }
              }
            }
          }
        })),
        选项输入: (item.xuanxiangshuru || []).map((group) => ({
          type: "select",
          label: group[0],
          model: {key: "1", data: group},
          options: this.options[group[0]] || [],
          showEmpty: checkEmpty,
          onChange: () => {
            const xuanxiangshuru: ObjectOf<string> = {};
            for (const [k, v] of item.xuanxiangshuru) {
              xuanxiangshuru[k] = v;
            }
            if (!item.standalone) {
              for (const [j, item2] of this.result.模块.entries()) {
                if (i === j || item2.standalone) {
                  continue;
                }
                for (const group2 of item2.xuanxiangshuru) {
                  if (group2[0] in xuanxiangshuru) {
                    group2[1] = xuanxiangshuru[group2[0]];
                  }
                }
              }
            }
          }
        })),
        输出文本: await Promise.all(
          (item.shuchuwenben || []).map(async (group) => ({
            type: "string",
            label: group[0],
            value: /#.*#/.test(group[1]) ? String(await this.calc.calcExpression(group[1], this.materialResult)) : group[1],
            readonly: true
          }))
        ),
        cads: getCadItemInputInfos(item.cads, "模块")
      }))
    );
    this.lingsanInputInfos = getCadItemInputInfos(this.result.零散, "零散");
  }

  async addMokuaiItem(type1: string, type2: string) {
    const typesItem = cloneDeep(this.typesInfo[type1][type2]);
    const item: ZixuanpeijianMokuaiItem = {type1, type2, totalWidth: "", totalHeight: "", ...typesItem, cads: []};
    const gongshishuru: ObjectOf<string> = {};
    const xuanxiangshuru: ObjectOf<string> = {};
    for (const item2 of this.result.模块) {
      for (const group of item2.gongshishuru) {
        gongshishuru[group[0]] = group[1];
      }
      for (const group of item2.xuanxiangshuru) {
        xuanxiangshuru[group[0]] = group[1];
      }
    }
    for (const [i, v] of item.gongshishuru.entries()) {
      if (gongshishuru[v[0]]) {
        item.gongshishuru[i][1] = gongshishuru[v[0]];
      }
    }
    for (const [i, v] of item.xuanxiangshuru.entries()) {
      if (xuanxiangshuru[v[0]]) {
        item.xuanxiangshuru[i][1] = xuanxiangshuru[v[0]];
      }
    }
    const formulas = typesItem.suanliaogongshi;
    const vars = this.materialResult || {};
    const result = await this.calc.calcFormulas(formulas, vars);
    if (result) {
      const {succeedTrim} = result;
      for (const group of typesItem.gongshishuru) {
        if (Number(succeedTrim[group[0]]) > 0 && !(group[0] in gongshishuru)) {
          group[1] = toFixed(succeedTrim[group[0]], this.fractionDigits);
        }
      }
      for (const group of typesItem.xuanxiangshuru) {
        if (group[0] in succeedTrim && !(group[0] in xuanxiangshuru)) {
          const value = succeedTrim[group[0]];
          if (typeof value === "number") {
            group[1] = toFixed(value, this.fractionDigits);
          } else {
            group[1] = group[1] || value;
          }
        }
      }
      if (Number(succeedTrim.总宽) > 0) {
        item.totalWidth = toFixed(succeedTrim.总宽, this.fractionDigits);
      }
      if (Number(succeedTrim.总高) > 0) {
        item.totalHeight = toFixed(succeedTrim.总高, this.fractionDigits);
      }
      this.result.模块.push(item);
      await this._updateInputInfos();
    }
  }

  removeMokuaiItem(i: number) {
    this.result.模块.splice(i, 1);
    this._updateInputInfos();
  }

  async addLingsanItem(component: CadItemComponent<LingsanCadItemInfo>) {
    const type = this.lingsanCadType;
    const {index: i} = component.customInfo;
    const {isEditingFenlei, multiDeleting} = this;
    if ((this.data?.readonly && !isEditingFenlei) || multiDeleting) {
      return;
    }
    this.activeLingsanCad(type, i);
    const item = this.lingsanCads[type]?.[i];
    if (!item) {
      return;
    }
    if (isEditingFenlei) {
      if (this.result.零散.find((v) => v.info.houtaiId === item.data.id)) {
        return;
      }
    } else if (!item.isFetched) {
      const data0 = (await this.http.getCad({collection: "cad", id: item.data.id})).cads[0];
      item.isFetched = true;
      if (data0) {
        item.data = data0;
      }
    }
    const data = item.data.clone(!isEditingFenlei);
    data.info.imgId = await this.http.getMongoId();
    const yaoqiu = this.getLingsanYaoqiu();
    const yaoqiuItems = yaoqiu?.选中CAD要求 || [];
    setCadData(data, yaoqiuItems);
    const names = this.result.零散.map((v) => v.data.name);
    data.name = getNameWithSuffix(names, data.name, "_", 1);
    this.result.零散.push({data, info: {houtaiId: item.data.id, zhankai: [], calcZhankai: []}});
    this._updateInputInfos();
    await timeout(0);
    this.lingsanRightScrollbar?.scrollTo({bottom: 0});
  }

  removeLingsanItem(i: number) {
    if (this.data?.readonly && !this.isEditingFenlei) {
      return;
    }
    this.result.零散.splice(i, 1);
    this._updateInputInfos();
  }

  activeLingsanCad(type: string, i: number) {
    for (const [j, item] of this.lingsanCads[type]?.entries() || []) {
      item.active = i === j;
    }
  }

  getZhankaiArr(type: CadItemContext["type"], i: number, j: number) {
    return type === "模块" ? this.result.模块[i].cads[j].info.zhankai : this.result.零散[i].info.zhankai;
  }

  addZhankai(type: CadItemContext["type"], i: number, j: number, k: number) {
    const arr = this.getZhankaiArr(type, i, j);
    arr.splice(k + 1, 0, getDefaultZhankai());
    this._updateInputInfos();
  }

  removeZhankai(type: CadItemContext["type"], i: number, j: number, k: number) {
    const arr = this.getZhankaiArr(type, i, j);
    arr.splice(k, 1);
    this._updateInputInfos();
  }

  private async _calc() {
    const {模块, 零散} = this.result;
    const calcResult = await calcZxpj(this.dialog, this.message, this.calc, this.materialResult || {}, 模块, 零散, {
      fractionDigits: this.fractionDigits
    });
    this._updateInputInfos();
    return calcResult;
  }

  // TODO: isLocal
  async openCad(item: ZixuanpeijianCadItem, isMuban: boolean, isLocal: boolean) {
    let data: CadData | undefined;
    let collection: CadCollection | undefined;
    if (isMuban) {
      collection = "kailiaocadmuban";
      const id = this.getMubanId(item.data);
      const {cads} = await this.http.getCad({collection, id});
      if (cads.length > 0) {
        data = cads[0];
      } else {
        return;
      }
    } else {
      collection = "cad";
      if (isLocal) {
        data = item.data;
      } else {
        const id = item.info.houtaiId;
        const {cads} = await this.http.getCad({collection, id});
        if (cads.length > 0) {
          data = cads[0];
        } else {
          return;
        }
      }
    }
    const gongshis = this.data?.gongshis;
    const result = await openCadEditorDialog(this.dialog, {data: {data, collection, isLocal, center: true, gongshis}});
    if (result?.isSaved) {
      await this.allFetch();
    }
  }

  filterMokuaiItems() {
    const needle = this.searchMokuaiValue;
    for (const type1 in this.typesInfo) {
      let count = 0;
      for (const type2 in this.typesInfo[type1]) {
        const item = this.typesInfo[type1][type2];
        item.hidden = !queryStringList(needle, [type1, type2]);
        if (!item.hidden) {
          count++;
        }
      }
      if (type1 in this.typesInfoType1) {
        this.typesInfoType1[type1].hidden = count < 1;
      } else {
        this.typesInfoType1[type1] = {hidden: count < 1};
      }
    }
    session.save(this.searchMokuaiValueKey, needle);
  }

  filterLingsanItems() {
    const needle = this.searchLingsanValue;
    this.lingsanTypesHideEmpty = !!needle;
    const counts: ObjectOf<number> = {};
    for (const type in this.lingsanCads) {
      let count = 0;
      for (const item of this.lingsanCads[type] || []) {
        item.hidden = !queryStringList(needle, [item.data.name, item.data.type2]);
        if (!item.hidden) {
          count++;
        }
      }
      counts[type] = count;
    }
    let currNode: TypesMapNode | undefined;
    let firstVisibleNode: TypesMapNode | undefined;
    const setCount = (node: TypesMapNode) => {
      let count = 0;
      if (node.children.length > 0) {
        for (const child of node.children) {
          setCount(child);
          count += child.cadCount || 0;
        }
      } else if (node.name in counts) {
        count = counts[node.name];
      }
      node.cadCount = count;
      if (this.lingsanTypesHideEmpty) {
        node.hidden = count < 1;
      } else {
        node.hidden = false;
      }
      if (node.name === this.lingsanCadType) {
        currNode = node;
      }
      if (!firstVisibleNode && !node.hidden) {
        firstVisibleNode = node;
      }
    };
    const nodes = this.lingsanTypesDataSource.data.slice();
    for (const node of nodes) {
      setCount(node);
    }
    this.lingsanTypesDataSource.data = nodes;
    session.save(this.searchLingsanValueKey, needle);
    if (currNode && !currNode.hidden) {
      this.setLingsanCadType(currNode.name);
    } else if (firstVisibleNode) {
      this.setLingsanCadType(firstVisibleNode.name);
    }
  }
  filterLingsanTypes() {
    const needle = this.searchLingsanType;
    const search = (nodes: TypesMapNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          search(node.children);
          node.hidden2 = node.children.every((v) => v.hidden2);
        } else {
          node.hidden2 = !queryStringList(needle, [node.name, node.label || ""]);
        }
      }
    };
    search(this.lingsanTypesDataSource.data);
  }

  returnZero() {
    return 0;
  }

  async setLingsanCadType(type: string) {
    this.lingsanCadType = type;
    await timeout(0);
    const treeEl = this.lingsanTypesTreeEl?.nativeElement;
    const getPath = (nodes: TypesMapNode[], path: TypesMapNode[] = []): TypesMapNode[] => {
      for (const node of nodes) {
        if (node.name === type) {
          return [...path, node];
        }
        if (node.children.length > 0) {
          const path2 = getPath(node.children, [...path, node]);
          if (path2.length > path.length + 1) {
            return path2;
          }
        }
      }
      return path;
    };
    const path = getPath(this.lingsanTypesDataSource.data);
    for (const [i, node] of path.entries()) {
      this.lingsanTypesTreeControl.expand(node);
      if (i === path.length - 1) {
        const nodeEl = treeEl?.querySelector(`[data-id="${node.id}"]`);
        if (nodeEl instanceof HTMLElement && getElementVisiblePercentage(nodeEl) < 1) {
          this.lingsanTypesScrollbar?.scrollToElement(nodeEl);
        }
      }
    }
  }
  async getLingsanCadTypeItem(data?: {mingzi: string; paixu?: number; [x: string]: any}, table?: LingsanTypesData["tables"][number]) {
    if (!data) {
      data = {mingzi: ""};
    }
    const form: InputInfo[] = [
      {type: "string", label: "名字", model: {data, key: "mingzi"}, validators: Validators.required},
      {type: "number", label: "排序", model: {data, key: "paixu"}}
    ];
    if (table?.column?.guanlianTable) {
      const {field, ch, guanlianTable} = table.column;
      const optionsRaw = (await this.http.getOptions({name: guanlianTable}))?.data || [];
      const options = convertOptions(optionsRaw);
      const ids: number[] = data[field].split("*").map(Number);
      const names = ids.map((id) => optionsRaw.find((v) => v.vid === id)?.name || "");
      form.push({
        type: "select",
        label: ch,
        options,
        multiple: true,
        optionsDialog: {
          useLocalOptions: true,
          noImage: true,
          openInNewTab: true,
          onChange: (val) => {
            data[field] = val.options.map((v) => v.vid).join("*");
          }
        },
        value: names
      });
    }
    const result = await this.message.form(form);
    if (result) {
      return data;
    }
    return null;
  }
  isVirtualNode(node: TypesMapNode) {
    return node.id <= 0;
  }
  async isVirtualNode2(node: TypesMapNode) {
    if (this.isVirtualNode(node)) {
      await this.message.error(`【${node.name}】是自动生成的，不能进行操作`);
      return true;
    }
    return false;
  }
  async addLingsanCadType(node?: TypesMapNode) {
    if (node && (await this.isVirtualNode2(node))) {
      return;
    }
    const level = node ? node.level : 0;
    const table = this.lingsanTypesTables[level];
    const table2 = node ? this.lingsanTypesTables[level + 1] : table;
    if (!table2) {
      await this.message.error(`没有对应层级的信息，必须先手动关联一个【${level + 2}】级分类`);
      return;
    }
    const data = await this.getLingsanCadTypeItem();
    if (!data) {
      return;
    }
    const record = await this.http.tableInsert({table: table2.name, data});
    if (node && record && table.column) {
      const ids = node.children.map((v) => v.id);
      ids.push(record.vid);
      await this.http.tableUpdate({table: table.name, data: {vid: node.id, [table.column.field]: ids.join("*")}});
    }
    this.step3Refresh(true, false);
  }
  async editLingsanCadType(node: TypesMapNode) {
    if (await this.isVirtualNode2(node)) {
      return;
    }
    const table = this.lingsanTypesTables[node.level];
    if (!table) {
      await this.message.error(`没有对应层级的信息`);
      return;
    }
    const fields = ["vid", "mingzi"];
    if (table.column) {
      fields.push(table.column.field);
    }
    const records = await this.http.queryMySql({table: table.name, filter: {where: {vid: node.id}}, fields});
    const data0 = records[0];
    const data = await this.getLingsanCadTypeItem(data0, table);
    if (!data) {
      return;
    }
    await this.http.tableUpdate({table: table.name, data: {vid: node.id, ...data}});
    this.step3Refresh(true, false);
  }
  async removeLingsanCadType(node: TypesMapNode) {
    if (await this.isVirtualNode2(node)) {
      return;
    }
    if (node.children.length > 0) {
      await this.message.error(`【${node.name}】下面有子节点，不能删除`);
      return;
    }
    if (!(await this.message.confirm(`是否确定删除【${node.name}】?`))) {
      return;
    }
    const table = this.lingsanTypesTables[node.level];
    if (!table) {
      await this.message.error(`没有对应层级的信息`);
      return;
    }
    await this.http.tableDelete({table: table.name, vids: [node.id]});
    this.step3Refresh(true, false);
  }
  toggleLingsanTypesHideEmpty() {
    this.lingsanTypesHideEmpty = !this.lingsanTypesHideEmpty;
    this.filterLingsanItems();
  }

  private _setInfoBancai(info: ZixuanpeijianInfo, bancai: BancaiList) {
    if (info.bancai) {
      info.bancai = {...info.bancai, ...bancai};
      const {cailiaoList, cailiao, houduList, houdu} = info.bancai;
      if (cailiao && !cailiaoList.includes(cailiao)) {
        delete info.bancai.cailiao;
      }
      if (houdu && !houduList.includes(houdu)) {
        delete info.bancai.houdu;
      }
    } else {
      info.bancai = bancai;
    }
  }

  async openBancaiListDialog(info: ZixuanpeijianInfo) {
    const bancai = await openBancaiListDialog(this.dialog, {data: {list: this.bancaiList, checkedItems: info.bancai ? [info.bancai] : []}});
    if (!bancai?.[0]) {
      return;
    }
    this._setInfoBancai(info, bancai[0]);
    this._updateInputInfos();
  }

  private _getCurrBancaiName() {
    const bancais = this.result.模块.flatMap((v) => v.cads.map((vv) => vv.info.bancai)).concat(this.result.零散.map((v) => v.info.bancai));
    const bancaisNotEmpty = bancais.filter((v) => v) as BancaiList[];
    if (bancaisNotEmpty.length < bancais.length) {
      return null;
    }
    const bancaiNames = uniq(bancaisNotEmpty.map((v) => v.mingzi));
    if (bancaiNames.length > 1) {
      return null;
    }
    return bancaiNames.length === 1 ? bancaiNames[0] : "";
  }

  private _getCurrBancais() {
    const bancais = this.result.模块.flatMap((v) => v.cads.map((vv) => vv.info.bancai)).concat(this.result.零散.map((v) => v.info.bancai));
    const bancaisNotEmpty = bancais.filter((v) => v) as BancaiList[];
    const names = uniq(bancaisNotEmpty.map((v) => v.mingzi));
    return this.bancaiList.filter((v) => names.includes(v.mingzi));
  }

  async selectAllBancai() {
    const bancaiName = this._getCurrBancaiName();
    const bancaiPrev = this.bancaiList.find((v) => v.mingzi === bancaiName);
    const bancai = await openBancaiListDialog(this.dialog, {
      data: {list: this.bancaiList, checkedItems: bancaiPrev ? [bancaiPrev] : []}
    });
    if (!bancai?.[0]) {
      return;
    }
    for (const item of this.result.模块) {
      for (const {info} of item.cads) {
        this._setInfoBancai(info, bancai[0]);
      }
    }
    for (const {info} of this.result.零散) {
      this._setInfoBancai(info, bancai[0]);
    }
    this._updateInputInfos();
  }

  async selectAllCailiao() {
    const bancais = this._getCurrBancais();
    const cailiaoList = uniq(bancais.flatMap((v) => v.cailiaoList));
    const result = await this.message.button({buttons: cailiaoList});
    if (result && cailiaoList.includes(result)) {
      const setItems = (items: ZixuanpeijianCadItem[]) => {
        for (const {info} of items) {
          if (info.bancai && info.bancai.cailiaoList.includes(result)) {
            info.bancai.cailiao = result;
          }
        }
      };
      for (const item of this.result.模块) {
        setItems(item.cads);
      }
      setItems(this.result.零散);
    }
  }

  async selectAllHoudu() {
    const bancais = this._getCurrBancais();
    const houduList = uniq(bancais.flatMap((v) => v.houduList));
    const result = await this.message.button({buttons: houduList});
    if (result && houduList.includes(result)) {
      const setItems = (items: ZixuanpeijianCadItem[]) => {
        for (const {info} of items) {
          if (info.bancai && info.bancai.houduList.includes(result)) {
            info.bancai.houdu = result;
          }
        }
      };
      for (const item of this.result.模块) {
        setItems(item.cads);
      }
      setItems(this.result.零散);
    }
  }

  dropMokuaiItem(event: CdkDragDrop<ZixuanpeijianMokuaiItem[]>) {
    moveItemInArray(this.result.模块, event.previousIndex, event.currentIndex);
    this._updateInputInfos();
  }

  async openMokuaiUrl() {
    const ids = this.result.模块.map((v) => v.type2);
    if (ids.some((v) => !v)) {
      this.message.error("当前配件模块数据是旧数据，请刷新数据");
      return;
    }
    const url = await this.http.getShortUrl("配件模块", {search2: {where_in: {vid: ids}}}, {spinner: this.spinnerId});
    if (url) {
      // this.message.iframe(this.mokuaiUrl);
      open(url, "_blank");
    }
  }

  getMubanId(data: CadData) {
    return data.zhankai[0]?.kailiaomuban;
  }

  async setReplaceableMokuais(item: ZixuanpeijianMokuaiItem) {
    const typesInfo = cloneDeep(this.typesInfo);
    delete typesInfo[item.type1][item.type2];
    const result = await openZixuanpeijianDialog(this.dialog, {
      data: {
        step: 1,
        stepFixed: true,
        checkEmpty: this.data?.checkEmpty,
        data: {模块: item.可替换模块},
        可替换模块: false,
        step1Data: {typesInfo, options: this.options}
      }
    });
    if (result) {
      item.可替换模块 = result.模块;
    }
  }

  getCadYaoqiu() {
    return this.status.getCad数据要求(this.lingsanCadType);
  }

  async openImportPage(searchYaoqiu: boolean) {
    const {xinghao} = this.data?.lingsanOptions || {};
    const data: ImportCache = {xinghao, lurushuju: true};
    if (searchYaoqiu) {
      data.searchYaoqiu = true;
    } else {
      data.yaoqiu = this.getCadYaoqiu();
    }
    if (data.yaoqiu && !data.yaoqiu.新建CAD要求.some((v) => v.cadKey === "type")) {
      data.yaoqiu.新建CAD要求.push({
        cadKey: "type",
        key: "分类",
        readonly: true,
        override: true,
        value: this.lingsanCadType
      });
    }
    openImportPage(this.status, data);
    if (await this.message.newTabConfirm()) {
      this.step3Refresh();
    }
  }

  openExportPage() {
    const cads = this.lingsanCads[this.lingsanCadType] || [];
    const ids = cads.map((v) => v.data.id);
    openExportPage(this.status, {search: {_id: {$in: ids}}, lurushuju: true});
  }

  async copyLingsanCad(component: CadItemComponent<LingsanCadItemInfo>) {
    const {index} = component.customInfo;
    const item = this.lingsanCads[this.lingsanCadType]?.[index];
    if (!item) {
      return;
    }
    const collection = "cad";
    const ids = await this.http.mongodbCopy(collection, [item.data.id]);
    if (!ids || !ids[0]) {
      return;
    }
    if (await this.message.confirm("是否编辑新的CAD？")) {
      const {cads} = await this.http.getCad({collection, ids});
      const data = cads[0];
      if (data) {
        const gongshis = this.data?.gongshis;
        await openCadEditorDialog(this.dialog, {data: {data, collection, center: true, gongshis}});
      }
    }
    this.step3Refresh();
  }

  async deleteLingsanCad(component: CadItemComponent<LingsanCadItemInfo>) {
    const {index} = component.customInfo;
    const item = this.lingsanCads[this.lingsanCadType]?.[index];
    if (!item || !(await this.message.confirm(`是否确定删除【${item.data.name}】？`))) {
      return;
    }
    if (await this.http.mongodbDelete("cad", {id: item.data.id})) {
      this.step3Refresh();
    }
  }

  afterFetch(component: CadItemComponent<LingsanCadItemInfo>) {
    const {index} = component.customInfo;
    const item = this.lingsanCads[this.lingsanCadType]?.[index];
    if (!item) {
      return;
    }
    item.isFetched = true;
  }

  onLingsanItemClickAll(component: CadItemComponent<LingsanCadItemInfo>) {
    const {index} = component.customInfo;
    const {multiDeleting} = this;
    if (multiDeleting) {
      return;
    }
    for (const [i, item] of this.lingsanCads[this.lingsanCadType]?.entries() || []) {
      item.active = index === i;
    }
  }

  getLingsanItemSelectable(item: ZixuanpeijianlingsanCadItem): CadItemComponent<LingsanCadItemInfo>["selectable"] {
    if (this.multiDeleting) {
      return {selected: item.toDelete, onChange: () => (item.toDelete = !item.toDelete)};
    }
    return undefined;
  }

  async toggleMultiDeleting() {
    const cads = this.lingsanCads[this.lingsanCadType];
    if (!cads) {
      return;
    }
    if (this.multiDeleting) {
      const ids = cads.filter((v) => v.toDelete).map((v) => v.data.id);
      if (ids.length > 0 && (await this.message.confirm(`是否删除${ids.length}个选中的cad？`))) {
        if (await this.http.mongodbDelete(this.collection, {ids})) {
          this.step3Refresh();
        }
      }
    }
    this.multiDeleting = !this.multiDeleting;
    for (const item of cads) {
      delete item.toDelete;
    }
  }
}

export const openZixuanpeijianDialog = getOpenDialogFunc<ZixuanpeijianComponent, ZixuanpeijianInput, ZixuanpeijianOutput>(
  ZixuanpeijianComponent,
  {width: "100vw", height: "100vh", disableClose: true}
);
