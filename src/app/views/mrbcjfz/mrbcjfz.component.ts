import {CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray} from "@angular/cdk/drag-drop";
import {KeyValuePipe, NgTemplateOutlet} from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren
} from "@angular/core";
import {ValidationErrors} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {ActivatedRoute} from "@angular/router";
import {setGlobal, XiaodaohangStructure} from "@app/app.common";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {openBancaiFormDialog} from "@components/dialogs/bancai-form-dialog/bancai-form-dialog.component";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf, timeout, WindowMessageManager} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {BancaiList, BancaiListData, TableDataBase, TableUpdateParams} from "@modules/http/services/cad-data.service.types";
import {InputComponent} from "@modules/input/components/input.component";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerComponent} from "@modules/spinner/components/spinner/spinner.component";
import {AppStatusService} from "@services/app-status.service";
import {Properties} from "csstype";
import {isEmpty, union, uniqueId} from "lodash";
import {NgScrollbar} from "ngx-scrollbar";
import {BehaviorSubject, first, lastValueFrom} from "rxjs";
import {ClickStopPropagationDirective} from "../../modules/directives/click-stop-propagation.directive";
import {ImageComponent} from "../../modules/image/components/image/image.component";
import {
  ListItemKey,
  listItemKeys,
  MrbcjfzCadInfo,
  MrbcjfzDataSubmitEvent,
  MrbcjfzHuajianInfo,
  MrbcjfzInfo,
  MrbcjfzInputData,
  MrbcjfzListItem,
  MrbcjfzQiliaoInfo,
  MrbcjfzResponseData,
  MrbcjfzXinghao
} from "./mrbcjfz.types";
import {
  emptyMrbcjfzInfoValues,
  filterCad,
  filterHuajian,
  getEmptyMrbcjfzInfo,
  getMrbcjfzInfo,
  isMrbcjfzInfoEmpty1,
  isMrbcjfzInfoEmpty2,
  MrbcjfzXinghaoInfo
} from "./mrbcjfz.utils";

@Component({
  selector: "app-mrbcjfz",
  templateUrl: "./mrbcjfz.component.html",
  styleUrls: ["./mrbcjfz.component.scss"],
  standalone: true,
  imports: [
    CadImageComponent,
    CdkDrag,
    CdkDropList,
    ClickStopPropagationDirective,
    ImageComponent,
    InputComponent,
    KeyValuePipe,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    NgScrollbar,
    NgTemplateOutlet,
    SpinnerComponent
  ]
})
export class MrbcjfzComponent implements OnInit, OnChanges {
  @HostBinding("class") class = ["ng-page"];

  @Input() id = 0;
  @Input() table = "";
  @Input() closeable = false;
  @Input() inputData?: MrbcjfzInputData;
  @Input() forceSubmit? = false;
  @Output() dataSubmit = new EventEmitter<MrbcjfzDataSubmitEvent>();
  @Output() dataClose = new EventEmitter<void>();
  @Output() refreshAfter = new EventEmitter<void>();
  xinghao: MrbcjfzXinghaoInfo = new MrbcjfzXinghaoInfo(this.table, {vid: 0, mingzi: ""});
  cads: ObjectOf<MrbcjfzCadInfo> = {};
  huajians: ObjectOf<MrbcjfzHuajianInfo> = {};
  qiliaos: ObjectOf<MrbcjfzQiliaoInfo> = {};
  bancaiKeys: string[] = [];
  bancaiKeysNonClear: string[] = [];
  bancaiKeysRequired: string[] = [];
  bancaiList: BancaiList[] = [];
  activeBancaiKey: string | null = null;
  xiaodaohangStructure: XiaodaohangStructure | null = null;
  isFromOrder = false;
  noScroll = false;
  private _isInited = false;
  private _refreshLock$ = new BehaviorSubject<boolean>(false);
  wmm = new WindowMessageManager("默认板材及分组", this, window.parent);
  loaderId = uniqueId("mrbcjfz-loader-");
  get activeBancai() {
    if (!this.activeBancaiKey) {
      return null;
    }
    return this.xinghao.默认板材[this.activeBancaiKey];
  }

  @ViewChildren("bancaiInput") bancaiInputComponents?: QueryList<InputComponent>;

  constructor(
    private route: ActivatedRoute,
    private http: CadDataService,
    private dialog: MatDialog,
    private status: AppStatusService,
    private message: MessageService,
    private cd: ChangeDetectorRef
  ) {
    setGlobal("mrbcjfz", this);
  }

  ngOnInit() {
    if (!this._isInited) {
      this._isInited = true;
      this.refresh();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.inputData) {
      this._isInited = true;
      this.refresh();
    }
  }

  async refresh() {
    if (this._refreshLock$.value) {
      await lastValueFrom(this._refreshLock$.pipe(first((v) => !v)));
    }
    this._refreshLock$.next(true);
    let {id, table} = this;
    if (this.inputData) {
      this.isFromOrder = true;
      const noScroll = !!this.inputData.noScroll;
      this.noScroll = noScroll;
      if (noScroll) {
        if (!this.class.includes("no-scroll")) {
          this.class = [...this.class, "no-scroll"];
        }
      } else {
        this.class = this.class.filter((v) => v !== "no-scroll");
      }
    } else {
      const params = this.route.snapshot.queryParams;
      if (!id || !table) {
        id = params.id ? Number(params.id) : 0;
        table = params.table || "";
        this.id = id;
        this.table = table;
        if (this.id && this.table) {
          this.isFromOrder = false;
        } else {
          this.isFromOrder = true;
        }
      } else {
        await timeout(0);
      }
    }
    if (this.isFromOrder) {
      let data = this.inputData;
      this.bancaiKeys = [];
      let xinghaosRaw: TableDataBase[] | null;
      if (data) {
        xinghaosRaw = [];
      } else {
        data = await this.getData();
        xinghaosRaw = await this.http.queryMySql({table: "p_xinghao", filter: {where: {mingzi: data.xinghao}}}, {spinner: this.loaderId});
      }
      if (xinghaosRaw[0]) {
        this.xinghao = new MrbcjfzXinghaoInfo(this.table, xinghaosRaw[0]);
      } else {
        this.xinghao = new MrbcjfzXinghaoInfo(this.table, {vid: 0, mingzi: data.xinghao});
      }
      let bancaiListData: BancaiListData | null;
      if (data.bancaiList) {
        bancaiListData = data.bancaiList;
      } else {
        bancaiListData = await this.http.getBancaiList(9, {spinner: this.loaderId});
      }
      this.xiaodaohangStructure = {mingzi: "型号", table: "p_xinghao", gongneng: {jiegou: []}};
      if (bancaiListData) {
        this.bancaiList = bancaiListData.bancais;
        this.bancaiKeys = bancaiListData.bancaiKeys;
        this.bancaiKeysNonClear = bancaiListData.bancaiKeysNonClear;
        this.bancaiKeysRequired = bancaiListData.bancaiKeysRequired;
      }
      const cads = data.cads || [];
      const cadIds1 = cads.map((v) => v.id);
      const cadIds2: string[] = [];
      const qiliaoIds1 = bancaiListData?.qiliaos || [];
      const qiliaoIds2: string[] = [];
      const huajianIds1 = (data.huajians || []).map((v) => String(v.vid));
      const huajianIds2: string[] = [];
      for (const key of this.bancaiKeys) {
        if (!data.morenbancai[key]) {
          data.morenbancai[key] = getEmptyMrbcjfzInfo(key);
        }
        const info = data.morenbancai[key];
        info.CAD = info.CAD.filter((v) => cadIds1.includes(v));
        cadIds2.push(...info.CAD);
        info.企料 = info.企料.filter((v) => qiliaoIds1.includes(v));
        qiliaoIds2.push(...info.企料);
        info.花件 = info.花件.filter((v) => huajianIds1.includes(v));
        huajianIds2.push(...info.花件);
      }
      this.xinghao.默认板材 = data.morenbancai;
      this.xinghao.update();
      this.cads = {};
      for (const cad of cads) {
        const info: MrbcjfzCadInfo = {id: cad.id, data: cad};
        info.selected = cadIds2.includes(cad.id);
        this.cads[cad.id] = info;
      }

      this.qiliaos = {};
      for (const qiliao of bancaiListData?.qiliaos || []) {
        this.qiliaos[qiliao] = {id: qiliao, name: qiliao, selected: qiliaoIds2.includes(qiliao)};
      }

      this.huajians = {};
      for (const huajian of data.huajians || []) {
        const vid = String(huajian.vid);
        this.huajians[vid] = {id: vid, data: huajian, selected: huajianIds2.includes(vid)};
      }
    } else {
      const data = await this.http.getData<MrbcjfzResponseData>("peijian/xinghao/bancaifenzuIndex", {table, id}, {spinner: this.loaderId});
      if (data) {
        this.xinghao = new MrbcjfzXinghaoInfo(this.table, data.xinghao);
        this.bancaiKeys = data.bancaiKeys;
        this.bancaiKeysNonClear = union(data.bancaiKeysNonClear, data.bancaiKeysRequired);
        this.bancaiKeysRequired = data.bancaiKeysRequired;
        this.xiaodaohangStructure = data.xiaodaohangStructure;
        this.cads = {};
        const cadsToRemove: MrbcjfzCadInfo[] = [];
        data.cads.forEach((v) => {
          const cadData = new CadData(v);
          const item: MrbcjfzCadInfo = {data: cadData, id: cadData.id};
          if (filterCad(item.data)) {
            this.cads[item.id] = item;
          } else {
            cadsToRemove.push(item);
          }
        });
        this.huajians = {};
        const huajiansToRemove: MrbcjfzHuajianInfo[] = [];
        data.huajians.map((v) => {
          const item: MrbcjfzHuajianInfo = {data: v, id: String(v.vid)};
          if (filterHuajian(item.data)) {
            this.huajians[item.id] = item;
          } else {
            huajiansToRemove.push(item);
          }
        });
        this.qiliaos = {};
        for (const qiliao of data.qiliaos) {
          this.qiliaos[qiliao] = {id: qiliao, name: qiliao};
        }
        const cadsRemoved: string[] = [];
        const huajiansRemoved: string[] = [];
        for (const bancaiKey in this.xinghao.默认板材) {
          const info = this.xinghao.默认板材[bancaiKey];
          const cadIds = info.CAD;
          info.CAD = [];
          for (const cadId of cadIds) {
            if (!this.cads[cadId]) {
              cadsRemoved.push(cadId);
              continue;
            }
            const item = cadsToRemove.find((v) => v.id === cadId);
            if (item && !cadsRemoved.includes(cadId)) {
              cadsRemoved.push(item.data.name);
            }
            info.CAD.push(cadId);
          }
          const huajianIds = info.花件;
          info.花件 = [];
          for (const huajianId of huajianIds) {
            if (!this.huajians[huajianId]) {
              huajiansRemoved.push(huajianId);
              continue;
            }
            const item = huajiansToRemove.find((v) => v.id === huajianId);
            if (item && !huajiansRemoved.includes(huajianId)) {
              huajiansRemoved.push(item.data.mingzi);
              continue;
            }
            info.花件.push(huajianId);
          }
          this.justifyBancai(bancaiKey, info);
        }
        const errorMsgs: string[] = [];
        if (cadsRemoved.length > 0) {
          errorMsgs.push(`删除了以下${cadsRemoved.length}个无效cad: <br>${cadsRemoved.join("，")}`);
        }
        if (huajiansRemoved.length > 0) {
          errorMsgs.push(`删除了以下${huajiansRemoved.length}个无效花件: <br>${huajiansRemoved.join("，")}`);
        }
        this.bancaiList = data.bancaiList;
        this.updateXinghao();
        this.updateListItems();

        if (errorMsgs.length > 0) {
          errorMsgs.push("<br><b>需要提交保存后才生效</b>");
          const result = await this.message.button({
            content: errorMsgs.join("<br>"),
            buttons: ["立刻提交"],
            btnTexts: {cancel: "稍后提交"}
          });
          if (result === "立刻提交") {
            await this.submit();
          }
        }
      }
    }
    this.refreshAfter.emit();
    this._refreshLock$.next(false);
  }

  updateXinghao() {
    const 默认板材 = this.xinghao.默认板材;
    this.xinghao.默认板材 = {};
    for (const key of this.bancaiKeys) {
      const data = getMrbcjfzInfo(默认板材[key]);
      this.xinghao.默认板材[key] = data;
    }
    this.xinghao.update();
  }

  async editBancaiForm(key: string) {
    const info = this.xinghao.默认板材[key];
    const result = await openBancaiFormDialog(this.dialog, {
      data: {
        data: {
          bancai: info.默认开料板材,
          cailiao: info.默认开料材料,
          houdu: info.默认开料板材厚度,
          bancaiList: info.可选板材,
          cailiaoList: info.可选材料,
          houduList: info.可选厚度
        },
        bancaiList: this.bancaiList,
        xinghao: this.xinghao,
        key
      }
    });
    if (result) {
      info.默认开料板材 = result.bancai;
      info.默认开料材料 = result.cailiao;
      info.默认开料板材厚度 = result.houdu;
      info.可选板材 = result.bancaiList || [];
      info.可选材料 = result.cailiaoList || [];
      info.可选厚度 = result.houduList || [];
    }
    this.cd.markForCheck();
  }

  async emptyBancaiForm(key: string) {
    if (!(await this.message.confirm("是否确定清空？"))) {
      return;
    }
    const info = this.xinghao.默认板材[key];
    emptyMrbcjfzInfoValues(key, info, [
      "默认开料材料",
      "默认开料板材",
      "默认开料板材厚度",
      "CAD",
      "企料",
      "花件",
      "可选板材",
      "可选材料",
      "可选厚度",
      "板材分组别名",
      "允许修改",
      "独立变化",
      "不显示"
    ]);
    if (this.activeBancaiKey) {
      this.selectBancaiKey(this.activeBancaiKey);
    }
    this.updateListItems();
    this.cd.markForCheck();
  }

  justifyBancai(key: string, info: MrbcjfzInfo) {
    if (isMrbcjfzInfoEmpty1(key, info) && !this.bancaiKeysNonClear.includes(key)) {
      emptyMrbcjfzInfoValues(key, info, ["默认开料材料", "默认开料板材", "默认开料板材厚度"]);
    }
    if (isMrbcjfzInfoEmpty2(key, info)) {
      emptyMrbcjfzInfoValues(key, info, ["板材分组别名", "允许修改", "独立变化", "不显示"]);
    }
  }

  validateBancai(key: string, info: MrbcjfzInfo) {
    const errors: ValidationErrors = {};
    if (!isMrbcjfzInfoEmpty1(key, info) || this.bancaiKeysRequired.includes(key)) {
      if (isMrbcjfzInfoEmpty2(key, info)) {
        errors.required = true;
      }
    }
    return errors;
  }

  getBancaiStyle(key: string) {
    const info = this.xinghao.默认板材[key];
    const style: Properties = {};
    if (!isEmpty(this.validateBancai(key, info))) {
      style.color = "red";
    }
    return style;
  }

  selectBancaiKey(key: string) {
    if (this.activeBancaiKey !== key) {
      this.activeBancaiKey = key;
      this.updateListItems();
    }
  }

  getList(key: ListItemKey) {
    const list = this[listItemKeysMap[key]];
    if (!list) {
      return {};
    }
    return list;
  }

  updateListItems(key?: ListItemKey) {
    if (!key) {
      for (const key2 of listItemKeys) {
        this.updateListItems(key2);
      }
      return;
    }
    const ids = new Set<string>();
    for (const bancai of Object.values(this.xinghao.默认板材)) {
      for (const id of bancai[key]) {
        ids.add(id);
      }
    }
    const list = this.getList(key);
    for (const item of Object.values(list)) {
      item.selected = ids.has(item.id);
    }
  }

  selectListItem(item: MrbcjfzListItem, key: ListItemKey, bancaiKey?: string) {
    if (bancaiKey) {
      this.selectBancaiKey(bancaiKey);
    }
    const bancai = this.activeBancai;
    if (!bancai) {
      return;
    }
    if (bancai[key].includes(item.id)) {
      bancai[key] = bancai[key].filter((v) => v !== item.id);
    } else {
      bancai[key].push(item.id);
    }
    this.updateListItems(key);
  }

  checkSubmit() {
    const {xinghao, isFromOrder, inputData} = this;
    if (!xinghao) {
      return [];
    }
    const errorMsg: string[] = [];
    const errorBancaiKeys: string[] = [];
    for (const bancaiKey in xinghao.默认板材) {
      const info = xinghao.默认板材[bancaiKey];
      this.justifyBancai(bancaiKey, info);
      const errors = this.validateBancai(bancaiKey, info);
      if (!isEmpty(errors)) {
        errorBancaiKeys.push(bancaiKey);
      }
    }
    if (errorBancaiKeys.length) {
      errorMsg.push(`板材信息不完整：${errorBancaiKeys.join("，")}`);
    }
    if (inputData || !isFromOrder) {
      if (Object.values(this.cads).some((v) => !v.selected)) {
        errorMsg.push("有CAD未选择");
      }
      if (Object.values(this.huajians).some((v) => !v.selected)) {
        errorMsg.push("有花件未选择");
      }
    }
    if (this.bancaiInputComponents) {
      const errorMsg2 = new Set<string>();
      this.bancaiInputComponents.forEach((v) => {
        v.validateValue();
        const errorMsg3 = v.getErrorMsg();
        if (errorMsg3) {
          errorMsg2.add(v.info.label + errorMsg3);
        }
      });
      if (errorMsg2.size > 0) {
        errorMsg.push(`板材输入有误：${Array.from(errorMsg2).join("，")}`);
      }
    }
    return errorMsg;
  }

  async submit(submit2?: boolean) {
    const {xinghao, table, isFromOrder} = this;
    let result = false;
    if (!xinghao) {
      return result;
    }
    const errors = this.checkSubmit();
    if (errors.length && !this.forceSubmit) {
      await this.message.error(errors.join("<br>"));
      return result;
    }
    if (this.inputData) {
      result = true;
    } else {
      const data: TableUpdateParams<MrbcjfzXinghao>["data"] = {vid: xinghao.raw.vid};
      data.morenbancai = JSON.stringify(xinghao.默认板材);
      if (isFromOrder) {
        const response = await this.http.post(
          "peijian/api/updateMorenbancaijifenzu",
          {
            name: xinghao.raw.mingzi,
            morenbancai: xinghao.默认板材
          },
          {spinner: this.loaderId}
        );
        result = response?.code === 0;
      } else {
        result = await this.http.tableUpdate({table, data}, {spinner: this.loaderId});
      }
    }
    this.dataSubmit.emit({data: this.xinghao, errors, submit2});
    return result;
  }

  close() {
    this.dataClose.emit();
  }

  openCad(item: MrbcjfzListItem) {
    this.status.openCadInNewTab(item.id, "cad");
  }

  async getData() {
    this.wmm.postMessage("getDataStart");
    return await this.wmm.waitForMessage<MrbcjfzInputData>("getDataEnd");
  }

  postDataStart() {
    return {action: "postDataEnd"};
  }

  async submitStart() {
    const fulfilled = await this.submit();
    return {action: "submitEnd", data: {fulfilled}};
  }

  returnZero() {
    return 0;
  }

  dropListItem(event: CdkDragDrop<MrbcjfzInfo[ListItemKey]>, key1: string, key2: ListItemKey) {
    const list = this.xinghao.默认板材[key1][key2];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
  }
}

export const listItemKeysMap = {
  CAD: "cads",
  企料: "qiliaos",
  花件: "huajians"
} as const;
