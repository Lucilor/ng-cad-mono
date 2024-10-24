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
  viewChild
} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {getCopyName} from "@app/app.common";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {openBancaiFormDialog} from "@components/dialogs/bancai-form-dialog/bancai-form-dialog.component";
import {FormulasEditorComponent} from "@components/formulas-editor/formulas-editor.component";
import {CadItemButton} from "@components/lurushuju/cad-item/cad-item.types";
import {ShuruTableDataSorted, XuanxiangTableData} from "@components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.types";
import {
  getShuruItem,
  getShuruTable,
  getXuanxiangItem,
  getXuanxiangTable
} from "@components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.utils";
import {输入, 选项} from "@components/lurushuju/xinghao-data";
import {CadData} from "@lucilor/cad-viewer";
import {keysOf, ObjectOf, timeout} from "@lucilor/utils";
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
import {clone, cloneDeep, isEqual} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {firstValueFrom, Subject} from "rxjs";
import {CadItemComponent} from "../../lurushuju/cad-item/cad-item.component";
import {MokuaiCadsComponent} from "../mokuai-cads/mokuai-cads.component";
import {BjmkStatusService} from "../services/bjmk-status.service";
import {MokuaiItem, MokuaiItemCadInfo, MokuaiItemCloseEvent, MokuaiItemCustomData} from "./mokuai-item.types";
import {getEmptyMokuaiItem, getMokuaiCustomData} from "./mokuai-item.utils";

@Component({
  selector: "app-mokuai-item",
  standalone: true,
  imports: [
    CadImageComponent,
    CadItemComponent,
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
  mokuaiEff = effect(() => this.mokuai.set(cloneDeep(this.mokuaiIn())), {allowSignalWrites: true});
  async editMokuai() {
    const mokuai = this.mokuai();
    const mokuai2 = await this.bjmkStatus.getMokuaiWithForm(mokuai);
    Object.assign(mokuai, mokuai2);
    this.cd.markForCheck();
  }

  morenbancais = signal<{key: string; val: MrbcjfzInfo}[]>([]);
  morenbancaisEff = effect(
    () => {
      const morenbancai = this.mokuai().morenbancai || {};
      this.morenbancais.set(Object.entries(morenbancai).map(([key, val]) => ({key, val})));
    },
    {allowSignalWrites: true}
  );
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
        readonly: true,
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
  private _mrbcjfzResponseData = signal<MrbcjfzResponseData | null>(null);
  private _mrbcjfzDialogClose$ = new Subject<MrbcjfzDataSubmitEvent | null>();
  mrbcjfzComponent = viewChild<MrbcjfzComponent>("mrbcjfz");
  mrbcjfzInputData = computed(() => {
    const mokuai = this.mokuai();
    const data = this._mrbcjfzResponseData();
    const morenbancai = cloneDeep(mokuai.morenbancai || {});
    const inputData: MrbcjfzInputData = {
      xinghao: mokuai.name,
      morenbancai,
      cads: this.selectedCads()
    };
    if (data) {
      inputData.resData = data;
    }
    return inputData;
  });
  private async _fetchMrbcjfzResponseData() {
    const mokuai = this.mokuai();
    this._mrbcjfzResponseData.set(
      await this.http.getData<MrbcjfzResponseData>("peijian/xinghao/bancaifenzuIndex", {
        table: "p_peijianmokuai",
        id: mokuai.id,
        collection: this.bjmkStatus.collection
      })
    );
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

  private _getTextInputInfo1(key: keyof MokuaiItem, label: string = key) {
    const info: InputInfo = {
      type: "string",
      textarea: {autosize: {minRows: 1, maxRows: 3}},
      label,
      model: {data: this.mokuai(), key},
      onChange: () => this.mokuai.update((v) => ({...v}))
    };
    return info;
  }
  private _getTextInputInfo2(key: keyof MokuaiItemCustomData, label: string = key) {
    const mokuai = this.mokuai();
    if (!mokuai.自定义数据) {
      mokuai.自定义数据 = getMokuaiCustomData(null, this.bjmkStatus.mokuaiOptionsManager.data());
    }
    const info: InputInfo = {
      type: "string",
      textarea: {autosize: {minRows: 1, maxRows: 3}},
      label,
      model: {data: mokuai.自定义数据, key},
      onChange: () => this.mokuai.update((v) => ({...v, 自定义数据: clone(v.自定义数据)}))
    };
    return info;
  }
  mokuaiInputInfos = computed(() => [
    this._getTextInputInfo1("gongshishuru", "公式输入"),
    this._getTextInputInfo1("shuchubianliang", "输出变量"),
    this._getTextInputInfo1("xiaoguotushiyongbianliang", "效果图使用变量"),
    this._getTextInputInfo2("下单显示")
  ]);

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

  xuanxiangTable = computed(() => getXuanxiangTable(this.mokuai().自定义数据?.选项数据 || []));
  async getXuanxiangItem(data0?: 选项) {
    const optionsAll = await this.bjmkStatus.mokuaiOptionsManager.fetch();
    return await getXuanxiangItem(this.message, optionsAll, this.xuanxiangTable().data, data0);
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
    const {button, item, rowIdx} = event;
    const items = mokuai.自定义数据?.选项数据 || [];
    switch (button.event) {
      case "编辑":
        {
          const item2 = items[rowIdx];
          const item3 = await this.getXuanxiangItem(item2);
          if (item3) {
            items[rowIdx] = item3;
            this.setMokuaiCustomData("选项数据", items);
          }
        }
        break;
      case "清空数据":
        if (await this.message.confirm(`确定清空【${item.名字}】的数据吗？`)) {
          const item2 = items[rowIdx];
          item2.可选项 = [];
          this.setMokuaiCustomData("选项数据", items);
        }
        break;
    }
  }

  shuruTable = computed(() => {
    return getShuruTable(this.mokuai().自定义数据?.输入数据 || []);
  });
  async getShuruItem(data0?: 输入) {
    return await getShuruItem(this.message, this.shuruTable().data, data0);
  }
  async onShuruToolbar(event: ToolbarButtonEvent) {
    const items = this.mokuai().自定义数据?.输入数据 || [];
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getShuruItem();
          if (item) {
            items.push(item);
            this.setMokuaiCustomData("输入数据", items);
          }
        }
        break;
    }
  }
  async onShuruRow(event: RowButtonEvent<ShuruTableDataSorted>) {
    const items = this.mokuai().自定义数据?.输入数据 || [];
    const {button, item} = event;
    switch (button.event) {
      case "编辑":
        {
          const item2 = items[item.originalIndex];
          const item3 = await this.getShuruItem(item2);
          if (item3) {
            items[item.originalIndex] = item3;
            this.setMokuaiCustomData("输入数据", items);
          }
        }
        break;
      case "删除":
        if (await this.message.confirm(`确定删除【${item.名字}】吗？`)) {
          items.splice(item.originalIndex, 1);
          this.setMokuaiCustomData("输入数据", items);
        }
        break;
    }
  }

  cadYaoqiu = this.bjmkStatus.cadYaoqiu;
  cadButtons = computed(() => {
    const buttons: CadItemButton<MokuaiItemCadInfo>[] = [
      {name: "复制", onClick: ({customInfo}) => this.copyCad(customInfo.index)},
      {name: "删除", onClick: ({customInfo}) => this.unselectCad(customInfo.index)}
    ];
    return buttons;
  });
  afterEditCad() {
    const mokuai = this.mokuai();
    mokuai.cads = this.selectedCads().map((v) => getHoutaiCad(v));
    this.cd.markForCheck();
  }
  showCadsDialog = signal(false);
  selectedCads = signal<CadData[]>([]);
  selectedCadsEff = effect(
    () => {
      const cads = this.mokuai().cads || [];
      this.selectedCads.set(cads.map((v) => new CadData(v.json)));
    },
    {allowSignalWrites: true}
  );
  selectCads$ = new Subject<MokuaiCadsComponent | null>();
  async selectCads() {
    const mokuai = this.mokuai();
    const cadsBefore = (mokuai.cads || []).map((v) => new CadData(v.json));
    this.selectedCads.set(cadsBefore);
    this.showCadsDialog.set(true);
    const component = await firstValueFrom(this.selectCads$);
    if (!component) {
      this.selectedCads.set(cadsBefore);
      return;
    }
    const cads: HoutaiCad[] = [];
    for (const cad of this.selectedCads()) {
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
  async importCads() {
    if (!(await this.message.confirm("导入会替换当前的CAD，是否继续？"))) {
      return;
    }
    await this.message.importData((data: ObjectOf<any>[]) => {
      const cads = data.map((v) => getHoutaiCad(new CadData(v).clone(true)));
      this.mokuai.update((v) => ({...v, cads}));
      this.selectedCads.set(data.map((v) => new CadData(v)));
    }, "模块CAD");
  }
  exportCads() {
    this.message.exportData(
      this.selectedCads().map((v) => v.export()),
      "模块CAD"
    );
  }

  isSaved = signal(false);
  close() {
    this.closeOut.emit({isSaved: this.isSaved()});
  }
  slgsComponent = viewChild<FormulasEditorComponent>("slgs");
  forceUpdateKeys = new Set<keyof MokuaiItem>();
  async updateMokaui() {
    const mokuai = this.mokuai();
    const errors: string[] = [];

    const slgsComponent = this.slgsComponent();
    if (slgsComponent) {
      const formulasResult = await slgsComponent.submitFormulas(slgsComponent.formulaList(), true);
      if (formulasResult.errors.length > 0) {
        errors.push(...formulasResult.errors.map((v) => `模块公式：${v}`));
      } else {
        mokuai.suanliaogongshi = formulasResult.formulas;
      }
    }

    await this._fetchMrbcjfzResponseData();
    await timeout(0);
    const mrbcjfzErrors = this.mrbcjfzComponent()?.checkSubmit();
    if (mrbcjfzErrors) {
      if (mrbcjfzErrors.length > 0) {
        errors.push(...mrbcjfzErrors.map((v) => `板材分组：${v}`));
      } else {
        mokuai.morenbancai = this.morenbancais().reduce<ObjectOf<MrbcjfzInfo>>((acc, {key, val}) => {
          acc[key] = val;
          return acc;
        }, {});
      }
    }

    if (errors.length > 0) {
      await this.message.error(errors.join("<br>"));
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
}
