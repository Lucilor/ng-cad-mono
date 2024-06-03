import {CdkDrag} from "@angular/cdk/drag-drop";
import {AfterViewInit, Component, ElementRef, HostBinding, OnInit, ViewChild} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {MatTabChangeEvent, MatTabGroup, MatTabsModule} from "@angular/material/tabs";
import {MatTooltipModule} from "@angular/material/tooltip";
import {
  filePathUrl,
  getBooleanStr,
  getCopyName,
  getFilepathUrl,
  joinOptions,
  local,
  session,
  setGlobal,
  splitOptions
} from "@app/app.common";
import {filterHuajian} from "@app/views/mrbcjfz/mrbcjfz.utils";
import {AboutComponent} from "@components/about/about.component";
import {openCadListDialog} from "@components/dialogs/cad-list/cad-list.component";
import {openZixuanpeijianDialog} from "@components/dialogs/zixuanpeijian/zixuanpeijian.component";
import {ZixuanpeijianInput} from "@components/dialogs/zixuanpeijian/zixuanpeijian.types";
import {FormulasEditorComponent} from "@components/formulas-editor/formulas-editor.component";
import {environment} from "@env";
import {ObjectOf, queryString} from "@lucilor/utils";
import {Subscribed} from "@mixins/subscribed.mixin";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {BancaiListData} from "@modules/http/services/cad-data.service.types";
import {getTableUpdateData} from "@modules/http/services/cad-data.service.utils";
import {ImageComponent} from "@modules/image/components/image/image.component";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo, InputInfoOption, InputInfoSelect} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {TableComponent} from "@modules/table/components/table/table.component";
import {RowButtonEvent, ToolbarButtonEvent} from "@modules/table/components/table/table.types";
import {AppStatusService} from "@services/app-status.service";
import {MrbcjfzComponent} from "@views/mrbcjfz/mrbcjfz.component";
import {MrbcjfzHuajian} from "@views/mrbcjfz/mrbcjfz.types";
import {cloneDeep, debounce, isEqual} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {openMenjiaoDialog} from "../menjiao-dialog/menjiao-dialog.component";
import {MenjiaoInput} from "../menjiao-dialog/menjiao-dialog.types";
import {copySuanliaoData, updateMenjiaoData} from "../menjiao-dialog/menjiao-dialog.utils";
import {openSelectGongyiDialog} from "../select-gongyi-dialog/select-gongyi-dialog.component";
import {openTongyongshujuDialog} from "../tongyongshuju-dialog/tongyongshuju-dialog.component";
import {
  getGongyi,
  getSortedItems,
  getXinghao,
  get算料数据,
  menjiaoCadTypes,
  sortGongyis,
  SuanliaoDataParams,
  updateXinghaoFenleis,
  xiaoguotuKeys,
  Xinghao,
  XinghaoRaw,
  工艺做法,
  算料数据,
  算料数据2,
  输入,
  选项
} from "../xinghao-data";
import {
  LurushujuIndexStep,
  LurushujuIndexStepInfo,
  MenshanOption,
  OptionsAll,
  OptionsAll2,
  ShuruTableData,
  XinghaoData,
  XinghaoGongyi,
  XinghaoMenchuang,
  XinghaoMenchuangs,
  XuanxiangTableData
} from "./lurushuju-index.types";
import {
  getMenjiaoTable,
  getOptions,
  getShuruTable,
  getXinghaoData,
  getXinghaoGongyi,
  getXinghaoMenchuang,
  getXuanxiangTable
} from "./lurushuju-index.utils";

@Component({
  selector: "app-lurushuju-index",
  standalone: true,
  imports: [
    AboutComponent,
    CdkDrag,
    ImageComponent,
    InputComponent,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    MatTooltipModule,
    MrbcjfzComponent,
    NgScrollbarModule,
    TableComponent
  ],
  templateUrl: "./lurushuju-index.component.html",
  styleUrl: "./lurushuju-index.component.scss"
})
export class LurushujuIndexComponent extends Subscribed() implements OnInit, AfterViewInit {
  @HostBinding("class") class = ["ng-page"];

  defaultFenleis = ["单门", "子母对开", "双开"];
  xinghaoMenchuangs: XinghaoMenchuangs = {items: [], count: 0};
  xinghaos: XinghaoData[] = [];
  xinghao: Xinghao | null = null;
  gongyi: 工艺做法 | null = null;
  xinghaoFilterStrKey = "lurushujuXinghaoFilterStr";
  xinghaoFilterStr = session.load<string>(this.xinghaoFilterStrKey) || "";
  tabs: {name: string; hidden?: boolean}[] = [{name: "算料数据"}, {name: "下单选项输入配置"}];
  tabNameKey = "lurushujuTabName";
  tabIndex = 0;
  tabIndexPrev = -1;
  filterInputInfo: InputInfo<this> = {
    type: "string",
    label: "搜索型号",
    clearable: true,
    model: {data: this, key: "xinghaoFilterStr"},
    onInput: debounce(() => {
      this.filterXinghaos();
      session.save(this.xinghaoFilterStrKey, this.xinghaoFilterStr);
    }, 500)
  };
  xinghaoOptionsAll: OptionsAll = {};
  gongyiOptionsAll: OptionsAll = {};
  menjiaoOptionsAll: OptionsAll2 = {};
  xinghaoInputInfos: InputInfo<Xinghao>[] = [];
  xuanxiangTable = getXuanxiangTable();
  shuruTable = getShuruTable();
  menjiaoTable = getMenjiaoTable();
  menshans: MenshanOption[] = [];
  huajians: MrbcjfzHuajian[] = [];
  varNames: FormulasEditorComponent["vars"];
  bancaiList?: BancaiListData;
  btns: {name: string; onClick: () => void}[] = [];
  menuPoitonKey = "lurushujuMenuPosition";
  isMenuDisabled = false;
  isMenchuangEditable = false;

  infoKey = "lurushujuInfo";
  step: LurushujuIndexStep = 1;
  xinghaoName = "";
  fenleiName = "";
  gongyiName = "";
  menjiaoName = "";
  suanliaoDataName = "";
  suanliaoTestName = "";
  production = environment.production;
  @ViewChild(MrbcjfzComponent) mrbcjfz?: MrbcjfzComponent;
  @ViewChild(MatTabGroup) tabGroup?: MatTabGroup;
  @ViewChild("menu") menu?: ElementRef<HTMLDivElement>;

  private _isDataFetched: ObjectOf<boolean> = {};

  constructor(
    private http: CadDataService,
    private message: MessageService,
    private dialog: MatDialog,
    private status: AppStatusService
  ) {
    super();
    setGlobal("lrsj", this, true);
  }

  async ngOnInit() {
    this.subscribe(this.status.changeProject$, () => {
      const info = session.load<ReturnType<typeof this.getInfo>>(this.infoKey);
      if (info && !info.changeProject) {
        session.remove(this.infoKey);
      }
    });
    await this.updateBtns();
    const info = session.load<ReturnType<typeof this.getInfo>>(this.infoKey);
    if (info) {
      session.remove(this.infoKey);
      await this.setInfo(info);
    } else {
      await this.setStep(1, {});
    }
  }

  ngAfterViewInit() {
    if (this.menu) {
      const [x, y] = local.load<[number, number]>(this.menuPoitonKey) || [0, 0];
      const el = this.menu.nativeElement;
      el.style.left = x + "px";
      el.style.top = y + "px";
    }
  }

  get isKailiao() {
    if (typeof this.xinghao?.是否需要激光开料 === "boolean") {
      return this.xinghao.是否需要激光开料;
    }
    return this.status.projectConfig.getBoolean("新版本做数据可以做激光开料");
  }

  async getXinghaos() {
    const xinghaos = await this.http.getData<XinghaoData[]>("shuju/api/getXinghaos");
    const fields = ["vid", "mingzi"];
    const menchuangs = await this.http.queryMySql<XinghaoMenchuang>({table: "p_menchuang", fields});
    const gongyis = await this.http.queryMySql<XinghaoGongyi>({table: "p_gongyi", fields: [...fields, "menchuang"]});
    const iPrev = this.xinghaoMenchuangs.index;
    const jPrev = this.xinghaoMenchuangs.items[this.xinghaoMenchuangs.index ?? -1]?.gongyis?.index;
    this.xinghaoMenchuangs.items = [];
    for (const menchuang of menchuangs) {
      const xinghaoMenchuang = getXinghaoMenchuang(menchuang);
      xinghaoMenchuang.gongyis = {items: [], count: 0};
      this.xinghaoMenchuangs.items.push(xinghaoMenchuang);
      for (const gongyi of gongyis) {
        const menchuangIds = splitOptions(String(gongyi.menchuang)).map(Number);
        if (!menchuangIds.includes(menchuang.vid)) {
          continue;
        }
        const xinghaoGongyi = getXinghaoGongyi(gongyi);
        xinghaoMenchuang.gongyis.items.push(xinghaoGongyi);
      }
    }
    if (xinghaos) {
      for (const xinghao of xinghaos) {
        const {menchuang, gongyi} = xinghao;
        const menchuangs = splitOptions(menchuang);
        const gongyis = splitOptions(gongyi);
        const menchuangItems = this.xinghaoMenchuangs.items.filter((v) => menchuangs.includes(v.mingzi));
        for (const menchuangItem of menchuangItems) {
          const gongyiItems = menchuangItem.gongyis?.items.filter((v) => gongyis.includes(v.mingzi));
          for (const gongyiItem of gongyiItems || []) {
            if (!gongyiItem.xinghaos) {
              gongyiItem.xinghaos = {items: [], count: 0};
            }
            gongyiItem.xinghaos.items.push(xinghao);
          }
        }
      }
      this.filterXinghaos();
      this.clikcXinghaoGongyi(iPrev ?? 0, jPrev ?? 0);
    }
  }

  filterXinghaos() {
    const str = this.xinghaoFilterStr;
    const menchuangs = this.xinghaoMenchuangs;
    menchuangs.count = 0;
    const foundGongyis: [number, number][] = [];
    for (const [i, menchuang] of menchuangs.items.entries()) {
      if (!menchuang.gongyis) {
        menchuang.gongyis = {items: [], count: 0};
      }
      const gongyis = menchuang.gongyis;
      gongyis.count = 0;
      for (const [j, gongyi] of gongyis.items.entries()) {
        if (!gongyi.xinghaos) {
          gongyi.xinghaos = {items: [], count: 0};
        }
        const xinghaos = gongyi.xinghaos;
        xinghaos.count = 0;
        for (const xinghao of xinghaos.items) {
          xinghao.hidden = !queryString(str, xinghao.mingzi);
          if (!xinghao.hidden) {
            xinghaos.count++;
            gongyis.count++;
            menchuangs.count++;
          }
        }
        if (xinghaos.count) {
          foundGongyis.push([i, j]);
        }
      }
    }
    if (str) {
      const foundCount = foundGongyis.length;
      if (foundCount < 1) {
        this.message.snack("搜索不到数据");
      } else if (foundCount === 1) {
        const [i, j] = foundGongyis[0];
        this.clikcXinghaoGongyi(i, j);
      }
    }
  }

  async getXinghao() {
    const xinghaoRaw = await this.http.getData<XinghaoRaw>("shuju/api/getXinghao", {名字: this.xinghaoName});
    const xinghao = getXinghao(xinghaoRaw);
    this.xinghao = xinghao;
    await this.updateXinghao(xinghaoRaw?.产品分类);
  }

  async addXinghao() {
    const result = await this.getXinghaoItem();
    if (!result) {
      return;
    }
    const xinghao = await this.http.getData<XinghaoData>("shuju/api/insertXinghao", {名字: result.data.mingzi});
    if (xinghao) {
      result.mingziOld = result.data.mingzi;
      await this.editXinghaoByResult(result, xinghao);
      this.getXinghaos();
    }
  }

  enterXinghao(xinghao: XinghaoData) {
    this.xinghao = null;
    this.setStep(2, {xinghaoName: xinghao.mingzi});
  }

  async getXinghaoItem(xinghao?: XinghaoData) {
    const data: XinghaoData = xinghao ? cloneDeep(xinghao) : getXinghaoData();
    if (!data.算料单模板) {
      data.算料单模板 = this.status.projectConfig.get("新做数据算料单排版默认方案") || "自动排版模板";
    }
    if (typeof data.是否需要激光开料 !== "boolean") {
      data.是否需要激光开料 = this.isKailiao;
    }
    const menchuang = this.xinghaoMenchuangs.items[this.xinghaoMenchuangs.index ?? -1];
    const gongyi = menchuang?.gongyis?.items[menchuang?.gongyis.index ?? -1];
    if (!data.menchuang && menchuang) {
      data.menchuang = menchuang.mingzi;
    }
    if (!data.gongyi && gongyi) {
      data.gongyi = gongyi.mingzi;
    }

    const data2: XinghaoRaw = {
      名字: data.mingzi,
      所属门窗: data.menchuang,
      所属工艺: data.gongyi,
      订单流程: data.dingdanliucheng,
      算料单模板: data.算料单模板,
      是否需要激光开料: data.是否需要激光开料
    };
    const mingziOld = data.mingzi;
    const names = this.xinghaos.map((xinghao) => xinghao.mingzi);
    let refreshOptions = false;
    const getOptionInput = (key1: string, key2: string, multiple?: boolean) => {
      const info: InputInfoSelect = {
        type: "select",
        label: key1,
        multiple,
        validators: Validators.required,
        options: this.getOptions(key1),
        optionsDialog: {
          optionKey: key1,
          useLocalOptions: true,
          openInNewTab: true,
          onChange: () => {
            refreshOptions = true;
          }
        }
      };
      if (multiple && info.optionsDialog) {
        info.value = splitOptions((data2 as any)[key2]);
        info.optionsDialog.onChange = (val) => {
          (data2 as any)[key2] = joinOptions(val.options, "*");
        };
      } else {
        info.model = {data: data2, key: key2};
      }
      return info;
    };
    const form: InputInfo[] = [
      {
        type: "string",
        label: "名字",
        model: {data: data, key: "mingzi"},
        validators: [
          (control) => {
            const value = control.value;
            if (!value) {
              return {名字不能为空: true};
            }
            if (names.includes(value) && value !== mingziOld) {
              return {名字已存在: true};
            }
            return null;
          }
        ]
      },
      {
        type: "image",
        label: "图片",
        value: data.tupian,
        prefix: filePathUrl,
        clearable: true,
        onChange: async (val, info) => {
          if (val) {
            const result = await this.http.uploadImage(val);
            if (result?.url) {
              info.value = result.url;
              data.tupian = result.url;
            }
          } else {
            info.value = "";
            data.tupian = "";
          }
        }
      },
      getOptionInput("门窗", "所属门窗", true),
      getOptionInput("工艺", "所属工艺", true),
      getOptionInput("订单流程", "订单流程"),
      {
        type: "select",
        label: "算料单模板",
        model: {data: data2, key: "算料单模板"},
        options: ["自动排版模板", "手动装配配件模板", "混合模板"]
      },
      {
        type: "boolean",
        label: "是否需要激光开料",
        model: {data: data2, key: "是否需要激光开料"},
        validators: Validators.required
      },
      {type: "number", label: "排序", model: {data, key: "paixu"}},
      {type: "boolean", label: "停用", model: {data, key: "tingyong"}}
    ];
    const result = await this.message.form(form);
    if (result) {
      if (refreshOptions) {
        this._isDataFetched.xinghaoOptionsAll = false;
        await this.getXinghaoOptionsAllIfNotFetched();
      }
      data.menchuang = data2.所属门窗 || "";
      data.gongyi = data2.所属工艺 || "";
      return {data, data2, mingziOld};
    }
    return null;
  }

  async editXinghao(xinghao: XinghaoData) {
    const result = await this.getXinghaoItem(xinghao);
    if (result) {
      await this.editXinghaoByResult(result, xinghao);
    }
  }

  async editXinghaoByResult(result: NonNullable<Awaited<ReturnType<typeof this.getXinghaoItem>>>, xinghao: XinghaoData) {
    const {data, data2, mingziOld} = result;
    data2.名字 = data.mingzi;
    const response = await this.http.post("shuju/api/editXinghao", {mingziOld, data: {...xinghao, ...data}});
    if (response?.code === 0) {
      const response2 = await this.setXinghao(data2, true, data2.名字);
      if (response2?.code === 0) {
        await this.getXinghaos();
      }
    }
  }

  async copyXinghao(xinghao: XinghaoData) {
    const from = xinghao.mingzi;
    if (!(await this.message.confirm(`确定复制选中${from}吗？`))) {
      return;
    }
    const names = this.xinghaos.map((v) => v.mingzi);
    const to = getCopyName(names, from);
    const success = await this.http.getData<boolean>("shuju/api/copyXinghao", {from, to}, {spinner: false});
    if (success) {
      await this.getXinghaos();
    }
  }

  async removeXinghao(xinghao: XinghaoData) {
    const name = xinghao.mingzi;
    if (!(await this.message.confirm("删除不可恢复，请慎重操作"))) {
      return;
    }
    const success = await this.http.getData<boolean>("shuju/api/removeXinghao", {name});
    if (success) {
      await this.getXinghaos();
    }
  }

  async back() {
    switch (this.step) {
      case 1:
        break;
      case 2:
        await this.setStep(1, {});
        break;
      case 3:
        await this.setStep(2, {xinghaoName: this.xinghaoName});
        break;
    }
  }

  async setStep<T extends LurushujuIndexStep>(step: T, stepInfo: LurushujuIndexStepInfo[T]) {
    this.step = step;
    const stepInfo2: ObjectOf<any> = {...stepInfo};
    for (const key of ["xinghaoName", "fenleiName", "gongyiName"]) {
      if (!(key in stepInfo2)) {
        stepInfo2[key] = "";
      }
    }
    Object.assign(this, stepInfo2);
    this.saveInfo();
    if (!this.xinghaoName) {
      this.xinghao = null;
    }
    if (!this.gongyiName) {
      this.gongyi = null;
    }
    await Promise.all([this.setStep1(), this.setStep2(), this.setStep3()]);
  }

  async getDataIfNotFetched(key: string, fn: () => Promise<any>) {
    if (!this._isDataFetched[key]) {
      await fn();
      this._isDataFetched[key] = true;
    }
  }
  async getXinghaosIfNotFetched() {
    await this.getDataIfNotFetched("xinghaos", async () => {
      await this.getXinghaos();
    });
  }

  async getXinghaoOptionsAllIfNotFetched() {
    await this.getDataIfNotFetched("xinghaoOptionsAll", async () => {
      const optionsAll = await this.http.getData<OptionsAll>("shuju/api/getXinghaoOption");
      this.xinghaoOptionsAll = optionsAll || {};
    });
  }

  async getGongyiOptionsAllIfNotFetched() {
    await this.getDataIfNotFetched("gongyiOptionsAll", async () => {
      const optionsAll = await this.http.getData<OptionsAll>("shuju/api/getGongyizuofaOption");
      this.gongyiOptionsAll = optionsAll || {};
    });
  }

  async getMenjiaoOptionsAllIfNotFetched() {
    await this.getDataIfNotFetched("menjiaoOptionsAll", async () => {
      const optionsAll = await this.http.getData<OptionsAll2>("shuju/api/getMenjiaoOptions");
      this.menjiaoOptionsAll = optionsAll || {};
    });
  }

  async geVarNamesAllIfNotFetched() {
    await this.getDataIfNotFetched("varNames", async () => {
      const varNames = await this.http.getData<typeof this.varNames>("shuju/api/getVarNames");
      this.varNames = varNames || undefined;
    });
  }

  async getBancaiListIfNotFetched() {
    await this.getDataIfNotFetched("bancaiList", async () => {
      const bancaiList = await this.http.getBancaiList(6);
      this.bancaiList = bancaiList || undefined;
    });
  }

  async setStep1() {
    const step = 1;
    if (this.step !== step) {
      return;
    }
    await Promise.all([this.getXinghaosIfNotFetched(), this.getXinghaoOptionsAllIfNotFetched()]);
  }

  async setStep2() {
    const step = 2;
    if (this.step !== step) {
      this.xinghaoInputInfos = [];
      return;
    }
    this.xinghaoInputInfos = [];
    await Promise.all([this.getXinghaosIfNotFetched(), this.getXinghaoOptionsAllIfNotFetched()]);
    if (!this.xinghao) {
      await this.getXinghao();
    }
    if (!this.xinghao) {
      return;
    }
    const {xinghao} = this;
    const onChange = debounce(async (data: Partial<Xinghao>) => {
      await this.setXinghao(data);
    }, 500);
    this.xinghaoInputInfos = [
      {
        type: "select",
        label: "产品分类",
        model: {data: xinghao, key: "显示产品分类"},
        options: this.getOptions("产品分类"),
        multiple: true,
        onChange: (val) => {
          const data: Partial<Xinghao> = {显示产品分类: val};
          let updateFenlei = false;
          for (const name of val) {
            if (this.xinghao && !Array.isArray(this.xinghao.产品分类[name])) {
              this.xinghao.产品分类[name] = [];
              updateFenlei = true;
            }
          }
          if (updateFenlei) {
            data.产品分类 = this.xinghao?.产品分类;
          }
          onChange(data);
        },
        style: {width: "0", flex: "1 1 200px"}
      }
    ];
    await this.updateXinghao(xinghao?.产品分类);
  }

  async setStep3() {
    const step = 3;
    if (this.step !== step) {
      return;
    }
    if (!this.production) {
      const tabName = session.load<string>(this.tabNameKey);
      this.openTab(tabName || "");
    }
    await Promise.all([
      this.getXinghaosIfNotFetched(),
      this.getXinghaoOptionsAllIfNotFetched(),
      this.getGongyiOptionsAllIfNotFetched(),
      this.getMenjiaoOptionsAllIfNotFetched(),
      this.geVarNamesAllIfNotFetched(),
      this.getBancaiListIfNotFetched()
    ]);
    if (!this.xinghao) {
      await this.getXinghao();
    }
    if (!this.xinghao) {
      return;
    }
    this.menshans =
      (
        await this.http.getOptions<MenshanOption>({
          name: "p_menshan",
          fields: ["zuchenghuajian"]
        })
      )?.data || [];
    let gongyi = this.xinghao.产品分类[this.fenleiName].find((v) => v.名字 === this.gongyiName);
    if (!gongyi) {
      this.gongyi = null;
      return;
    }
    gongyi = getGongyi(gongyi, this.gongyiOptionsAll);
    this.gongyi = gongyi;
    this.xuanxiangTable.data = [...gongyi.选项数据];
    this.shuruTable.data = getSortedItems(gongyi.输入数据);
    this.menjiaoTable.data = gongyi.算料数据;

    await this.updateHuajians();
  }

  getOptions(key: string) {
    const {xinghaoOptionsAll} = this;
    return getOptions(xinghaoOptionsAll, key, (option) => {
      if (key === "产品分类") {
        option.disabled = this.defaultFenleis.includes(option.value);
      }
    });
  }

  openTab(name: string) {
    const tabs = this.tabGroup?._tabs.toArray();
    let tabIndex: number;
    if (tabs) {
      tabIndex = tabs.findIndex((v) => v.textLabel === name);
    } else {
      tabIndex = this.tabs.filter((v) => !v.hidden).findIndex((v) => v.name === name);
    }
    if (tabIndex >= 0) {
      this.tabIndex = tabIndex;
    } else if (name) {
      this.message.error("未找到对应的标签页：" + name);
    }
  }

  onSelectedTabChange({index, tab}: MatTabChangeEvent) {
    const tabName = tab.textLabel;
    if (tabName) {
      session.save(this.tabNameKey, tabName);
    }
    this.tabIndexPrev = index;
  }

  async setXinghao(data: Partial<Xinghao>, silent?: boolean, name = this.xinghao?.名字) {
    return await this.http.post("shuju/api/setXinghao", {名字: name, data, silent}, {spinner: false});
  }

  async updateXinghao(产品分类?: Xinghao["产品分类"]) {
    if (!this.xinghao) {
      return;
    }
    if (产品分类) {
      this.xinghao.产品分类 = 产品分类;
    }
    const fenleisBefore = cloneDeep(this.xinghao.产品分类);
    const allFenleis = this.xinghaoOptionsAll.产品分类.map((v) => v.name);
    const 选项要求 = this.menjiaoOptionsAll.选项要求?.options || [];
    updateXinghaoFenleis(this.xinghao, allFenleis, this.defaultFenleis, 选项要求);
    const fenleisAfter = this.xinghao.产品分类;
    if (!isEqual(fenleisBefore, fenleisAfter)) {
      await this.setXinghao({产品分类: fenleisAfter}, true);
    }
  }

  async addGongyi(产品分类: string) {
    if (!this.xinghao) {
      return;
    }
    const names = this.xinghao.产品分类[产品分类].map((gongyi) => gongyi.名字);
    const 名字 = await this.message.prompt({
      type: "string",
      label: "新建工艺做法",
      validators: (control) => {
        const value = control.value;
        if (!value) {
          return {名字不能为空: true};
        }
        if (names.includes(value)) {
          return {名字已存在: true};
        }
        return null;
      }
    });
    if (!名字) {
      return;
    }
    const 型号 = this.xinghao.名字;
    const xinghaoRaw = await this.http.getData<XinghaoRaw>("shuju/api/addGongyi", {名字, 型号, 产品分类});
    await this.updateXinghao(xinghaoRaw?.产品分类);
  }

  async removeGongyi(产品分类: string, 名字: string) {
    if (!this.xinghao || !(await this.message.confirm("确定删除选中的工艺做法吗？"))) {
      return;
    }
    const 型号 = this.xinghao.名字;
    const xinghaoRaw = await this.http.getData<XinghaoRaw>("shuju/api/removeGongyi", {名字, 型号, 产品分类});
    await this.updateXinghao(xinghaoRaw?.产品分类);
  }

  async copyGongyi(产品分类: string, 名字: string) {
    if (!this.xinghao) {
      return;
    }
    const names = this.xinghao.产品分类[产品分类].map((gongyi) => gongyi.名字);
    let 复制名字 = await this.message.prompt({
      type: "string",
      label: "复制工艺做法",
      hint: "若留空则自动生成名字",
      validators: (control) => {
        const value = control.value;
        if (names.includes(value)) {
          return {名字已存在: true};
        }
        if (value === 名字) {
          return {不能与原名字相同: true};
        }
        return null;
      }
    });
    if (复制名字 === null) {
      return;
    }
    if (!复制名字) {
      复制名字 = getCopyName(names, 名字);
    }
    const 型号 = this.xinghao.名字;
    const xinghaoRaw = await this.http.getData<XinghaoRaw>("shuju/api/copyGongyi", {名字, 复制名字, 型号, 产品分类});
    await this.updateXinghao(xinghaoRaw?.产品分类);
  }

  async editGongyi(产品分类: string, 名字: string) {
    if (!this.xinghao) {
      return;
    }
    const gongyis = this.xinghao.产品分类[产品分类];
    const data0 = gongyis.find((gongyi) => gongyi.名字 === 名字);
    if (!data0) {
      return;
    }
    const data = cloneDeep(data0);
    const form: InputInfo<Partial<工艺做法>>[] = [
      {type: "string", label: "名字", model: {data, key: "名字"}, validators: Validators.required},
      {
        type: "image",
        label: "图片",
        value: data.图片,
        prefix: filePathUrl,
        clearable: true,
        onChange: async (val, info) => {
          if (val) {
            const result = await this.http.uploadImage(val);
            if (result?.url) {
              info.value = result.url;
              data.图片 = result.url;
            }
          } else {
            info.value = "";
            data.图片 = "";
          }
        }
      },
      {type: "boolean", label: "停用", model: {data, key: "停用"}},
      {type: "number", label: "排序", model: {data, key: "排序"}},
      {type: "boolean", label: "录入完成", model: {data, key: "录入完成"}},
      {type: "boolean", label: "默认值", model: {data, key: "默认值"}}
    ];
    const result = await this.message.form(form);
    if (result) {
      const updateDatas: ObjectOf<typeof result> = {[名字]: result};
      if (result.默认值) {
        for (const gongyi of gongyis) {
          if (gongyi.名字 !== 名字) {
            gongyi.默认值 = false;
            updateDatas[gongyi.名字] = {默认值: false};
          }
        }
      }
      const 型号 = this.xinghao.名字;
      const success = await this.http.post<boolean>("shuju/api/editGongyi", {型号, 产品分类, updateDatas});
      if (success) {
        const mingziOld = data0.名字;
        const mingziNew = data.名字;
        if (mingziOld !== mingziNew) {
          const params = {xinghao: this.xinghaoName, fenlei: 产品分类, mingziOld, mingziNew};
          await this.http.getData("shuju/api/onGongyiNameChange", params);
        }
        const paixu1 = data0.排序;
        const paixu2 = data.排序;
        Object.assign(data0, result);
        if (paixu1 !== paixu2) {
          sortGongyis(gongyis);
          this.setXinghao({产品分类: this.xinghao.产品分类}, true);
        }
      }
    }
  }

  editGongyi2(fenleiName: string, gongyiName: string) {
    this.setStep(3, {xinghaoName: this.xinghaoName, fenleiName, gongyiName});
  }

  async copyGongyi2() {
    const {xinghao, xinghaoMenchuangs} = this;
    if (!xinghao) {
      return;
    }
    const result = await openSelectGongyiDialog(this.dialog, {
      data: {xinghaoMenchuangs, xinghaoOptions: this.xinghaoOptionsAll, multiple: true}
    });
    if (!result) {
      return;
    }
    const targetFenlei = await this.message.prompt<string>({
      type: "select",
      label: "复制到哪个分类",
      options: xinghao.显示产品分类,
      hint: "若留空则复制到对应分类"
    });
    if (targetFenlei === null) {
      return;
    }
    let successCount = 0;
    const 型号2 = xinghao.名字;
    const gongyiNames: ObjectOf<string[]> = {};
    for (const item of result.items) {
      const {型号, 产品分类, 名字} = item;
      const 产品分类2 = targetFenlei || 产品分类;
      if (!gongyiNames[产品分类2]) {
        gongyiNames[产品分类2] = xinghao.产品分类[产品分类2].map((v) => v.名字);
      }
      const 复制名字 = getCopyName(gongyiNames[产品分类2], item.名字);
      const success = await this.http.getData<boolean>("shuju/api/copyGongyi", {名字, 复制名字, 型号, 型号2, 产品分类, 产品分类2});
      if (success) {
        gongyiNames[产品分类2].push(复制名字);
        successCount++;
      }
    }
    if (successCount > 0) {
      await this.getXinghao();
      const data = this.xinghao?.产品分类[targetFenlei]?.at(-1);
      if (data) {
        for (const menjiaoData of data.算料数据) {
          updateMenjiaoData(menjiaoData);
        }
        await this.submitGongyi(["算料数据"], targetFenlei, data.名字);
      }
    }
  }

  getFilepathUrl(url: string) {
    return getFilepathUrl(url);
  }

  getBooleanStr(value: boolean) {
    return getBooleanStr(value);
  }

  async submitGongyi(fields: (keyof 工艺做法)[], 产品分类?: string, 名字?: string) {
    const {xinghaoName: 型号} = this;
    const data: Partial<工艺做法> = {};
    let gongyi: 工艺做法 | undefined | null;
    if (产品分类 && 名字) {
      gongyi = this.xinghao?.产品分类[产品分类]?.find((v) => v.名字 === 名字);
    } else {
      gongyi = this.gongyi;
      产品分类 = this.fenleiName;
      名字 = this.gongyiName;
    }
    if (!gongyi || !Array.isArray(fields) || fields.length === 0) {
      return;
    }
    for (const field of fields) {
      data[field] = gongyi[field] as any;
    }
    const response = await this.http.post("shuju/api/editGongyi", {型号, 产品分类, updateDatas: {[名字]: data}}, {spinner: false});
    if (response?.code === 0 && this.xinghao) {
      const item = this.xinghao.产品分类[产品分类].find((v) => v.名字 === 名字);
      if (item) {
        Object.assign(item, data);
      }
    }
  }

  async getXuanxiangItem(data0?: 选项) {
    const data: 选项 = {名字: "", 可选项: [], ...data0};
    const names = this.xuanxiangTable.data.map((v) => v.名字);
    const form: InputInfo<typeof data>[] = [
      {
        type: "select",
        label: "名字",
        model: {data, key: "名字"},
        disabled: !!data0,
        options: Object.keys(this.gongyiOptionsAll).map<InputInfoOption>((v) => {
          return {value: v, disabled: names.includes(v)};
        }),
        validators: Validators.required,
        onChange: () => {
          const info = form[1] as InputInfoSelect;
          if (Array.isArray(info.value)) {
            info.value.length = 0;
          }
          if (info.optionsDialog) {
            info.optionsDialog.optionKey = data.名字;
          }
        }
      },
      {
        type: "select",
        label: "可选项",
        value: data.可选项.map((v) => v.mingzi),
        options: [],
        multiple: true,
        validators: Validators.required,
        optionsDialog: {
          optionKey: data.名字,
          openInNewTab: true,
          defaultValue: {value: data.可选项.find((v) => v.morenzhi)?.mingzi, required: true},
          onChange: (val) => {
            data.可选项 = val.options.map((v) => {
              const item: 选项["可选项"][number] = {...v};
              if (item.mingzi === val.defaultValue) {
                item.morenzhi = true;
              }
              return item;
            });
          }
        }
      }
    ];
    const result = await this.message.form(form);
    return result ? data : null;
  }

  async onXuanxiangToolbar(event: ToolbarButtonEvent) {
    if (!this.gongyi) {
      return;
    }
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getXuanxiangItem();
          if (item) {
            this.gongyi.选项数据.push(item);
            this.xuanxiangTable.data = [...this.gongyi.选项数据];
            await this.submitGongyi(["选项数据"]);
          }
        }
        break;
    }
  }

  async onXuanxiangRow(event: RowButtonEvent<XuanxiangTableData>) {
    if (!this.gongyi) {
      return;
    }
    const {button, item, rowIdx} = event;
    switch (button.event) {
      case "编辑":
        {
          const item2 = this.gongyi.选项数据[rowIdx];
          const item3 = await this.getXuanxiangItem(item2);
          if (item3) {
            this.gongyi.选项数据[rowIdx] = item3;
            this.xuanxiangTable.data = [...this.gongyi.选项数据];
            await this.submitGongyi(["选项数据"]);
          }
        }
        break;
      case "清空数据":
        if (await this.message.confirm(`确定清空【${item.名字}】的数据吗？`)) {
          const item2 = this.gongyi.选项数据[rowIdx];
          item2.可选项 = [];
          this.xuanxiangTable.data = [...this.gongyi.选项数据];
          await this.submitGongyi(["选项数据"]);
        }
        break;
    }
  }

  async getShuruItem(data0?: 输入) {
    const data: 输入 = {名字: "", 默认值: "", 取值范围: "", 可以修改: true, ...data0};
    const form: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "名字"},
        validators: [
          Validators.required,
          (control) => {
            const value = control.value;
            if ((!data0 || data0.名字 !== value) && this.gongyi?.输入数据.some((v) => v.名字 === value)) {
              return {名字已存在: true};
            }
            return null;
          }
        ]
      },
      {
        type: "string",
        label: "默认值",
        model: {data, key: "默认值"},
        validators: Validators.required
      },
      {
        type: "string",
        label: "取值范围",
        model: {data, key: "取值范围"},
        validators: [
          Validators.required,
          (control) => {
            const value = control.value;
            if (!/^\d+(.\d+)?-\d+(.\d+)?$/.test(value)) {
              return {取值范围不符合格式: true};
            }
            return null;
          }
        ]
      },
      {type: "boolean", label: "可以修改", model: {data, key: "可以修改"}},
      {type: "number", label: "排序", model: {data, key: "排序"}}
    ];
    return await this.message.form<typeof data, typeof data>(form);
  }

  async onShuruToolbar(event: ToolbarButtonEvent) {
    if (!this.gongyi) {
      return;
    }
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getShuruItem();
          if (item) {
            this.gongyi.输入数据.push(item);
            this.shuruTable.data = getSortedItems(this.gongyi.输入数据);
            await this.submitGongyi(["输入数据"]);
          }
        }
        break;
    }
  }

  async onShuruRow(event: RowButtonEvent<ShuruTableData>) {
    if (!this.gongyi) {
      return;
    }
    const {button, item} = event;
    switch (button.event) {
      case "编辑":
        {
          const item2 = this.gongyi.输入数据[item.originalIndex];
          const item3 = await this.getShuruItem(item2);
          if (item3) {
            this.gongyi.输入数据[item.originalIndex] = item3;
            this.shuruTable.data = getSortedItems(this.gongyi.输入数据);
            await this.submitGongyi(["输入数据"]);
          }
        }
        break;
      case "删除":
        if (await this.message.confirm(`确定删除【${item.名字}】吗？`)) {
          this.gongyi.输入数据.splice(item.originalIndex, 1);
          this.shuruTable.data = getSortedItems(this.gongyi.输入数据);
          await this.submitGongyi(["输入数据"]);
        }
        break;
    }
  }

  getMenjiaoId() {
    const numVids = this.gongyi?.算料数据.map((v) => Number(v.vid)).filter((v) => !isNaN(v)) || [];
    if (numVids.length > 0) {
      const numMax = Math.max(...numVids);
      return String(numMax + 1);
    } else {
      return "1";
    }
  }

  async getMenjiaoItem(
    onSubmit: NonNullable<MenjiaoInput["onSubmit"]>,
    data0: 算料数据,
    suanliaoDataName?: string,
    suanliaoTestName?: string
  ) {
    this.menjiaoName = data0?.名字 || "新建门铰锁边铰边";
    this.saveInfo();
    await openMenjiaoDialog(this.dialog, {
      data: {
        data: data0,
        componentLrsj: this,
        onSubmit,
        isKailiao: this.isKailiao,
        suanliaoDataName,
        suanliaoTestName
      }
    });
    this.menjiaoName = "";
    this.saveInfo();
  }

  async onMenjiaoToolbar(event: ToolbarButtonEvent) {
    const {gongyi, xinghaoMenchuangs} = this;
    if (!gongyi) {
      return;
    }
    switch (event.button.event) {
      case "添加":
        {
          const 名字 = await this.message.prompt({type: "string", label: "新建门铰锁边铰边", validators: Validators.required});
          if (名字) {
            const item = get算料数据({名字, 产品分类: this.fenleiName});
            updateMenjiaoData(item);
            gongyi.算料数据.push(item);
            this.menjiaoTable.data = [...gongyi.算料数据];
            await this.submitGongyi(["算料数据"]);
          }
        }
        break;
      case "从其他做法选择":
        {
          const result = await openSelectGongyiDialog(this.dialog, {
            data: {
              xinghaoMenchuangs,
              xinghaoOptions: this.xinghaoOptionsAll,
              menjiaoOptions: this.menjiaoOptionsAll,
              excludeXinghaos: [this.xinghaoName],
              excludeGongyis: [gongyi.名字],
              key: "算料数据",
              multiple: true,
              fenlei: this.fenleiName
            }
          });
          if (result && result.items.length > 0) {
            const names = gongyi.算料数据.map((v) => v.名字);
            for (const item of result.items) {
              const fromItem = item.data as 算料数据;
              const toItem = cloneDeep(fromItem);
              toItem.vid = this.getMenjiaoId();
              toItem.名字 = getCopyName(names, toItem.名字);
              updateMenjiaoData(toItem);
              gongyi.算料数据.push(toItem);
              names.push(toItem.名字);
              for (const key1 of menjiaoCadTypes) {
                const fromData = fromItem[key1];
                const toData = toItem[key1];
                const [包边方向, 开启] = key1.split("+");
                const fromParams: SuanliaoDataParams = {
                  选项: {
                    型号: item.型号,
                    产品分类: item.产品分类,
                    工艺做法: item.工艺做法 || "",
                    包边方向,
                    开启,
                    门铰锁边铰边: fromItem.名字
                  }
                };
                const toParams: SuanliaoDataParams = {
                  选项: {
                    型号: this.xinghaoName,
                    产品分类: this.fenleiName,
                    工艺做法: this.gongyiName,
                    包边方向,
                    开启,
                    门铰锁边铰边: toItem.名字
                  }
                };
                await copySuanliaoData(this.http, fromData, toData, fromParams, toParams);
              }
            }
            this.menjiaoTable.data = [...gongyi.算料数据];
            await this.submitGongyi(["算料数据"]);
          }
        }
        break;
    }
  }

  async onMenjiaoRow(event: RowButtonEvent<算料数据>, suanliaoDataName?: string, suanliaoTestName?: string) {
    if (!this.gongyi) {
      return;
    }
    const {button, item: fromItem, rowIdx} = event;
    switch (button.event) {
      case "编辑":
        {
          fromItem.产品分类 = this.fenleiName;
          await this.getMenjiaoItem(
            async (result) => {
              const toItem = result.data;
              if (toItem && this.gongyi) {
                if (toItem.默认值) {
                  for (const [i, item4] of this.gongyi.算料数据.entries()) {
                    if (i !== rowIdx) {
                      item4.默认值 = false;
                    }
                  }
                }
                this.gongyi.算料数据[rowIdx] = toItem;
                this.menjiaoTable.data = [...this.gongyi.算料数据];
                await this.submitGongyi(["算料数据"]);
              }
            },
            fromItem,
            suanliaoDataName,
            suanliaoTestName
          );
        }
        break;
      case "编辑排序":
        {
          const data = cloneDeep(fromItem);
          const result = await this.message.form<ObjectOf<any>, 算料数据>([
            {type: "boolean", label: "停用", model: {data, key: "停用"}},
            {type: "number", label: "排序", model: {data, key: "排序"}},
            {
              type: "boolean",
              label: "默认值",
              model: {data, key: "默认值"}
            }
          ]);
          if (result) {
            if (result.默认值) {
              for (const item of this.gongyi.算料数据) {
                item.默认值 = false;
              }
            }
            Object.assign(fromItem, result);
            this.menjiaoTable.data = [...this.gongyi.算料数据];
            await this.submitGongyi(["算料数据"]);
          }
        }
        break;
      case "复制":
        if (await this.message.confirm(`确定复制【${fromItem.名字}】吗？`)) {
          const toItem = cloneDeep(fromItem);
          toItem.vid = this.getMenjiaoId();
          const names = this.gongyi.算料数据.map((v) => v.名字);
          toItem.名字 = getCopyName(names, toItem.名字);
          updateMenjiaoData(toItem);
          for (const key1 of menjiaoCadTypes) {
            const fromData = fromItem[key1];
            const toData = toItem[key1];
            const [包边方向, 开启] = key1.split("+");
            const fromParams: SuanliaoDataParams = {
              选项: {
                型号: this.xinghaoName,
                产品分类: this.fenleiName,
                工艺做法: this.gongyiName,
                包边方向,
                开启,
                门铰锁边铰边: fromItem.名字
              }
            };
            const toParams: SuanliaoDataParams = {
              选项: {
                型号: this.xinghaoName,
                产品分类: this.fenleiName,
                工艺做法: this.gongyiName,
                包边方向,
                开启,
                门铰锁边铰边: toItem.名字
              }
            };
            await copySuanliaoData(this.http, fromData, toData, fromParams, toParams);
          }
          this.gongyi.算料数据.push(toItem);
          this.menjiaoTable.data = [...this.gongyi.算料数据];
          await this.submitGongyi(["算料数据"]);
        }
        break;
      case "删除":
        if (await this.message.confirm(`确定删除【${fromItem.名字}】吗？`)) {
          this.gongyi.算料数据.splice(rowIdx, 1);
          this.menjiaoTable.data = [...this.gongyi.算料数据];
          await this.submitGongyi(["算料数据"]);
        }
        break;
    }
  }

  getHuajianIds(menshans: typeof this.menshans) {
    const huajianIds = new Set<number>();
    for (const optionRaw of menshans) {
      if (typeof optionRaw.zuchenghuajian === "string") {
        for (const v of optionRaw.zuchenghuajian.split("*")) {
          if (v) {
            huajianIds.add(Number(v));
          }
        }
      }
    }
    return huajianIds;
  }

  async updateHuajians() {
    const huajianIds = this.getHuajianIds(this.menshans);
    if (huajianIds.size > 0) {
      this.huajians = await this.http.queryMySql<MrbcjfzHuajian>({
        table: "p_huajian",
        fields: ["vid", "mingzi", "xiaotu", "shihuajian"],
        filter: {where_in: {vid: Array.from(huajianIds)}}
      });
    } else {
      this.huajians = [];
    }
  }

  filterHuajians(data: 算料数据2) {
    const xiaoguotuValues = new Set<string>();
    for (const key of xiaoguotuKeys) {
      const value = data[key];
      if (typeof value === "string" && value) {
        xiaoguotuValues.add(value);
      }
    }
    const menshans = this.menshans.filter((v) => xiaoguotuValues.has(v.name));
    const huajianIds = this.getHuajianIds(menshans);
    return this.huajians.filter((v) => huajianIds.has(v.vid) && filterHuajian(v));
  }

  async purgeXinghaos() {
    const data = {name: "", regex: true};
    const result = await this.message.form<typeof data>(
      [
        {
          type: "string",
          label: "型号名字",
          hint: "若留空则清除所有多余数据",
          model: {data, key: "name"}
        },
        {type: "boolean", label: "正则匹配", model: {data, key: "regex"}}
      ],
      {title: "清除多余型号数据"}
    );
    if (!result) {
      return;
    }
    const filter: ObjectOf<any> = {};
    if (data.regex) {
      filter.名字 = {$regex: data.name};
    } else {
      filter.名字 = data.name;
    }
    await this.http.post("shuju/api/purgeXinghaos", {filter});
  }

  async xinghaoTongyongGongshi() {
    const where = {分类: "型号通用公式"};
    const url = await this.http.getShortUrl("算料公式", {search2: where, extraData: where, forceInsert: true});
    if (url) {
      window.open(url);
    }
  }

  async tongyongshuju() {
    openTongyongshujuDialog(this.dialog, {data: {}});
  }

  async openZxpj(isXinghao: boolean) {
    const data: ZixuanpeijianInput = {
      step: 3,
      stepFixed: true,
      noValidateCads: true,
      readonly: true,
      lingsanOptions: isXinghao ? {getAll: true, typePrefix: true, xinghao: this.xinghaoName} : {getAll: true}
    };
    await openZixuanpeijianDialog(this.dialog, {data});
  }

  async xinghaoZhuanyongGongshi() {
    const search2 = {分类: "型号专用公式", "选项.型号": this.xinghaoName};
    const extraData = {分类: "型号专用公式", 选项: {型号: this.xinghaoName}};
    const url = await this.http.getShortUrl("算料公式", {search2, extraData});
    if (url) {
      window.open(url);
    }
  }

  backToXinghao() {
    this.dialog.closeAll();
    setTimeout(() => {
      this.setStep(1, {});
    }, 0);
  }

  getInfo() {
    const info: ObjectOf<string> = {项目: this.status.project};
    if (this.xinghaoName) {
      info.型号 = this.xinghaoName;
    }
    if (this.fenleiName) {
      info.产品分类 = this.fenleiName;
    }
    if (this.gongyiName) {
      info.工艺做法 = this.gongyiName;
    }
    if (this.menjiaoName) {
      info.门铰锁边铰边 = this.menjiaoName;
    }
    if (this.suanliaoDataName) {
      info.算料公式 = this.suanliaoDataName;
    }
    if (this.suanliaoTestName) {
      info.算料测试 = "true";
    }
    return info;
  }

  async setInfo(info: ReturnType<typeof this.getInfo>) {
    const {项目, 型号, 产品分类, 工艺做法, 门铰锁边铰边, 算料公式, 算料测试} = info;
    if (!项目) {
      return;
    }
    if (this.status.project !== 项目) {
      session.save(this.infoKey, {...info, changeProject: true});
      this.status.changeProject(项目);
      return;
    }
    this.dialog.closeAll();
    if (型号) {
      if (产品分类 && 工艺做法) {
        await this.setStep(3, {xinghaoName: 型号, fenleiName: 产品分类, gongyiName: 工艺做法});
        if (this.gongyi) {
          const rowIdx = this.gongyi?.算料数据.findIndex((v) => v.名字 === 门铰锁边铰边);
          const column = this.menjiaoTable.columns.find((v) => v.field === "操作");
          if (rowIdx >= 0 && column) {
            await this.onMenjiaoRow(
              {
                button: {event: "编辑"},
                column,
                item: this.gongyi.算料数据[rowIdx],
                rowIdx,
                colIdx: 0
              },
              算料公式,
              算料测试
            );
          }
        }
      } else {
        await this.setStep(2, {xinghaoName: 型号});
      }
    } else {
      await this.setStep(1, {});
    }
  }

  copyInfo() {
    const info = this.getInfo();
    const text = Object.entries(info)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    this.message.copyText(text);
  }

  async pasteInfo(text?: string) {
    if (!text) {
      try {
        text = await navigator.clipboard.readText();
      } catch (e) {
        console.error(e);
      }
    }
    if (text) {
      const info = text.split("\n").reduce<ObjectOf<string>>((acc, line) => {
        const [k, v] = line.split(": ");
        if (k && typeof v === "string") {
          acc[k] = v.replace(/\r/g, "");
        }
        return acc;
      }, {});
      if (!info.项目) {
        await this.message.snack("请确保复制了正确的信息");
        return;
      }
      await this.setInfo(info);
    }
  }

  saveInfo() {
    if (!this.production) {
      session.save(this.infoKey, this.getInfo());
    }
  }

  onMenuDragStart() {
    this.isMenuDisabled = true;
  }

  onMenuDragEnd() {
    this.isMenuDisabled = false;
    if (this.menu) {
      const {left, top} = this.menu.nativeElement.getBoundingClientRect();
      local.save(this.menuPoitonKey, [left, top]);
    }
  }

  autoTest() {
    this.message.alert("暂未实现");
  }

  async updateBtns() {
    const toggleforceUpdateCadImgBtnName = () => `强制刷新CAD图片(${getBooleanStr(this.status.forceUpdateCadImg2)})`;
    const toggleforceUpdateCadImgBtn: (typeof this.btns)[number] = {
      name: toggleforceUpdateCadImgBtnName(),
      onClick: () => {
        this.status.forceUpdateCadImg2 = !this.status.forceUpdateCadImg2;
        toggleforceUpdateCadImgBtn.name = toggleforceUpdateCadImgBtnName();
      }
    };
    this.btns = [
      {name: "返回至型号", onClick: this.backToXinghao.bind(this)},
      {name: "复制页面信息", onClick: this.copyInfo.bind(this)},
      {name: "粘贴页面信息", onClick: this.pasteInfo.bind(this)},
      toggleforceUpdateCadImgBtn
    ];
    await this.status.fetchCad数据要求List();
    for (const item of this.status.cad数据要求List) {
      this.btns.push({
        name: item.CAD分类,
        onClick: () => {
          openCadListDialog(this.dialog, {
            data: {selectMode: "none", collection: "cad", search: item.search, yaoqiu: item}
          });
        }
      });
    }
  }

  async getXinghaoMenchaung(menchuang?: XinghaoMenchuang) {
    const data = menchuang ? cloneDeep({...menchuang, gongyis: undefined}) : getXinghaoMenchuang();
    const form: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "mingzi"},
        validators: Validators.required
      },
      {type: "number", label: "排序", model: {data, key: "paixu"}},
      {type: "boolean", label: "停用", model: {data, key: "tingyong"}}
    ];
    const result = await this.message.form(form);
    return result ? data : null;
  }
  async addXinghaoMenchaung() {
    const data = await this.getXinghaoMenchaung();
    if (data) {
      await this.http.tableInsert({table: "p_menchuang", data});
      await this.getXinghaos();
    }
  }
  async editXinghaoMenchaung(i: number) {
    const data0 = this.xinghaoMenchuangs.items[i];
    const data1 = await this.getXinghaoMenchaung(data0);
    if (!data1) {
      return;
    }
    const data = getTableUpdateData(data0, data1);
    if (data) {
      await this.http.tableUpdate({table: "p_menchuang", data});
      await this.getXinghaos();
    }
  }

  async removeXinghaoMenchaung(i: number) {
    const data = this.xinghaoMenchuangs.items[i];
    if (data.gongyis && data.gongyis.items.length > 0) {
      this.message.error("门窗存在工艺时不能删除");
      return;
    }
    if (!(await this.message.confirm("确定删除吗？"))) {
      return;
    }
    await this.http.tableDelete({table: "p_menchuang", vids: [data.vid]});
    await this.getXinghaos();
  }

  async openXinghaoMenchaung() {
    const url = await this.http.getShortUrl("p_menchuang");
    if (!url) {
      return;
    }
    window.open(url);
    if (await this.message.newTabConfirm()) {
      await this.getXinghaos();
    }
  }

  async getXinghaoGongyi(gongyi?: XinghaoGongyi) {
    const data = gongyi ? cloneDeep({...gongyi, xinghaos: undefined}) : getXinghaoGongyi();
    const form: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "mingzi"},
        validators: Validators.required
      },
      {type: "number", label: "排序", model: {data, key: "paixu"}},
      {type: "boolean", label: "停用", model: {data, key: "tingyong"}}
    ];
    const result = await this.message.form(form);
    return result ? data : null;
  }

  async addXinghaoGongyi(i: number) {
    const data = await this.getXinghaoGongyi();
    if (data) {
      data.menchuang = this.xinghaoMenchuangs.items[i].vid;
      await this.http.tableInsert({table: "p_gongyi", data});
      await this.getXinghaos();
    }
  }
  async editXinghaoGongyi(i: number, j: number) {
    const data0 = this.xinghaoMenchuangs.items[i].gongyis?.items[j];
    const data1 = await this.getXinghaoGongyi(data0);
    if (!data0 || !data1) {
      return;
    }
    const data = getTableUpdateData(data0, data1);
    if (data) {
      await this.http.tableUpdate({table: "p_gongyi", data});
      await this.getXinghaos();
    }
  }

  async removeXinghaoGongyi(i: number, j: number) {
    const data = this.xinghaoMenchuangs.items[i].gongyis?.items[j];
    if (!data) {
      return;
    }
    if (data.xinghaos && data.xinghaos.items.length > 0) {
      this.message.error("工艺存在型号时不能删除");
      return;
    }
    if (!(await this.message.confirm("确定删除吗？"))) {
      return;
    }
    await this.http.tableDelete({table: "p_gongyi", vids: [data.vid]});
    await this.getXinghaos();
  }

  async openXinghaoGongyi() {
    const url = await this.http.getShortUrl("p_gongyi");
    if (!url) {
      return;
    }
    window.open(url);
    if (await this.message.newTabConfirm()) {
      await this.getXinghaos();
    }
  }

  clikcXinghaoGongyi(i: number, j: number) {
    const menchuangs = this.xinghaoMenchuangs;
    const iPrev = menchuangs.index;
    menchuangs.index = i;
    const gongyis = menchuangs.items[i]?.gongyis;
    if (!gongyis) {
      return;
    }
    const jPrev = gongyis.index;
    gongyis.index = j;
    if (iPrev !== i || jPrev !== j) {
      const xinghaos = gongyis.items[j]?.xinghaos;
      this.xinghaos = xinghaos?.items || [];
    }
  }
}
