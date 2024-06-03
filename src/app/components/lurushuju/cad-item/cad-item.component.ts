import {KeyValuePipe} from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatDialog} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {getValueString} from "@app/app.common";
import {CadPreviewParams, getCadPreview} from "@app/cad/cad-preview";
import {Cad数据要求, Cad数据要求Item} from "@app/cad/cad-shujuyaoqiu";
import {CadCollection} from "@app/cad/collections";
import {exportCadData, generateLineTexts2, openCadDimensionForm} from "@app/cad/utils";
import {openCadLineForm} from "@app/modules/cad-editor/components/menu/cad-line/cad-line.utils";
import {ClickStopPropagationDirective} from "@app/modules/directives/click-stop-propagation.directive";
import {OpenCadOptions} from "@app/services/app-status.types";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {DataInfoChnageEvent} from "@components/cad-image/cad-image.types";
import {openCadEditorDialog} from "@components/dialogs/cad-editor-dialog/cad-editor-dialog.component";
import {CadData, CadDimensionLinear, CadLineLike, CadMtext, CadViewer, CadViewerConfig, CadZhankai} from "@lucilor/cad-viewer";
import {keysOf, ObjectOf, selectFiles, timeout} from "@lucilor/utils";
import {Subscribed} from "@mixins/subscribed.mixin";
import {getCadInfoInputs2} from "@modules/cad-editor/components/menu/cad-info/cad-info.utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {HoutaiCad, QueryMongodbParams} from "@modules/http/services/cad-data.service.types";
import {getHoutaiCad} from "@modules/http/services/cad-data.service.utils";
import {HttpOptions} from "@modules/http/services/http.service.types";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService} from "@services/app-status.service";
import csstype from "csstype";
import {isEmpty} from "lodash";
import {openFentiCadDialog} from "../fenti-cad-dialog/fenti-cad-dialog.component";
import {FentiCadDialogInput} from "../fenti-cad-dialog/fenti-cad-dialog.types";
import {CadItemButton, CadItemSelectable, typeOptions} from "./cad-item.types";

@Component({
  selector: "app-cad-item",
  standalone: true,
  imports: [
    ClickStopPropagationDirective,
    forwardRef(() => CadImageComponent),
    forwardRef(() => InputComponent),
    KeyValuePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule
  ],
  templateUrl: "./cad-item.component.html",
  styleUrl: "./cad-item.component.scss"
})
export class CadItemComponent<T = undefined> extends Subscribed() implements OnChanges, OnInit, OnDestroy {
  @Input() cadWidth = 360;
  @Input() cadHeight = 180;

  @HostBinding("style.--cad-image-width") get widthStyle() {
    return `${this.cadWidth}px`;
  }
  @HostBinding("style.--cad-image-height") get heightStyle() {
    return `${this.cadHeight}px`;
  }
  @HostBinding("style") style: csstype.Properties = {};
  @HostBinding("class") class: string[] = [];

  @Input({required: true}) cad: HoutaiCad | CadData = new CadData();
  @Input({required: true}) buttons: CadItemButton<T>[] = [];
  @Input() buttons2: CadItemButton<T>[] = [];
  @Input({required: true}) customInfo!: T;
  @Input({required: true}) yaoqiu: Cad数据要求 | undefined;
  @Input() fentiDialogInput?: FentiCadDialogInput;
  @Input() mubanExtraData: Partial<CadData> = {};
  @Input() openCadOptions?: OpenCadOptions;
  @Input() showMuban?: boolean;
  @Input() isOnline?: {collection?: CadCollection; isFetched?: boolean; afterFetch: (component: CadItemComponent<T>) => void};
  @Input() selectable?: CadItemSelectable<T>;
  @Input() events?: {
    clickAll?: (component: CadItemComponent<T>, event: MouseEvent) => void;
    clickBlank?: (component: CadItemComponent<T>, event: MouseEvent) => void;
  };
  @Input() validators?: {zhankai?: boolean};
  @Output() afterEditCad = new EventEmitter<void>();

  @ViewChild("cadContainer") cadContainer?: ElementRef<HTMLDivElement>;
  @ViewChild("mubanContainer") mubanContainer?: ElementRef<HTMLDivElement>;
  @ViewChildren(forwardRef(() => InputComponent)) inputComponents?: QueryList<InputComponent>;
  cadViewer?: CadViewer;
  mubanViewer?: CadViewer;
  showCadViewer = false;
  showMubanViewer = false;
  cadData?: CadData;
  mubanData?: CadData;
  mubanInputs: InputInfo[][] = [];
  errorMsgs: ObjectOf<string> = {};

  constructor(
    private message: MessageService,
    private dialog: MatDialog,
    private http: CadDataService,
    private status: AppStatusService
  ) {
    super();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.cad) {
      setTimeout(() => {
        this.update();
      }, 0);
    }
  }

  ngOnInit() {
    this.subscribe(this.afterEditCad, () => {
      this.validate();
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.cadViewer?.destroy();
    this.mubanViewer?.destroy();
  }

  get cadId() {
    return this.cad instanceof CadData ? this.cad.id : this.cad._id;
  }
  get cadName() {
    return this.cad instanceof CadData ? this.cad.name : this.cad.名字;
  }
  get mubanId() {
    if (this.cad instanceof CadData) {
      return this.cad.zhankai[0]?.kailiaomuban || "";
    }
    return this.cad?.json?.zhankai?.[0]?.kailiaomuban || "";
  }
  set mubanId(value: string) {
    const {cad} = this;
    if (!cad) {
      return;
    }
    if (cad instanceof CadData) {
      if (!cad.zhankai[0]) {
        cad.zhankai[0] = new CadZhankai({name: cad.name});
      }
      cad.zhankai[0].kailiaomuban = value;
    } else {
      if (!cad.json) {
        cad.json = {};
      }
      if (!cad.json.zhankai) {
        cad.json.zhankai = [];
      }
      if (!cad.json.zhankai[0]) {
        cad.json.zhankai[0] = {};
      }
      cad.json.zhankai[0].kailiaomuban = value;
    }
  }
  get zhankai() {
    const {cad} = this;
    let zhankai: any;
    if (cad instanceof CadData) {
      zhankai = cad.zhankai[0];
    } else {
      if (cad?.json?.zhankai && cad.json.zhankai[0]) {
        zhankai = cad.json.zhankai[0];
      }
    }
    return zhankai as CadZhankai | undefined;
  }

  centerCad() {
    this.cadViewer?.center();
  }

  async onlineFetch(compact = false) {
    const {isOnline, yaoqiu} = this;
    if (!isOnline || isOnline.isFetched) {
      return;
    }
    const params: QueryMongodbParams = {collection: isOnline.collection || "cad", where: {_id: this.cadId}};
    if (compact && yaoqiu) {
      const fields: string[] = [];
      for (const {cadKey} of yaoqiu.CAD弹窗修改属性) {
        if (cadKey) {
          fields.push(`json.${cadKey}`);
        }
      }
      // fixme
      // params.fields = fields;
    }
    const data = (await this.http.queryMongodb<HoutaiCad>(params, {spinner: false}))[0];
    if (data) {
      if (this.cad instanceof CadData) {
        Object.assign(this.cad, new CadData(data.json));
      } else {
        Object.assign(this.cad, data);
      }
      isOnline.afterFetch(this);
    }
  }

  async editCad() {
    const {cad, isOnline} = this;
    if (!cad) {
      return;
    }
    await this.onlineFetch();
    const cadData = cad instanceof CadData ? cad : new CadData(cad.json);
    const result = await openCadEditorDialog(this.dialog, {
      data: {
        data: cadData,
        center: true,
        isLocal: !isOnline,
        ...this.openCadOptions
      }
    });
    if (result?.isSaved) {
      if (cad instanceof CadData) {
        Object.assign(cad, cadData);
        cad.info.imgUpdate = true;
      } else {
        Object.assign(cad, getHoutaiCad(cadData));
        if (cad.json.info?.imgId) {
          cad.json.info.imgUpdate = true;
        }
      }
      await this.initCadViewer();
      this.afterEditCad.emit();
    }
  }

  async editCadForm() {
    const {cad, isOnline, yaoqiu} = this;
    if (!cad) {
      return;
    }
    await this.onlineFetch();
    let data: CadData;
    const ignoreKeys = ["entities"];
    if (cad instanceof CadData) {
      data = cad.clone();
    } else {
      const dataRaw: ObjectOf<any> = {};
      for (const key in cad.json) {
        if (!ignoreKeys.includes(key)) {
          dataRaw[key] = cad.json[key];
        }
      }
      data = new CadData(dataRaw);
    }
    const form = getCadInfoInputs2(yaoqiu?.CAD弹窗修改属性 || [], data, this.dialog, this.status, true);
    let title = "编辑CAD";
    const name = data.name;
    if (name) {
      title += `【${name}】`;
    }
    const result = await this.message.form(form, {title});
    if (result) {
      if (data.zhankai[0] && data.zhankai[0].name !== data.name) {
        data.zhankai[0].name = data.name;
      }
      if (cad instanceof CadData) {
        for (const {cadKey} of yaoqiu?.CAD弹窗修改属性 || []) {
          if (cadKey) {
            (cad as any)[cadKey] = data[cadKey];
          }
        }
      } else {
        const cad2 = getHoutaiCad(data);
        for (const key of keysOf(cad2)) {
          if (key === "json") {
            for (const key2 in cad2.json) {
              if (!ignoreKeys.includes(key2)) {
                cad.json[key2] = cad2.json[key2];
              }
            }
          } else {
            cad[key] = cad2[key] as any;
          }
        }
      }
      if (isOnline) {
        await this.http.setCad({collection: isOnline.collection || "cad", cadData: data, force: true}, true);
      }
      this.afterEditCad.emit();
    }
  }

  centerMuban() {
    this.mubanViewer?.center();
  }

  async uploadMuban() {
    const files = await selectFiles({accept: ".dxf"});
    const file = files?.[0];
    if (!file) {
      return;
    }
    const cadData = await this.http.uploadDxf(file);
    if (!cadData) {
      return;
    }
    const {cad, mubanId, mubanExtraData} = this;
    if (mubanId) {
      cadData.id = mubanId;
    }
    cadData.type = typeOptions[0];
    if (mubanExtraData) {
      Object.assign(cadData, mubanExtraData);
    }
    if (cad instanceof CadData) {
      cadData.name = cad?.name || "模板";
      cadData.info.fromCad = {
        name: cad.name,
        imgId: cad.info.imgId
      };
    } else {
      cadData.name = cad?.名字 || "模板";
      cadData.info.fromCad = {
        name: cad.名字,
        imgId: cad.json.info?.imgId
      };
    }
    const result = await this.http.setCad({collection: "kailiaocadmuban", cadData, force: true}, true);
    if (!result) {
      return;
    }
    this.mubanId = result.id;
    this.mubanData = result;
    await timeout(0);
    await this.initMubanViewer();
  }

  async getMubanData() {
    const {mubanId} = this;
    if (!mubanId) {
      this.mubanData = undefined;
      return undefined;
    }
    const resultData = await this.http.getCad({collection: "kailiaocadmuban", id: mubanId}, {spinner: false});
    const mubanData = resultData?.cads[0] as CadData | undefined;
    this.mubanData = mubanData;
    if (mubanData) {
      generateLineTexts2(mubanData);
    } else {
      this.mubanId = "";
    }
    return mubanData;
  }

  async editMuban() {
    const {mubanExtraData} = this;
    let {mubanData} = this;
    if (!mubanData) {
      mubanData = await this.getMubanData();
    }
    if (!mubanData) {
      return;
    }
    const result = await openCadEditorDialog(this.dialog, {
      data: {
        data: mubanData,
        center: true,
        collection: "kailiaocadmuban",
        extraData: mubanExtraData,
        ...this.openCadOptions
      }
    });
    this.mubanData = this.status.cad.data.clone();
    if (result?.isSaved) {
      await this.initMubanViewer();
    }
  }

  async editMubanInNewTab() {
    const {mubanId} = this;
    if (!mubanId) {
      return;
    }
    this.status.openCadInNewTab(mubanId, "kailiaocadmuban");
    if (await this.message.newTabConfirm()) {
      await this.refreshMuban();
    }
  }

  async refreshMuban() {
    await this.getMubanData();
    if (this.mubanData) {
      this.status.cadImgToUpdate[this.mubanData.id] = {t: Date.now()};
    }
    await this.initMubanViewer();
  }

  async removeMuban() {
    const {mubanId} = this;
    if (!mubanId) {
      return;
    }
    if (!(await this.message.confirm(`确定删除模板吗？`))) {
      return;
    }
    if (await this.http.mongodbDelete("kailiaocadmuban", {id: mubanId})) {
      this.mubanId = "";
      this.mubanData = undefined;
      await this.initMubanViewer();
    }
  }

  async update() {
    delete this.mubanData;
    await this.initCadViewer();
    await this.initMubanViewer();
  }

  getCadPreviewParams = (() => {
    const params: CadPreviewParams = {
      config: {
        width: this.cadWidth,
        height: this.cadHeight,
        backgroundColor: "black",
        lineGongshi: 24,
        hideLineGongshi: false,
        hideLineLength: false,
        padding: [5]
      }
    };
    return params;
  }).bind(this);

  initCadViewer0(collection: CadCollection, data: CadData, containerEl: HTMLDivElement, afterDblClickForm: (data: CadData) => void) {
    const params = this.getCadPreviewParams();
    const cadConfig: Partial<CadViewerConfig> = {
      ...params.config,
      enableZoom: false,
      dragAxis: "xy",
      selectMode: "single",
      entityDraggable: false
    };
    containerEl.innerHTML = "";
    const cadViewer = new CadViewer(data, cadConfig);
    cadViewer.appendTo(containerEl);
    cadViewer.on("entitydblclick", async (_, entity) => {
      if (entity instanceof CadMtext && entity.parent) {
        entity = entity.parent;
      }
      if (entity instanceof CadLineLike) {
        const result = await openCadLineForm(collection, this.status, this.message, cadViewer, entity);
        if (result) {
          afterDblClickForm(data);
        }
      } else if (entity instanceof CadDimensionLinear) {
        const dimension2 = await openCadDimensionForm(collection, this.message, cadViewer, entity);
        if (dimension2) {
          afterDblClickForm(data);
        }
      }
    });
    cadViewer.on("click", () => {
      cadViewer.setConfig("enableZoom", true);
    });
    cadViewer.on("pointerleave", () => {
      cadViewer.setConfig("enableZoom", false);
    });
    setTimeout(() => {
      cadViewer.center();
    }, 0);
    return cadViewer;
  }

  async initCadViewer() {
    this.cadViewer?.destroy();
    const {cad, cadContainer, showCadViewer} = this;
    if (!cad || !cadContainer) {
      return;
    }
    await this.onlineFetch(!showCadViewer);
    const data = cad instanceof CadData ? cad.clone() : new CadData(cad.json);
    this.cadData = data;
    generateLineTexts2(data);
    if (showCadViewer) {
      const containerEl = cadContainer.nativeElement;
      const collection: CadCollection = "cad";
      this.cadViewer = this.initCadViewer0(collection, data, containerEl, async (data) => {
        if (!this.isOnline) {
          data.info.imgUpdate = true;
        }
        if (cad instanceof CadData) {
          Object.assign(cad, data);
        } else {
          const exportData = exportCadData(data, true);
          for (const key of ["entities", "info"] as const) {
            cad.json[key] = exportData[key];
          }
        }
        if (this.isOnline) {
          const url = await getCadPreview(collection, data);
          await this.http.setCad({collection: collection, cadData: data, force: true}, true);
          await this.http.setCadImg(data.id, url, {silent: true});
        }
      });
    }
  }

  async initMubanViewer() {
    this.mubanViewer?.destroy();
    if (!this.showMuban) {
      return;
    }
    const {cad, mubanContainer, showMubanViewer} = this;
    if (!cad || !mubanContainer) {
      return;
    }
    if (!this.mubanData) {
      await this.getMubanData();
    }
    if (showMubanViewer) {
      const {mubanData} = this;
      if (mubanData) {
        const containerEl = mubanContainer.nativeElement;
        this.mubanViewer = this.initCadViewer0("kailiaocadmuban", mubanData, containerEl, () => {
          this.http.setCad({collection: "kailiaocadmuban", cadData: mubanData, force: true}, true);
        });
      }
    }
    await this.updateMubanInputs();
  }

  async updateMubanInputs() {
    this.mubanInputs = [];
    const {cad, mubanData} = this;
    if (!cad || !mubanData) {
      return;
    }
    let flip: any;
    if (cad instanceof CadData) {
      if (cad.zhankai.length < 1) {
        cad.zhankai.push(new CadZhankai({name: cad.name}));
      }
      if (cad.zhankai[0].flip.length < 1) {
        cad.zhankai[0].flip.push({chanpinfenlei: "", fanzhuanfangshi: "", kaiqi: ""});
      }
      flip = cad.zhankai[0].flip[0];
    } else {
      if (!cad.json) {
        cad.json = {};
      }
      if (!cad.json.zhankai) {
        cad.json.zhankai = [];
      }
      if (!cad.json.zhankai[0]) {
        cad.json.zhankai[0] = {};
      }
      const zhankai = cad.json.zhankai[0];
      if (!zhankai.flip || !zhankai.flip[0]) {
        zhankai.flip = [{chanpinfenlei: "", fanzhuanfangshi: "", kaiqi: ""}];
      }
      flip = zhankai.flip[0];
    }
    const updateMuban = async (options?: HttpOptions) => {
      return await this.http.setCad({collection: "kailiaocadmuban", cadData: mubanData, force: true}, true, options);
    };
    if (!mubanData.type) {
      mubanData.type = typeOptions[0];
      await updateMuban({spinner: false});
    }
    this.mubanInputs = [
      [
        {
          type: "select",
          label: "翻转",
          model: {data: flip, key: "fanzhuanfangshi"},
          options: [
            {label: "无", value: ""},
            {label: "水平翻转", value: "h"},
            {label: "垂直翻转", value: "v"}
          ]
        },
        {
          type: "select",
          label: "分类",
          model: {data: mubanData, key: "type"},
          options: typeOptions.map((v) => ({
            label: v.replace("+模板", ""),
            value: v
          })),
          onChange: async () => {
            const result = await updateMuban();
            if (result) {
              this.message.snack("已保存");
            }
          }
        }
      ]
    ];
  }

  returnZero() {
    return 0;
  }

  async selectFentiCad() {
    const {fentiDialogInput} = this;
    if (!fentiDialogInput) {
      return;
    }
    await openFentiCadDialog(this.dialog, {data: fentiDialogInput});
  }

  validate() {
    const inputs = this.inputComponents?.toArray() || [];
    const errors: string[] = [];
    this.errorMsgs = {};
    const {cadName, validators} = this;
    const name = `【${cadName}】`;
    if (inputs.some((v) => !isEmpty(v.validateValue()))) {
      errors.push(`${name}输入数据有误`);
    }
    if (validators?.zhankai) {
      const {zhankai} = this;
      if (!zhankai?.zhankaigao) {
        const err = `${name}展开高不能为空`;
        errors.push(err);
        this.errorMsgs.展开信息 = err;
      }
    }
    return errors;
  }

  isCadInfoVisible(item: Cad数据要求Item) {
    if (item.key === "展开信息") {
      return true;
    }
    return !!item.cadKey;
  }

  getCadInfoStr(item: Cad数据要求Item) {
    const {cad} = this;
    if (item.cadKey) {
      let value = cad instanceof CadData ? cad[item.cadKey] : cad.json[item.cadKey];
      if (item.key2) {
        value = value?.[item.key2];
      }
      return getValueString(value, "\n", "：");
    } else if (item.key === "展开信息") {
      const zhankai = this.zhankai;
      if (zhankai) {
        return `${zhankai.zhankaikuan || ""} × ${zhankai.zhankaigao || ""} = ${zhankai.shuliang || ""}`;
      }
    }
    return "";
  }

  async onCadImageClick() {
    this.showCadViewer = true;
    await timeout(0);
    await this.initCadViewer();
  }

  onCadInfoChange(event: DataInfoChnageEvent) {
    const {cad} = this;
    if (!(cad instanceof CadData)) {
      cad.json.info = event.info;
    }
  }

  async onMubanImageClick() {
    this.showMubanViewer = true;
    await timeout(0);
    await this.initMubanViewer();
  }

  async copyName() {
    await this.message.copyText(this.cadName, {successText: "已复制名字"});
  }

  async toggleShowLineLength() {
    if (!(await this.message.confirm("是否将所有线的线长数字如果是隐藏的就显示，如果是显示的就隐藏？"))) {
      return;
    }
    const cad = this.cad;
    const toggle = async (data: CadData) => {
      data.entities.forEach((e) => {
        if (e instanceof CadLineLike) {
          e.hideLength = !e.hideLength;
        }
      });
      const isOnline = this.isOnline;
      if (isOnline) {
        await this.http.setCad({collection: isOnline.collection || "cad", cadData: data, force: true}, true);
      }
      await this.http.setCadImg(data.id, await getCadPreview("cad", data), {silent: true});
      this.status.cadImgToUpdate[data.id] = {t: Date.now()};
      await this.initCadViewer();
    };
    if (cad instanceof CadData) {
      await toggle(cad);
    } else {
      const data = new CadData(cad.json);
      await toggle(data);
      Object.assign(cad, getHoutaiCad(data));
    }
  }

  @HostListener("click", ["$event"])
  onHostClick(event: MouseEvent) {
    this.events?.clickAll?.(this, event);
    this.events?.clickBlank?.(this, event);
  }

  onClickStopped = ((event: MouseEvent) => {
    this.events?.clickAll?.(this, event);
  }).bind(this);
}
