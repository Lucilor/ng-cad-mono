import {Component, QueryList, ViewChildren} from "@angular/core";
import {FormsModule, Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatMenuModule} from "@angular/material/menu";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {ActivatedRoute, NavigationEnd, Router} from "@angular/router";
import {getFilepathUrl, replaceRemoteHost, session, setGlobal} from "@app/app.common";
import {openDakongSummaryDialog} from "@components/dialogs/dakong-summary/dakong-summary.component";
import {openSelectBancaiCadsDialog, SelectBancaiCadsInput} from "@components/dialogs/select-bancai-cads/select-bancai-cads.component";
import {downloadByString, downloadByUrl, getPinyinCompact, ObjectOf, timeout} from "@lucilor/utils";
import {Subscribed} from "@mixins/subscribed.mixin";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {BancaiCad, BancaiList} from "@modules/http/services/cad-data.service.types";
import {InputComponent} from "@modules/input/components/input.component";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerComponent} from "@modules/spinner/components/spinner/spinner.component";
import {AppConfigService} from "@services/app-config.service";
import {AppStatusService} from "@services/app-status.service";
import {DdbqType} from "@views/dingdanbiaoqian/dingdanbiaoqian.types";
import {cloneDeep} from "lodash";
import {DateTime} from "luxon";
import {NgScrollbar} from "ngx-scrollbar";
import {
  BancaiCadExtend,
  BancaisInfo,
  DakongSummary,
  guigePattern,
  houduPattern,
  OrderBancaiInfo,
  SelectBancaiDlHistory,
  XikongData,
  XikongOptions
} from "./select-bancai.types";

@Component({
  selector: "app-select-bancai",
  templateUrl: "./select-bancai.component.html",
  styleUrls: ["./select-bancai.component.scss"],
  standalone: true,
  imports: [
    FormsModule,
    InputComponent,
    MatButtonModule,
    MatDividerModule,
    MatMenuModule,
    MatSlideToggleModule,
    NgScrollbar,
    SpinnerComponent
  ]
})
export class SelectBancaiComponent extends Subscribed() {
  autoGuige = this.config.getConfig("kailiaoAutoGuige");
  orderBancaiInfos: OrderBancaiInfo[] = [];
  bancaiList: ObjectOf<BancaiList> = {};
  codes: string[] = [];
  table = "";
  type = "";
  gasOptions = [
    {value: "Air", label: "空气"},
    {value: "O2", label: "氧气"},
    {value: "N2", label: "氮气"},
    {value: "H-Air", label: "高压空气"},
    {value: "H-O2", label: "高压氧气"},
    {value: "H-N2", label: "高压氮气"}
  ] as const;
  loaderId = "selectBancai";
  submitLoaderId = "selectBancaiSubmit";
  downloadHistory: SelectBancaiDlHistory[] = [];
  downloadName = "";
  showGas = false;
  isShowXikong = false;
  xikongStrings: [string, string][][][] = [];
  xikongOptions: XikongOptions = session.load("xikongOptions") || {};
  xikongData: XikongData | null = null;

  @ViewChildren("bancaiInfoInput") bancaiInfoInputs?: QueryList<InputComponent>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: CadDataService,
    private message: MessageService,
    private dialog: MatDialog,
    private status: AppStatusService,
    private config: AppConfigService
  ) {
    super();
    setGlobal("selectBancai", this);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.refresh();
      }
    });
  }

  async refresh() {
    const {codes, table, type} = this.route.snapshot.queryParams;
    if (codes && table && type) {
      this.codes = codes.split(",");
      this.table = table;
      document.title = type;
      this.type = type;
      if (type === "铝型材铣孔工单") {
        this.isShowXikong = true;
        await this.getXikongData(false, true);
      } else {
        this.isShowXikong = false;
        await this.refreshDownloadHistory();
        const result = await this.http.getData<BancaisInfo>("order/order/getBancais", {table, codes: this.codes});
        if (result) {
          const bancaiZidingyi = result.bancaiList.find((v) => v.mingzi === "自定义");
          const errMsgs: string[] = [];
          this.orderBancaiInfos = [];
          for (const orderBancai of result.orderBancais) {
            const {code, bancaiCads, 上下走线, 开料孔位配置, 开料参数} = orderBancai;
            for (const cad of bancaiCads) {
              let list = result.bancaiList.find((v) => v.mingzi === cad.bancai.mingzi);
              if (!list && bancaiZidingyi) {
                list = cloneDeep(bancaiZidingyi);
                list.mingzi = cad.bancai.mingzi;
              }
              if (list) {
                this.bancaiList[list.mingzi] = list;
                if (!cad.bancai.cailiao) {
                  cad.bancai.cailiao = list.cailiaoList[0];
                }
                if (!cad.bancai.houdu) {
                  cad.bancai.houdu = list.houduList[0];
                }
                if (!cad.bancai.guige) {
                  if (!list.guigeList[0]) {
                    this.message.alert(`${cad.bancai.mingzi}, 没有板材规格`);
                    throw new Error(`${cad.bancai.mingzi}, 没有板材规格`);
                  }
                  cad.bancai.guige = list.guigeList[0].slice();
                }
                if (!cad.bancai.gas) {
                  cad.bancai.gas = "Air";
                }
              }
            }
            const orderBancaiInfo: OrderBancaiInfo = {
              code,
              shangxiazouxianUrl: 上下走线,
              kailiaokongweipeizhiUrl: 开料孔位配置,
              kailiaocanshuzhiUrl: 开料参数,
              sortedCads: [],
              bancaiInfos: []
            };
            this.orderBancaiInfos.push(orderBancaiInfo);
            this.updateSortedCads(orderBancaiInfo, bancaiCads);
            for (const error of orderBancai.errors) {
              errMsgs.push(`订单编号:${error.code}<br>${error.msg}`);
            }
          }
          this.updateOrderBancaiInfos();
          this.downloadName = result.downloadName;
          this.showGas = type === "激光喷码开料排版";
          if (this.status.projectConfig.getIsEqual("激光开料展开信息", "大族激光")) {
            this.showGas = true;
          }
          if (errMsgs.length > 0) {
            this.message.alert({title: "开料报错", content: errMsgs.join("<br><br>")});
          }
        }
      }
    } else {
      this.message.alert("缺少参数");
    }
  }

  async refreshDownloadHistory() {
    const dlHistory = await this.http.getData<ObjectOf<any>[]>("order/order/getKailiaoDlHistory", {codes: this.codes});
    if (dlHistory) {
      this.downloadHistory = dlHistory.map<SelectBancaiDlHistory>((v) => ({
        name: v.name,
        date: DateTime.fromMillis(Number(v.创建时间)).toFormat("yyyy-MM-dd HH:mm:ss")
      }));
    }
  }

  getBancaiCadExtend(bancaiCad: BancaiCad) {
    const result: BancaiCadExtend = {...bancaiCad, checked: false, oversized: false, disabled: false};
    const guige = bancaiCad.bancai.guige;
    if (Array.isArray(guige)) {
      result.oversized = bancaiCad.width > guige[0] || bancaiCad.height > guige[1];
    }
    return result;
  }

  isBancaiDuplicate(a: BancaiCad["bancai"], b: BancaiCad["bancai"]) {
    return (
      a.mingzi === b.mingzi &&
      a.cailiao === b.cailiao &&
      a.houdu === b.houdu &&
      a.guige?.[0] === b.guige?.[0] &&
      a.guige?.[1] === b.guige?.[1] &&
      a.gas === b.gas
    );
  }

  updateSortedCads(info: OrderBancaiInfo, bancaiCads: BancaiCad[] | BancaiCad["bancai"], i?: number) {
    if (Array.isArray(bancaiCads)) {
      const sortedCads: BancaiCadExtend[][] = [];
      for (const bancaiCad of bancaiCads) {
        const bancai = bancaiCad.bancai;
        if (sortedCads.length) {
          const index = sortedCads.findIndex((group) => {
            if (group.length) {
              const groupBancai = group[0].bancai;
              return this.isBancaiDuplicate(bancai, groupBancai);
            }
            return true;
          });
          if (index > -1) {
            sortedCads[index].push(this.getBancaiCadExtend(bancaiCad));
          } else {
            sortedCads.push([this.getBancaiCadExtend(bancaiCad)]);
          }
        } else {
          sortedCads.push([this.getBancaiCadExtend(bancaiCad)]);
        }
      }
      info.sortedCads = sortedCads;
    } else if (typeof i === "number") {
      const sortedCads = info.sortedCads;
      const group = sortedCads[i];
      group.forEach((v) => {
        Object.assign(v.bancai, bancaiCads);
        if (Array.isArray(v.bancai.guige)) {
          v.oversized = v.width > v.bancai.guige[0] || v.height > v.bancai.guige[1];
        } else {
          v.oversized = false;
        }
      });
      const duplicateIdx = sortedCads.findIndex((v, j) => j !== i && this.isBancaiDuplicate(v[0].bancai, group[0].bancai));
      if (duplicateIdx >= 0) {
        sortedCads[duplicateIdx] = sortedCads[duplicateIdx].concat(group);
        sortedCads.splice(i, 1);
        this.orderBancaiInfos.splice(i, 1);
        this.message.snack("板材信息相同, 已合并");
        this.updateOrderBancaiInfos();
      }
    }
  }

  updateOrderBancaiInfos() {
    for (const info of this.orderBancaiInfos) {
      info.bancaiInfos = [];
      for (const [i, group] of info.sortedCads.entries()) {
        const bancai = cloneDeep(group[0].bancai);
        const onChange = (key: keyof BancaiCad["bancai"], value: string) => {
          if (key === "guige") {
            const match = value.match(guigePattern);
            if (match) {
              bancai.guige = [Number(match[1]), Number(match[3])];
            }
          } else {
            bancai[key] = value;
          }
          this.updateSortedCads(info, bancai, i);
        };
        const bancaiList = this.bancaiList[bancai.mingzi];
        const cailiaos = bancaiList?.cailiaoList || [];
        const houdus = bancaiList?.houduList || [];
        const guiges = (bancaiList?.guigeList || []).map((v) => v.join(" × "));
        const gasOptions = this.gasOptions.slice();
        const bancaiInfo: (typeof info.bancaiInfos)[0] = {
          cads: group.map((v) => v.id),
          oversized: group.some((v) => v.oversized),
          inputInfos: [
            {label: "板材", type: "string", readonly: true, value: bancai.mingzi, validators: Validators.required},
            {
              label: "材料",
              type: "string",
              value: bancai.cailiao || "",
              options: cailiaos,
              fixedOptions: cailiaos,
              onChange: (value) => onChange("cailiao", value),
              validators: Validators.required
            },
            {
              label: "厚度",
              type: "string",
              value: bancai.houdu || "",
              options: houdus,
              fixedOptions: houdus,
              onChange: (value) => onChange("houdu", value),
              validators: [
                Validators.required,
                (control) => {
                  if (!houduPattern.test(control.value)) {
                    return {pattern: "厚度必须为数字"};
                  }
                  return null;
                }
              ]
            },
            {
              label: "规格",
              type: "string",
              value: bancai.guige?.join(" × ") || "",
              options: guiges,
              fixedOptions: guiges,
              onChange: (value) => onChange("guige", value),
              validators: [
                Validators.required,
                (control) => {
                  if (!guigePattern.test(control.value)) {
                    return {pattern: "规格必须为两个数字(如: 10,10)"};
                  }
                  return null;
                }
              ]
            }
          ]
        };
        if (this.showGas) {
          bancaiInfo.inputInfos.push({
            label: "切割保护气体",
            type: "select",
            value: bancai.gas || "",
            options: gasOptions,
            onChange: (value: string) => onChange("gas", value)
          });
        }
        info.bancaiInfos.push(bancaiInfo);
      }
    }
  }

  async openCadsDialog(i: number, j: number) {
    const info = this.orderBancaiInfos[i];
    const cads = [info.sortedCads[j]];
    const data: SelectBancaiCadsInput = {
      orders: [{code: info.code, cads}],
      submitBtnText: "移到新板材",
      submitLimit: {min: 1},
      editDisabled: true
    };
    const result = await openSelectBancaiCadsDialog(this.dialog, {data});
    const oldGroup: BancaiCadExtend[] = [];
    const newGroup: BancaiCadExtend[] = [];
    for (const cad of cads[0]) {
      if (result) {
        if (cad.checked) {
          cad.bancai.guige = null;
          newGroup.push(cad);
        } else {
          oldGroup.push(cad);
        }
      }
      cad.checked = false;
    }
    if (newGroup.length > 0) {
      if (oldGroup.length > 0) {
        info.sortedCads[j] = oldGroup;
        info.sortedCads.splice(j + 1, 0, newGroup);
      } else {
        info.sortedCads[j] = newGroup;
      }
    }
    this.updateOrderBancaiInfos();
  }

  async submit(selectCad?: boolean, noPaiban?: boolean) {
    await timeout(0);
    if (this.bancaiInfoInputs) {
      for (const bancaiInfoInput of this.bancaiInfoInputs) {
        if (!bancaiInfoInput.isValid()) {
          this.message.error("输入有误，请检查");
          return;
        }
      }
    }
    const getCadOptions: ObjectOf<any>[] = [];
    const bancaiCadsArr: BancaiCad[][] = [];
    const codes: string[] = [];
    for (const info of this.orderBancaiInfos) {
      const arr1: BancaiCad[] = [];
      const namesInclude: string[] = [];
      const namesExclude: string[] = [];
      for (const group of info.sortedCads) {
        for (const cad of group) {
          if (cad.disabled || (selectCad && !cad.checked)) {
            namesExclude.push(cad.name);
          } else {
            const clone = {...cad} as Partial<BancaiCadExtend>;
            delete clone.checked;
            delete clone.oversized;
            delete clone.disabled;
            arr1.push(clone as BancaiCad);
            namesInclude.push(cad.name);
          }
        }
      }
      if (namesInclude.length > 0) {
        codes.push(info.code);
        if (namesInclude.length <= namesExclude.length) {
          getCadOptions.push({namesInclude});
        } else {
          getCadOptions.push({namesExclude});
        }
      }
      bancaiCadsArr.push(arr1);
    }
    const api = "order/order/selectBancai";
    const {table, autoGuige, type} = this;
    const projectConfigOverride: ObjectOf<string> = {};
    if (noPaiban) {
      projectConfigOverride.激光开料结果不用排版 = "是";
    }
    let url: string | string[] | null = null;
    const data: ObjectOf<any> = {codes, bancaiCadsArr, table, autoGuige, type, getCadOptions, projectConfigOverride};
    try {
      url = await this.http.getData<string | string[]>(api, data);
      await this.refreshDownloadHistory();
    } catch {}
    if (url) {
      this.xikongData = null;
      if (Array.isArray(url)) {
        this.message.alert(url.map((v) => `<div>${v}</div>`).join(""));
      } else {
        this.downloadDxf(replaceRemoteHost(url));
      }
    }
  }

  async selectCadsToSubmit() {
    const data: SelectBancaiCadsInput = {orders: [], submitBtnText: this.type, submitLimit: {min: 1}, noPaiban: true};
    for (const order of this.orderBancaiInfos) {
      data.orders.push({code: order.code, cads: order.sortedCads});
    }
    const result = await openSelectBancaiCadsDialog(this.dialog, {data});
    if (result) {
      await this.submit(true, result.noPaiban);
    }
    for (const order of this.orderBancaiInfos) {
      for (const group of order.sortedCads) {
        for (const cad of group) {
          cad.checked = false;
        }
      }
    }
  }

  open(url: string) {
    window.open(url);
  }

  downloadDxf(url: string, isName = false) {
    const downloadName = this.downloadName || this.codes.join(",");
    if (isName) {
      url = getFilepathUrl(`tmp/${url}.dxf`);
    }
    downloadByUrl(url, {filename: downloadName + ".dxf"});
  }

  returnZero() {
    return 0;
  }

  async openDdbq(showBarcode: boolean, 铝型材: boolean) {
    const url = new URL(location.href);
    url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf("/")) + "/dingdanbiaoqian";
    const type: DdbqType = "标签贴纸";
    url.searchParams.set("type", type);
    if (showBarcode) {
      url.searchParams.set("showBarcode", "1");
    }
    if (铝型材) {
      const {toDelete} = await this.getXikongData(false, true, true);
      if (toDelete.length > 0) {
        return;
      }
      url.searchParams.set("铝型材", "1");
    }
    this.open(url.href);
  }

  onAutoGuigeChange() {
    this.config.setConfig("kailiaoAutoGuige", this.autoGuige);
  }

  onXikongOptionsChange() {
    session.save("xikongOptions", this.xikongOptions);
    this.getXikongData(false, true);
  }

  async getDakongSummary() {
    const {codes} = this;
    const data = await this.http.getData<DakongSummary>("order/order/getDakongSummary", {codes});
    if (!data) {
      return;
    }
    const toDelete: string[] = [];
    for (const code in data) {
      if (!data[code]) {
        toDelete.push(code);
      }
    }
    if (toDelete.length > 0) {
      await this.message.alert("以下订单没有孔位开料结果，请先开一次料<br>" + toDelete.join("、"));
      for (const code of toDelete) {
        delete data[code];
      }
    }
    if (Object.keys(data).length > 0) {
      openDakongSummaryDialog(this.dialog, {data: {data}});
    }
  }

  async getXikongData(download: boolean, useCache = false, checkOnly = false) {
    if (!this.xikongData || !useCache) {
      const {codes} = this;
      this.xikongData = await this.http.getData<XikongData>("order/order/getXikongData", {codes});
    }
    const data = {...this.xikongData};
    const toDelete: string[] = [];
    const result = {toDelete};
    if (!data) {
      return result;
    }
    for (const code in data) {
      if (!data[code]) {
        toDelete.push(code);
      }
    }
    if (toDelete.length > 0) {
      const toDeleteStr = toDelete.join("、");
      if (this.isShowXikong) {
        const yes = await this.message.confirm(`以下订单没有铣孔数据，请先开一次料<br>${toDeleteStr}<br>是否前往激光开料`);
        if (yes) {
          this.setType("激光开料排版");
          return result;
        }
      } else {
        await this.message.alert("以下订单没有铣孔数据，请先开一次料<br>" + toDeleteStr);
      }
      for (const code of toDelete) {
        delete data[code];
      }
    }
    if (checkOnly) {
      return result;
    }
    this.xikongStrings = [];
    const {showCN} = this.xikongOptions;
    for (const code in data) {
      const groupDisplay: [string, string][][] = [];
      const groupDownload: string[] = [];
      for (const item of data[code] || []) {
        const rowDisplay: [string, string][] = [];
        let rowDownload = "";
        let hasPpu = false;
        for (const [tag, value] of item.content) {
          let value2: typeof value;
          let value3: typeof value;
          if (!showCN && tag === "PPU") {
            value2 = getPinyinCompact(value).replaceAll("ü", "v");
          } else {
            value2 = value;
          }
          if (tag === "PPU") {
            hasPpu = true;
            value3 = getPinyinCompact(value).replaceAll("ü", "v");
          } else {
            value3 = value;
          }
          rowDisplay.push([tag, value2]);
          rowDownload += `<${tag}>${value3}</${tag}>`;
        }
        if (hasPpu) {
          groupDisplay.push(rowDisplay);
          groupDownload.push(rowDownload);
        }
      }
      this.xikongStrings.push(groupDisplay);
      if (download) {
        downloadByString(groupDownload.join("\n"), {filename: code + ".txt"});
      }
    }
    return result;
  }

  setType(type: string) {
    this.router.navigate([this.route.snapshot.url[0].path], {queryParams: {type}, queryParamsHandling: "merge"});
  }
}
