import {CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray} from "@angular/cdk/drag-drop";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  HostBinding,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren
} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {getCopyName} from "@app/app.common";
import {alertError, checkDuplicateVars, ErrorDetail, ErrorItem, getNamesDetail} from "@app/utils/error-message";
import {canOptionsOverlap} from "@app/utils/mongo";
import {openBancaiFormDialog} from "@components/dialogs/bancai-form-dialog/bancai-form-dialog.component";
import {getFromulasFromString} from "@components/dialogs/zixuanpeijian/zixuanpeijian.utils";
import {FormulasEditorComponent} from "@components/formulas-editor/formulas-editor.component";
import {CadItemButton} from "@components/lurushuju/cad-item/cad-item.types";
import {XuanxiangTableData} from "@components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.types";
import {emptyXuanxiangItem, getXuanxiangItem, getXuanxiangTable} from "@components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.utils";
import {选项} from "@components/lurushuju/xinghao-data";
import {CadData} from "@lucilor/cad-viewer";
import {keysOf, ObjectOf, timeout} from "@lucilor/utils";
import {SuanliaogongshiComponent} from "@modules/cad-editor/components/suanliaogongshi/suanliaogongshi.component";
import {SuanliaogongshiInfo} from "@modules/cad-editor/components/suanliaogongshi/suanliaogongshi.types";
import {FloatingDialogModule} from "@modules/floating-dialog/floating-dialog.module";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {BancaiListData, HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {getHoutaiCad} from "@modules/http/services/cad-data.service.utils";
import {ImageComponent} from "@modules/image/components/image/image.component";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {TableComponent} from "@modules/table/components/table/table.component";
import {RowButtonEvent, ToolbarButtonEvent} from "@modules/table/components/table/table.types";
import {AppStatusService} from "@services/app-status.service";
import {MrbcjfzComponent} from "@views/mrbcjfz/mrbcjfz.component";
import {MrbcjfzDataSubmitEvent, MrbcjfzInfo, MrbcjfzInputData, MrbcjfzResponseData} from "@views/mrbcjfz/mrbcjfz.types";
import {getEmptyMrbcjfzInfo, isMrbcjfzInfoEmpty2, MrbcjfzXinghaoInfo} from "@views/mrbcjfz/mrbcjfz.utils";
import {clone, cloneDeep, intersection, isEmpty, isEqual} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {firstValueFrom, Subject} from "rxjs";
import {CadItemComponent} from "../../lurushuju/cad-item/cad-item.component";
import {MokuaiCadsComponent} from "../mokuai-cads/mokuai-cads.component";
import {BjmkStatusService} from "../services/bjmk-status.service";
import {MokuaiItem, MokuaiItemCadInfo, MokuaiItemCloseEvent, MokuaiItemCustomData} from "./mokuai-item.types";
import {getEmptyMokuaiItem, getMokuaiCustomData, mokuaiSubmitAfter, updateMokuaiCustomData} from "./mokuai-item.utils";

@Component({
  selector: "app-mokuai-item",
  imports: [
    CadItemComponent,
    CdkDrag,
    CdkDropList,
    FloatingDialogModule,
    FormulasEditorComponent,
    ImageComponent,
    InputComponent,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MokuaiCadsComponent,
    MrbcjfzComponent,
    NgScrollbarModule,
    SuanliaogongshiComponent,
    TableComponent
  ],
  templateUrl: "./mokuai-item.component.html",
  styleUrl: "./mokuai-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MokuaiItemComponent {
  private bjmkStatus = inject(BjmkStatusService);
  private cd = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private http = inject(CadDataService);
  private message = inject(MessageService);
  private status = inject(AppStatusService);

  @HostBinding("class") class = ["ng-page"];

  collection = this.bjmkStatus.collection;

  mokuaiIn = input.required<MokuaiItem>({alias: "mokuai"});
  bancaiListData = input.required<BancaiListData | null>();
  closeOut = output<MokuaiItemCloseEvent>({alias: "close"});

  imgPrefix = this.bjmkStatus.imgPrefix;
  mokuai = signal<MokuaiItem>(getEmptyMokuaiItem());
  mokuaiEff = effect(() => {
    const mokuai = cloneDeep(this.mokuaiIn());
    if (mokuai.自定义数据) {
      const optionsAll = this.bjmkStatus.mokuaiOptionsManager.data();
      updateMokuaiCustomData(mokuai.自定义数据, optionsAll);
    }
    mokuaiSubmitAfter(mokuai);
    this.mokuai.set(mokuai);
  });
  async editMokuai() {
    const mokuai = this.mokuai();
    const mokuai2 = await this.bjmkStatus.getMokuaiWithForm(mokuai);
    Object.assign(mokuai, mokuai2);
    this.cd.markForCheck();
  }

  useSlgsInfo = computed(() => {
    const mokuai = this.mokuai();
    return mokuai.xuanxianggongshi.length > 0 || isEmpty(mokuai.suanliaogongshi);
  });
  gongshis = computed(() => this.mokuai().xuanxianggongshi);
  slgsInfo = computed(() => {
    const info: SuanliaogongshiInfo = {
      data: {算料公式: this.gongshis()},
      slgs: {title: "模块公式", titleStyle: {fontSize: "1.2em", fontWeight: "bold"}}
    };
    return info;
  });
  onSlgsChange(info: SuanliaogongshiInfo) {
    this.mokuai.update((v) => ({...v, xuanxianggongshi: info.data.算料公式 || []}));
  }

  morenbancais = signal<{key: string; val: MrbcjfzInfo}[]>([]);
  morenbancaisEff = effect(() => {
    const morenbancai = this.mokuai().morenbancai || {};
    this.morenbancais.set(Object.entries(morenbancai).map(([key, val]) => ({key, val})));
  });
  morenbancaiInputInfos = computed(() => {
    const infos: InputInfo[] = [];
    for (const [i, {key, val}] of this.morenbancais().entries()) {
      let str = "";
      if (isMrbcjfzInfoEmpty2(key, val)) {
        continue;
      } else {
        const {默认开料材料, 默认开料板材, 默认开料板材厚度} = val;
        str = `${默认开料材料}/${默认开料板材}/${默认开料板材厚度}`;
      }
      infos.push({
        type: "string",
        label: key,
        value: str,
        selectOnly: true,
        suffixIcons: [
          {name: "edit", isDefault: true, onClick: () => this.editMorenbancai(i)}
          // {name: "add", onClick: () => this.addMorenbancai(i)},
          // {name: "remove", onClick: () => this.removeMorenbancai(i)}
        ]
      });
    }
    return infos;
  });
  async getMorenbancaiItem(i?: number) {
    const morenbancais = this.morenbancais();
    const item = typeof i === "number" ? cloneDeep(morenbancais[i]) : {key: "", val: getEmptyMrbcjfzInfo("")};
    const xinghao = new MrbcjfzXinghaoInfo("", {vid: 0, mingzi: ""});
    const {key, val} = item;
    xinghao.默认板材 = {[key]: val};
    xinghao.update();
    const extraInputInfos = xinghao.inputInfos[key];
    const names = morenbancais.map((v) => v.key);
    if (typeof i === "number") {
      names.splice(i, 1);
    }
    extraInputInfos[0].unshift({
      type: "string",
      label: "板材分组名字",
      model: {data: item, key: "key"},
      autoFocus: true,
      validators: [Validators.required, (control) => (names.includes(control.value) ? {名字不能重复: true} : null)],
      style: {...extraInputInfos[0][0].style}
    });
    const bancaiList = this.bancaiListData()?.bancais || [];
    const result = await openBancaiFormDialog(this.dialog, {
      data: {
        data: {
          bancai: val.默认开料板材,
          cailiao: val.默认开料材料,
          houdu: val.默认开料板材厚度,
          bancaiList: val.可选板材,
          cailiaoList: val.可选材料,
          houduList: val.可选厚度
        },
        bancaiList,
        key,
        extraInputInfos,
        noTitle: true
      }
    });
    if (result) {
      item.val = xinghao.默认板材[key];
      item.val.默认开料板材 = result.bancai;
      item.val.默认开料材料 = result.cailiao;
      item.val.默认开料板材厚度 = result.houdu;
      item.val.可选板材 = result.bancaiList || [];
      item.val.可选材料 = result.cailiaoList || [];
      item.val.可选厚度 = result.houduList || [];
      return item;
    }
    return null;
  }
  async addMorenbancai(i?: number) {
    const morenbancais = this.morenbancais().slice();
    const item = await this.getMorenbancaiItem();
    if (item) {
      if (typeof i === "number") {
        morenbancais.splice(i + 1, 0, item);
      } else {
        morenbancais.push(item);
      }
      this.morenbancais.set(morenbancais);
    }
  }
  async editMorenbancai(i: number) {
    const morenbancais = this.morenbancais().slice();
    const item = await this.getMorenbancaiItem(i);
    if (item) {
      morenbancais[i] = item;
      this.morenbancais.set(morenbancais);
    }
  }
  async removeMorenbancai(i: number) {
    const morenbancais = this.morenbancais().slice();
    if (!(await this.message.confirm(`确定删除${morenbancais[i].key}吗？`))) {
      return;
    }
    morenbancais.splice(i, 1);
    this.morenbancais.set(morenbancais);
  }

  showMrbcjfzDialog = signal(false);
  private _mrbcjfzResponseData = signal<{id: number; data: MrbcjfzResponseData} | null>(null);
  private _mrbcjfzDialogClose$ = new Subject<MrbcjfzDataSubmitEvent | null>();
  mrbcjfzComponent = viewChild<MrbcjfzComponent>("mrbcjfz");
  mrbcjfzInputData = computed(() => {
    const mokuai = this.mokuai();
    const data = this._mrbcjfzResponseData();
    const morenbancai = cloneDeep(mokuai.morenbancai || {});
    const inputData: MrbcjfzInputData = {
      xinghao: mokuai.name,
      morenbancai,
      cads: this.cads()
    };
    if (data) {
      inputData.resData = data.data;
    }
    return inputData;
  });
  mrbcjfzTable = computed(() => "p_peijianmokuai");
  private async _fetchMrbcjfzResponseData() {
    const mokuai = this.mokuai();
    const resData = this._mrbcjfzResponseData();
    const id = mokuai.id;
    if (resData?.id === mokuai.id) {
      return;
    }
    const table = this.mrbcjfzTable();
    const collection = this.bjmkStatus.collection;
    const data = await this.http.getData<MrbcjfzResponseData>("peijian/xinghao/bancaifenzuIndex", {table, id, collection});
    if (data) {
      this._mrbcjfzResponseData.set({id, data});
    }
  }
  async openMrbcjfzDialog() {
    await this._fetchMrbcjfzResponseData();
    this.showMrbcjfzDialog.set(true);
    return await firstValueFrom(this._mrbcjfzDialogClose$);
  }
  onMrbcjfSubmit(event: MrbcjfzDataSubmitEvent) {
    this._mrbcjfzDialogClose$.next(event);
    this.showMrbcjfzDialog.set(false);
  }
  onMrbcjfClose() {
    this._mrbcjfzDialogClose$.next(null);
    this.showMrbcjfzDialog.set(false);
  }
  async editMrbcjfz() {
    const result = await this.openMrbcjfzDialog();
    if (result) {
      this.mokuai.update((v) => ({...v, morenbancai: result.data.默认板材}));
    }
  }

  private _textInputInfoUpdateDisabled = false;
  private _getTextInputInfo1(key: keyof MokuaiItem, label: string = key) {
    const info: InputInfo<MokuaiItem> = {
      type: "string",
      textarea: {autosize: {minRows: 1, maxRows: 3}},
      label,
      model: {data: this.mokuai(), key},
      onChange: () => {
        if (!this._textInputInfoUpdateDisabled) {
          this.mokuai.update((v) => ({...v}));
        }
      }
    };
    return info;
  }
  private _getTextInputInfo2(key: keyof MokuaiItemCustomData, label: string = key) {
    const mokuai = this.mokuai();
    if (!mokuai.自定义数据) {
      mokuai.自定义数据 = getMokuaiCustomData(null, this.bjmkStatus.mokuaiOptionsManager.data());
    }
    const info: InputInfo<MokuaiItemCustomData> = {
      type: "string",
      textarea: {autosize: {minRows: 1, maxRows: 3}},
      label,
      model: {data: mokuai.自定义数据, key},
      onChange: () => {
        if (!this._textInputInfoUpdateDisabled) {
          this.mokuai.update((v) => ({...v, 自定义数据: clone(v.自定义数据)}));
        }
      }
    };
    return info;
  }
  mokuaiInputInfos = computed(() => [
    this._getTextInputInfo1("gongshishuru", "公式输入"),
    this._getTextInputInfo1("shuchubianliang", "输出变量"),
    this._getTextInputInfo1("xiaoguotushiyongbianliang", "效果图使用变量"),
    this._getTextInputInfo2("下单显示")
  ]);
  shaixuanInputInfos = computed(() => {
    const mokuai = this.mokuai();
    if (!mokuai.自定义数据) {
      mokuai.自定义数据 = getMokuaiCustomData(null, this.bjmkStatus.mokuaiOptionsManager.data());
    }
    const infos: InputInfo<typeof mokuai.自定义数据>[] = [
      {
        type: "object",
        label: "下单时需要满足选项",
        model: {data: mokuai.自定义数据, key: "下单时需要满足选项"},
        clearable: true,
        optionsDialog: {},
        optionMultiple: true,
        optionType: "模块选项"
      }
    ];
    return infos;
  });

  mokuaiOptionsEff = effect(async () => {
    const options = await this.bjmkStatus.mokuaiOptionsManager.fetch();
    const customDataOld = this.mokuai().自定义数据;
    const customDataNew = getMokuaiCustomData(customDataOld, options);
    if (!isEqual(customDataOld, customDataNew)) {
      this.forceUpdateKeys.add("自定义数据");
      this.mokuai.update((v) => ({...v, 自定义数据: customDataNew}));
    }
  });
  async setMokuaiCustomData<T extends keyof MokuaiItemCustomData>(key: T, value: MokuaiItemCustomData[T]) {
    const mokuai = this.mokuai();
    if (!mokuai.自定义数据) {
      mokuai.自定义数据 = getMokuaiCustomData(null, await this.bjmkStatus.mokuaiOptionsManager.fetch());
    }
    mokuai.自定义数据[key] = value;
    this.mokuai.update((v) => ({...v}));
  }

  xuanxiangTable = computed(() => getXuanxiangTable(this.mokuai().自定义数据?.选项数据 || [], {title: ""}, true));
  async getXuanxiangItem(data0?: 选项) {
    const optionsAll = await this.bjmkStatus.mokuaiOptionsManager.fetch();
    return await getXuanxiangItem(this.message, optionsAll, this.xuanxiangTable().data, data0, true);
  }
  async onXuanxiangToolbar(event: ToolbarButtonEvent) {
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getXuanxiangItem();
          if (item) {
            const items = this.mokuai().自定义数据?.选项数据 || [];
            items.push(item);
            this.setMokuaiCustomData("选项数据", items);
          }
        }
        break;
    }
  }
  async onXuanxiangRow(event: RowButtonEvent<XuanxiangTableData>) {
    const mokuai = this.mokuai();
    const {button, rowIdx} = event;
    const items = mokuai.自定义数据?.选项数据 || [];
    const item = items[rowIdx];
    switch (button.event) {
      case "编辑":
        {
          const item2 = await this.getXuanxiangItem(item);
          if (item2) {
            items[rowIdx] = item2;
            this.setMokuaiCustomData("选项数据", items);
          }
        }
        break;
      case "清空数据":
        if (await emptyXuanxiangItem(this.message, item)) {
          this.setMokuaiCustomData("选项数据", items);
        }
        break;
    }
  }

  cadYaoqiu = this.bjmkStatus.cadYaoqiu;
  cadButtons = computed(() => {
    const buttons: CadItemButton<MokuaiItemCadInfo>[] = [
      {
        name: "复制",
        onClick: ({customInfo}) => {
          this.copyCad(customInfo.index);
        }
      },
      {name: "删除", onClick: ({customInfo}) => this.unselectCad(customInfo.index)}
    ];
    return buttons;
  });
  afterEditCad() {
    const mokuai = this.mokuai();
    mokuai.cads = this.cads().map((v) => getHoutaiCad(v));
    this.cd.markForCheck();
  }
  showCadsDialog = signal(false);
  hideCadFormDefaultTexts = signal(false);
  toggleHideCadFormDefaultTexts() {
    this.hideCadFormDefaultTexts.update((v) => !v);
  }
  cads = signal<CadData[]>([]);
  cadsHoutai = computed(() => this.mokuai().cads || []);
  selectedCadsEff = effect(() => {
    this.cads.set(this.cadsHoutai().map((v) => new CadData(v.json)));
  });
  selectCads$ = new Subject<MokuaiCadsComponent | null>();
  async selectCads() {
    const mokuai = this.mokuai();
    const cadsBefore = (mokuai.cads || []).map((v) => new CadData(v.json));
    this.cads.set(cadsBefore);
    this.showCadsDialog.set(true);
    const component = await firstValueFrom(this.selectCads$);
    if (!component) {
      this.cads.set(cadsBefore);
      return;
    }
    const cads: HoutaiCad[] = [];
    for (const cad of this.cads()) {
      delete cad.info.isLocal;
      if (!cad.info.imgId) {
        cad.info.imgId = await this.http.getMongoId();
      }
      cads.push(getHoutaiCad(cad));
    }
    this.mokuai.update((v) => ({...v, cads}));
  }
  async unselectCad(i: number) {
    if (!(await this.message.confirm("是否确定删除？"))) {
      return;
    }
    const cads = this.mokuai().cads || [];
    cads.splice(i, 1);
    this.mokuai.update((v) => ({...v, cads}));
  }
  copyCad(i: number) {
    const cads = this.mokuai().cads || [];
    const names = cads.map((v) => v.名字);
    const cad = new CadData(cads[i].json).clone(true);
    cad.name = getCopyName(names, cad.name);
    cad.info.imgId = null;
    cads.splice(i + 1, 0, getHoutaiCad(cad));
    this.mokuai.update((v) => ({...v, cads}));
  }
  closeCadsDialog(mokuaiCads: MokuaiCadsComponent | null) {
    this.showCadsDialog.set(false);
    this.selectCads$.next(mokuaiCads);
  }
  async importCads(replace: boolean) {
    await this.message.importData(
      replace,
      (data: ObjectOf<any>[]) => {
        const cads = data.map((v) => getHoutaiCad(new CadData(v).clone(true)));
        if (replace) {
          this.mokuai.update((v) => ({...v, cads}));
        } else {
          const mokuai = this.mokuai();
          const cadsOld = mokuai.cads || [];
          mokuai.cads = [...cadsOld, ...cads];
          this.mokuai.set({...mokuai});
        }
        this.cads.set(data.map((v) => new CadData(v)));
      },
      "模块CAD"
    );
  }
  exportCads() {
    this.message.exportData(
      this.cads().map((v) => v.export()),
      "模块CAD"
    );
  }

  cadDragEnabled = signal(false);
  toggleCadDragEnabled() {
    this.cadDragEnabled.update((v) => !v);
  }
  dropCad(event: CdkDragDrop<CadData[]>) {
    const mokuai = this.mokuai();
    const morenbancai = mokuai.morenbancai || {};
    const cads = mokuai.cads || [];
    moveItemInArray(cads || [], event.previousIndex, event.currentIndex);
    mokuai.cads = [...cads];
    const cadIds = cads.map((v) => v._id);
    mokuai.morenbancai = {};
    for (const [key, value] of Object.entries(morenbancai)) {
      value.CAD.sort((a, b) => cadIds.indexOf(a) - cadIds.indexOf(b));
      mokuai.morenbancai[key] = {...value};
    }
    this.mokuai.set({...mokuai});
  }

  isSaved = signal(false);
  close() {
    this.closeOut.emit({isSaved: this.isSaved()});
  }
  slgsComponent = viewChild<FormulasEditorComponent>("slgs");
  forceUpdateKeys = new Set<keyof MokuaiItem>();
  async updateMokaui() {
    const mokuai = this.mokuai();
    const error: ErrorItem = {content: "", details: []};

    const varKeysShuchu = mokuai.shuchubianliang.split("+");
    const varKeysXuanxiang = mokuai.自定义数据?.选项数据.map((v) => v.名字) || [];
    checkDuplicateVars(varKeysShuchu, varKeysXuanxiang, "输出变量", "模块选项", error.details);
    const gongshishuru = getFromulasFromString(mokuai.gongshishuru);
    checkDuplicateVars(Object.keys(gongshishuru), varKeysXuanxiang, "公式输入", "模块选项", error.details);
    const xuanxiangshuru = getFromulasFromString(mokuai.xuanxiangshuru);
    checkDuplicateVars(Object.keys(xuanxiangshuru), varKeysXuanxiang, "选项输入", "模块选项", error.details);
    for (const [i, xxgs1] of mokuai.xuanxianggongshi.entries()) {
      for (const xxgs2 of mokuai.xuanxianggongshi.slice(i + 1)) {
        if (canOptionsOverlap(xxgs1.选项, xxgs2.选项)) {
          const keys1 = Object.keys(xxgs1.公式);
          const keys2 = Object.keys(xxgs2.公式);
          const duplicateVars = intersection(keys1, keys2);
          if (duplicateVars.length > 0) {
            error.details.push([{text: `公式【${xxgs1.名字}】与【${xxgs2.名字}】变量重复：`}, ...getNamesDetail(duplicateVars)]);
          }
        }
      }
    }

    const slgsComponent = this.slgsComponent();
    if (slgsComponent) {
      const formulasResult = await slgsComponent.submitFormulas(slgsComponent.formulaList(), true);
      if (formulasResult.errors.length > 0) {
        error.details.push(...formulasResult.errors.map<ErrorDetail>((v) => [{text: `模块公式：${v}`}]));
      } else {
        mokuai.suanliaogongshi = formulasResult.formulas;
      }
    }

    const purgeStr = (str: string) => str.replaceAll(" ", "");
    mokuai.gongshishuru = purgeStr(mokuai.gongshishuru);
    mokuai.xuanxiangshuru = purgeStr(mokuai.xuanxiangshuru);
    mokuai.shuchubianliang = purgeStr(mokuai.shuchubianliang);

    await this._fetchMrbcjfzResponseData();
    await timeout(0);
    const mrbcjfzErrors = this.mrbcjfzComponent()?.checkSubmit();
    if (mrbcjfzErrors) {
      if (mrbcjfzErrors.length > 0) {
        error.details.push(...mrbcjfzErrors.map<ErrorDetail>((v) => [{text: `板材分组：${v}`}]));
      } else {
        mokuai.morenbancai = this.morenbancais().reduce<ObjectOf<MrbcjfzInfo>>((acc, {key, val}) => {
          acc[key] = val;
          return acc;
        }, {});
      }
    }

    if (error.details.length > 0) {
      await alertError(this.message, error);
      return null;
    }
    return mokuai;
  }
  async save() {
    const mokuai = await this.updateMokaui();
    if (!mokuai) {
      return;
    }
    const mokuaiOld = this.mokuaiIn();
    const mokuaiNew: Partial<MokuaiItem> = {id: mokuai.id, name: mokuai.name};
    const forceUpdateKeys = this.forceUpdateKeys;
    for (const key of keysOf(mokuai)) {
      const val = mokuai[key];
      const valOld = mokuaiOld[key];
      if (forceUpdateKeys.has(key) || !isEqual(val, valOld)) {
        mokuaiNew[key] = val as any;
      }
    }
    forceUpdateKeys.clear();
    await this.bjmkStatus.editMokuai(mokuaiNew, true);
    this.isSaved.set(true);
  }
  async saveAs() {
    const mokuai = await this.updateMokaui();
    if (!mokuai) {
      return;
    }
    await this.bjmkStatus.copyMokuai(mokuai);
  }
  openDdbq() {
    const mokuai = this.mokuai();
    this.status.openInNewTab(["/dingdanbiaoqian"], {queryParams: {ids: mokuai.id, type: "配件模块"}});
  }

  showXhmrmsbjsUsingMokuai() {
    this.bjmkStatus.showXhmrmsbjsUsingMokuai(this.mokuai().id);
  }

  gongnengInputs = viewChildren<InputComponent>("gongnengInputs");
  shaixuanInputs = viewChildren<InputComponent>("shaixuanInputs");
  async clearData(type: string) {
    if (!(await this.message.confirm(`确定清空全部【${type}】数据吗？`))) {
      return;
    }
    const mokuai = this.mokuai();
    this._textInputInfoUpdateDisabled = true;
    switch (type) {
      case "模块功能":
        for (const input of this.gongnengInputs()) {
          input.clear();
        }
        break;
      case "模块筛选":
        for (const input of this.shaixuanInputs()) {
          input.clear();
        }
        break;
      case "选项数据":
        if (mokuai.自定义数据) {
          mokuai.自定义数据.选项数据 = [];
        }
        break;
      case "配件CAD":
        mokuai.cads = [];
        break;
      default:
        return;
    }
    this._textInputInfoUpdateDisabled = false;
    this.mokuai.update((v) => ({...v}));
  }
}
