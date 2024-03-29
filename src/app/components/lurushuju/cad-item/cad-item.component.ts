import {KeyValuePipe} from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {CadCollection} from "@app/cad/collections";
import {cadOptions} from "@app/cad/options";
import {exportCadData, openCadDimensionForm, openCadLineForm} from "@app/cad/utils";
import {openCadEditorDialog} from "@components/dialogs/cad-editor-dialog/cad-editor-dialog.component";
import {CadData, CadDimensionLinear, CadLineLike, CadMtext, CadViewer, CadZhankai, generateLineTexts} from "@lucilor/cad-viewer";
import {selectFiles} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {getHoutaiCad, HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService, OpenCadOptions} from "@services/app-status.service";
import {isEmpty} from "lodash";
import {openFentiCadDialog} from "../fenti-cad-dialog/fenti-cad-dialog.component";
import {FentiCadData} from "../fenti-cad-dialog/fenti-cad-dialog.types";
import {CadItemButton, typeOptions} from "./cad-item.types";

@Component({
  selector: "app-cad-item",
  standalone: true,
  imports: [InputComponent, KeyValuePipe, MatButtonModule, MatIconModule],
  templateUrl: "./cad-item.component.html",
  styleUrl: "./cad-item.component.scss"
})
export class CadItemComponent<T = undefined> implements OnChanges, OnDestroy {
  @Input() cadWidth = 360;
  cadHeight = 0;
  @Input({required: true}) cad: HoutaiCad = getHoutaiCad();
  @Input({required: true}) buttons: CadItemButton<T>[] = [];
  @Input({required: true}) customInfo!: T;
  @Input() fentiCads?: FentiCadData;
  @Input() mubanExtraData: Partial<CadData> = {};
  @Input() openCadOptions?: OpenCadOptions;
  @Input() noMuban?: boolean;
  @Input() noZhankai?: boolean;
  @Input() showMenshanhoudu?: boolean;
  @Output() afterEditCad = new EventEmitter<void>();

  @ViewChild("cadContainer") cadContainer?: ElementRef<HTMLDivElement>;
  @ViewChild("mubanContainer") mubanContainer?: ElementRef<HTMLDivElement>;
  @ViewChildren(InputComponent) inputComponents?: QueryList<InputComponent>;
  cadViewer?: CadViewer;
  mubanViewer?: CadViewer;
  mubanData?: CadData;
  get mubanId() {
    return this.cad?.json?.zhankai?.[0]?.kailiaomuban || "";
  }
  set mubanId(value: string) {
    const {cad} = this;
    if (!cad) {
      return;
    }
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

  cadInputs: InputInfo<CadData>[][] = [];
  zhankaiInputs: {width: InputInfo; height: InputInfo; num: InputInfo}[] = [];
  mubanInputs: InputInfo[][] = [];
  showMuban: boolean;

  constructor(
    private message: MessageService,
    private dialog: MatDialog,
    private http: CadDataService,
    status: AppStatusService
  ) {
    this.showMuban = status.projectConfig.getBoolean("新版本做数据可以做激光开料");
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.cad) {
      setTimeout(() => {
        this.update();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.cadViewer?.destroy();
    this.mubanViewer?.destroy();
  }

  centerCad() {
    this.cadViewer?.center();
  }

  async editCad() {
    const {cad} = this;
    if (!cad) {
      return;
    }
    const cadData = new CadData(cad.json);
    const result = await openCadEditorDialog(this.dialog, {
      data: {
        data: cadData,
        center: true,
        isLocal: true,
        ...this.openCadOptions
      }
    });
    if (result?.isSaved) {
      Object.assign(cad, getHoutaiCad(cadData));
      this.initCadViewer();
      this.afterEditCad.emit();
    }
  }

  async editCadName() {
    const {cad} = this;
    if (!cad) {
      return;
    }
    const name = await this.message.prompt({
      type: "string",
      label: "CAD名字",
      value: cad.名字,
      validators: Validators.required
    });
    if (!name) {
      return;
    }
    cad.名字 = name;
    cad.json.name = name;
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
    cadData.name = cad?.名字 || "模板";
    cadData.type = typeOptions[0];
    if (mubanExtraData) {
      Object.assign(cadData, mubanExtraData);
    }
    const result = await this.http.setCad({collection: "kailiaocadmuban", cadData, force: true}, true);
    if (!result) {
      return;
    }
    this.mubanId = result.id;
    this.mubanData = result;
    this.initMubanViewer();
  }

  async editMuban() {
    const {mubanData} = this;
    if (!mubanData) {
      return;
    }
    const result = await openCadEditorDialog(this.dialog, {
      data: {
        data: mubanData,
        center: true,
        collection: "kailiaocadmuban",
        ...this.openCadOptions
      }
    });
    if (result?.isSaved) {
      this.initMubanViewer();
    }
  }

  async removeMuban() {
    const {mubanData} = this;
    if (!mubanData) {
      return;
    }
    if (!(await this.message.confirm(`确定删除模板【${mubanData.name}】吗？`))) {
      return;
    }
    if (await this.http.mongodbDelete("kailiaocadmuban", {id: mubanData.id})) {
      this.mubanId = "";
      this.mubanData = undefined;
      this.initMubanViewer();
    }
  }

  update() {
    delete this.mubanData;
    this.initCadViewer();
    this.initMubanViewer();
  }

  initCadViewer0(collection: CadCollection, data: CadData, containerEl: HTMLDivElement, afterDblClickForm: () => void) {
    const width = this.cadWidth;
    const height = (width / 300) * 150;
    this.cadHeight = height;
    const cadViewer = new CadViewer(data, {
      width,
      height,
      backgroundColor: "black",
      enableZoom: false,
      dragAxis: "xy",
      selectMode: "single",
      entityDraggable: false,
      lineGongshi: 24
    });
    cadViewer.appendTo(containerEl);
    cadViewer.on("entitydblclick", async (_, entity) => {
      if (entity instanceof CadMtext && entity.parent) {
        entity = entity.parent;
      }
      if (entity instanceof CadLineLike) {
        const result = await openCadLineForm(collection, this.message, cadViewer, entity);
        if (result) {
          afterDblClickForm();
        }
      } else if (entity instanceof CadDimensionLinear) {
        const dimension2 = await openCadDimensionForm(collection, this.message, cadViewer, entity);
        if (dimension2) {
          afterDblClickForm();
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

  initCadViewer() {
    this.cadViewer?.destroy();
    const {cad, cadContainer} = this;
    if (!cad || !cadContainer) {
      return;
    }
    const containerEl = cadContainer.nativeElement;
    containerEl.innerHTML = "";
    const data = new CadData(cad.json);
    generateLineTexts(data);
    const cadViewer = this.initCadViewer0("cad", data, containerEl, () => {
      cad.json.entities = exportCadData(data, true).entities;
    });
    this.cadViewer = cadViewer;
    this.updateCadInputs();
    this.updateZhankaiInputs();
  }

  async initMubanViewer() {
    this.mubanViewer?.destroy();
    if (!this.showMuban) {
      return;
    }
    const {cad, mubanContainer, mubanId} = this;
    let {mubanData} = this;
    if (!cad || !mubanContainer) {
      return;
    }
    if (!mubanData && mubanId) {
      const resultData = await this.http.getCad({collection: "kailiaocadmuban", id: mubanId}, {silent: true});
      mubanData = resultData?.cads[0];
      this.mubanData = mubanData;
    }
    if (!mubanData) {
      this.mubanId = "";
      return;
    }
    const containerEl = mubanContainer.nativeElement;
    containerEl.innerHTML = "";
    generateLineTexts(mubanData);
    const cadViewer = this.initCadViewer0("CADmuban", mubanData, containerEl, () => {});
    this.mubanViewer = cadViewer;
    await this.updateMubanInputs();
  }

  updateCadInputs() {
    const data = this.cad?.json as CadData;
    if (!data) {
      return;
    }
    this.cadInputs = [
      [
        {
          type: "select",
          label: "算料处理",
          model: {data, key: "suanliaochuli"},
          options: cadOptions.suanliaochuli.values.slice()
        },
        {
          type: "select",
          label: "算料单显示",
          model: {data, key: "suanliaodanxianshi"},
          options: cadOptions.suanliaodanxianshi.values.slice()
        }
      ]
    ];
    if (this.showMenshanhoudu) {
      this.cadInputs.push([{type: "number", label: "对应门扇厚度", model: {data, key: "对应门扇厚度"}}]);
    }
  }

  updateZhankaiInputs() {
    const json = this.cad?.json;
    if (!json) {
      return;
    }
    if (!Array.isArray(json.zhankai)) {
      json.zhankai = [];
    }
    const zhankais = json.zhankai;
    this.zhankaiInputs = [];
    if (zhankais.length < 1) {
      zhankais.push(new CadZhankai({name: json.name}).export());
    }
    for (const zhankai of zhankais) {
      this.zhankaiInputs.push({
        width: {type: "string", label: "宽", model: {data: zhankai, key: "zhankaikuan"}, validators: Validators.required},
        height: {type: "string", label: "高", model: {data: zhankai, key: "zhankaigao"}, validators: Validators.required},
        num: {type: "string", label: "数量", model: {data: zhankai, key: "shuliang"}, validators: Validators.required}
      });
    }
  }

  async updateMubanInputs() {
    this.mubanInputs = [];
    const {cad, mubanData} = this;
    if (!cad || !mubanData) {
      return;
    }
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
    const flip = zhankai.flip[0];
    const updateMuban = async (silent?: boolean) => {
      return await this.http.setCad(
        {collection: "kailiaocadmuban", cadData: mubanData, force: true},
        true,
        silent ? {silent: true} : {spinner: false}
      );
    };
    if (!mubanData.type) {
      mubanData.type = typeOptions[0];
      await updateMuban(true);
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

  addZhankai(i: number) {
    const zhankai = this.cad?.json?.zhankai;
    if (!Array.isArray(zhankai)) {
      return;
    }
    zhankai.splice(i + 1, 0, new CadZhankai().export());
    this.update();
  }

  removeZhankai(i: number) {
    const zhankai = this.cad?.json?.zhankai;
    if (!Array.isArray(zhankai)) {
      return;
    }
    zhankai.splice(i, 1);
    this.update();
  }

  returnZero() {
    return 0;
  }

  async selectFentiCad() {
    const {fentiCads} = this;
    if (!fentiCads) {
      return;
    }
    const {cadWidth, cadHeight} = this;
    await openFentiCadDialog(this.dialog, {data: {data: fentiCads, cadSize: [cadWidth, cadHeight]}});
  }

  validate() {
    const inputs = this.inputComponents?.toArray() || [];
    if (inputs.some((v) => !isEmpty(v.validateValue()))) {
      return false;
    } else {
      return true;
    }
  }
}
