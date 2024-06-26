import {KeyValuePipe, NgTemplateOutlet} from "@angular/common";
import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatOptionModule} from "@angular/material/core";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {ActivatedRoute} from "@angular/router";
import {remoteFilePath, session, setGlobal, timer} from "@app/app.common";
import {Formulas} from "@app/utils/calc";
import mokuaidaxiaoData from "@assets/json/mokuaidaxiao.json";
import {openCadOptionsDialog} from "@components/dialogs/cad-options/cad-options.component";
import {openMrbcjfzDialog} from "@components/dialogs/mrbcjfz-dialog/mrbcjfz-dialog.component";
import {openZixuanpeijianDialog} from "@components/dialogs/zixuanpeijian/zixuanpeijian.component";
import {Step1Data, ZixuanpeijianMokuaiItem, ZixuanpeijianTypesInfoItem} from "@components/dialogs/zixuanpeijian/zixuanpeijian.types";
import {
  getFromulasFromString,
  getMokuaiTitle,
  getStep1Data,
  isMokuaiItemEqual
} from "@components/dialogs/zixuanpeijian/zixuanpeijian.utils";
import {GenerateRectsEndEvent, MsbjRectsComponent} from "@components/msbj-rects/msbj-rects.component";
import {MsbjRectInfo} from "@components/msbj-rects/msbj-rects.types";
import {environment} from "@env";
import {ObjectOf, Point, Rectangle, timeout, WindowMessageManager} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {BancaiList, TableDataBase, TableUpdateParams} from "@modules/http/services/cad-data.service.types";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import {MrbcjfzInfo, MrbcjfzXinghao} from "@views/mrbcjfz/mrbcjfz.types";
import {isMrbcjfzInfoEmpty1, MrbcjfzXinghaoInfo} from "@views/mrbcjfz/mrbcjfz.utils";
import {MsbjData, MsbjInfo, Node2rectData, node2rectDataMsdxKeys} from "@views/msbj/msbj.types";
import {LastSuanliao} from "@views/suanliao/suanliao.types";
import {openXhmrmsbjMokuaisDialog} from "@views/xhmrmsbj-mokuais/xhmrmsbj-mokuais.component";
import {cloneDeep, intersection, isEqual} from "lodash";
import md5 from "md5";
import {NgScrollbar} from "ngx-scrollbar";
import {BehaviorSubject, filter, firstValueFrom} from "rxjs";
import {TypedTemplateDirective} from "../../modules/directives/typed-template.directive";
import {ImageComponent} from "../../modules/image/components/image/image.component";
import {InputComponent} from "../../modules/input/components/input.component";
import {XhmrmsbjData, XhmrmsbjInfo, XhmrmsbjTableData, XhmrmsbjTabName, xhmrmsbjTabNames} from "./xhmrmsbj.types";

const table = "p_xinghaomorenmenshanbuju";
@Component({
  selector: "app-xhmrmsbj",
  templateUrl: "./xhmrmsbj.component.html",
  styleUrls: ["./xhmrmsbj.component.scss"],
  standalone: true,
  imports: [
    FormsModule,
    ImageComponent,
    InputComponent,
    KeyValuePipe,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatOptionModule,
    MatSelectModule,
    MatSlideToggleModule,
    MsbjRectsComponent,
    NgScrollbar,
    NgTemplateOutlet,
    TypedTemplateDirective
  ]
})
export class XhmrmsbjComponent implements OnInit, OnDestroy {
  table = "";
  id = "";
  isFromOrder = false;
  tableData: XhmrmsbjTableData | null = null;
  data: XhmrmsbjData | null = null;
  fenleis: TableDataBase[] = [];
  msbjs: MsbjInfo[] = [];
  step1Data: Step1Data = {options: {}, typesInfo: {}};
  mokuais: ZixuanpeijianMokuaiItem[] = [];
  xinghao: MrbcjfzXinghaoInfo | null = null;
  bancaiList: BancaiList[] = [];
  activeMenshanKey: string | null = null;
  activeMsbj: MsbjInfo | null = null;
  activeRectInfo: MsbjRectInfo | null = null;
  urlPrefix = remoteFilePath;
  get activeMsbjInfo() {
    return this.data?.menshanbujuInfos[this.activeMenshanKey || ""];
  }
  get activeMokuaiNode() {
    return this.activeMsbjInfo?.模块节点?.find((v) => v.层id === this.activeRectInfo?.raw.vid);
  }
  get activeMorenbancai() {
    return this.activeMokuaiNode?.选中模块?.morenbancai || {};
  }
  get activeMokuaidaxiaoResult() {
    if (this.activeMenshanKey) {
      return this.mokuaidaxiaoResults[this.activeMenshanKey] || {};
    } else {
      return {};
    }
  }
  set activeMokuaidaxiaoResult(value) {
    if (this.activeMenshanKey) {
      this.mokuaidaxiaoResults[this.activeMenshanKey] = value;
    }
  }
  showMokuais = false;
  mokuaiTemplateType!: {$implicit: ZixuanpeijianMokuaiItem | null; isActive?: boolean};
  tabNames = xhmrmsbjTabNames;
  activeTabName: XhmrmsbjTabName = "门扇模块";
  mokuaiInputInfos: InputInfo[] = [];
  isMrbcjfzInfoEmpty1 = isMrbcjfzInfoEmpty1;
  menshanKeys = ["锁扇正面", "锁扇背面", "铰扇正面", "铰扇背面", "小扇正面", "小扇背面"];
  materialResult: Formulas = {};
  houtaiUrl = "";
  user: ObjectOf<any> | null = null;
  mokuaidaxiaoResults: ObjectOf<Formulas> = {};
  wmm = new WindowMessageManager("门扇模块", this, window.parent);
  suanliaoLock$ = new BehaviorSubject(false);
  genXiaoguotuLock$ = new BehaviorSubject(false);
  get isZhijian() {
    return this.user?.经销商名字 === "至简软件";
  }
  production = environment.production;
  @ViewChild(MsbjRectsComponent) msbjRectsComponent?: MsbjRectsComponent;
  @ViewChild("xiaoguotuContainer", {read: ElementRef}) xiaoguotuContainer?: ElementRef<HTMLDivElement>;

  private _ignoreXiaoguotuKey = "xhmrmsbjIgnoreXiaoguotu";
  private _ignoreXiaoguotu = session.load(this._ignoreXiaoguotuKey) ?? false;
  get ignoreXiaoguotu() {
    return this._ignoreXiaoguotu;
  }
  set ignoreXiaoguotu(value) {
    this._ignoreXiaoguotu = value;
    session.save(this._ignoreXiaoguotuKey, value);
  }

  constructor(
    private route: ActivatedRoute,
    private http: CadDataService,
    private dialog: MatDialog,
    private spinner: SpinnerService,
    private message: MessageService
  ) {
    setGlobal("xhmrmsbj", this);
  }

  async ngOnInit() {
    const step1Data = await getStep1Data(this.http, {});
    this.mokuais = [];
    if (step1Data) {
      this.step1Data = step1Data;
      for (const type1 in step1Data.typesInfo) {
        for (const type2 in step1Data.typesInfo[type1]) {
          const info = step1Data.typesInfo[type1][type2];
          this.mokuais.push({...info, type1, type2, totalWidth: "", totalHeight: "", cads: []});
        }
      }
    }

    const {id, token} = this.route.snapshot.queryParams;
    if (table && id) {
      this.table = table;
      this.id = id;
      this.isFromOrder = false;
      const records = await this.http.queryMySql<XhmrmsbjTableData>({table, filter: {where: {vid: id}}});
      this.tableData = records?.[0] || null;
    } else if (token) {
      this.isFromOrder = true;
    }
    this.fenleis = await this.http.queryMySql<TableDataBase>({table: "p_gongnengfenlei", fields: ["vid", "mingzi"]});
    const menshanbujus = await this.http.queryMySql<MsbjData>({table: "p_menshanbuju"});
    this.msbjs = menshanbujus.map((item) => new MsbjInfo(item, this.getNode2rectData()));
    this.bancaiList = (await this.http.getBancaiList())?.bancais || [];
    if (!this.isFromOrder) {
      this.data = this.tableData ? new XhmrmsbjData(this.tableData, this.menshanKeys, this.step1Data.typesInfo, this.msbjs) : null;
      const xinghaos = await this.http.queryMySql<MrbcjfzXinghao>({
        table: "p_xinghao",
        filter: {where: {vid: this.tableData?.xinghao}}
      });
      this.xinghao = xinghaos[0] ? new MrbcjfzXinghaoInfo(table, xinghaos[0]) : null;
    }
    await timeout(0);
    if (this.isFromOrder) {
      this.wmm.postMessage("requestData");
    } else {
      await this.selectMenshanKey(this.menshanKeys[0]);
    }
  }

  ngOnDestroy() {
    this.wmm.destroy();
  }

  async requestData(data: any) {
    const {型号选中门扇布局, 型号选中板材, materialResult, menshanKeys, 铰扇跟随锁扇} = data;
    const {houtaiUrl, id, user, localServerUrl} = data;
    if (typeof localServerUrl === "string") {
      this.urlPrefix = localServerUrl;
    }
    this.data = new XhmrmsbjData(
      {vid: 1, mingzi: "1", peizhishuju: JSON.stringify(型号选中门扇布局), jiaoshanbujuhesuoshanxiangtong: 铰扇跟随锁扇 ? 1 : 0},
      menshanKeys,
      this.step1Data.typesInfo,
      this.msbjs
    );
    this.materialResult = materialResult;
    this.houtaiUrl = houtaiUrl;
    this.id = id;
    this.user = user;
    this.menshanKeys = menshanKeys;
    this.xinghao = new MrbcjfzXinghaoInfo(this.table, {vid: 1, mingzi: materialResult.型号, morenbancai: JSON.stringify(型号选中板材)});
    await this.selectMenshanKey(this.activeMenshanKey || this.menshanKeys[0]);
  }

  submitData() {
    const result = {action: "submitData", data: {} as any};
    const data = this.data;
    if (data) {
      if (data.铰扇跟随锁扇) {
        for (const key in data.menshanbujuInfos) {
          if (key.includes("铰扇")) {
            data.menshanbujuInfos[key] = cloneDeep(data.menshanbujuInfos[key.replace("铰扇", "锁扇")]);
          }
        }
      }
      result.data = {
        型号选中门扇布局: data.menshanbujuInfos,
        铰扇跟随锁扇: data.铰扇跟随锁扇,
        门扇布局: this.msbjs
      };
    }
    return result;
  }

  async 保存模块大小(data: {inputValues: Formulas}) {
    const {activeMsbjInfo} = this;
    if (activeMsbjInfo) {
      const md5Prev = md5(JSON.stringify(activeMsbjInfo.模块大小输入 || {}));
      activeMsbjInfo.模块大小输入 = data.inputValues;
      const md5Curr = md5(JSON.stringify(activeMsbjInfo.模块大小输入));
      if (md5Prev !== md5Curr) {
        await this.suanliao();
      }
    }
  }

  returnZero() {
    return 0;
  }

  validateMorenbancai(morenbancai: ObjectOf<MrbcjfzInfo> | null) {
    if (!morenbancai) {
      return true;
    }
    if (this.isFromOrder) {
      return true;
    }
    return Object.entries(morenbancai).every(([k, v]) => this.isMrbcjfzInfoEmpty1(k, v) || v.默认对应板材分组);
  }

  async selectMenshanKey(key: string) {
    const msbj = this.activeMsbj;
    const msbjInfo = this.activeMsbjInfo;
    if (msbj && msbjInfo) {
      for (const rectInfo of msbj.peizhishuju.模块节点) {
        const node = msbjInfo.模块节点?.find((v) => v.层id === rectInfo.vid);
        const 选中模块 = node?.选中模块;
        if (rectInfo.isBuju && !选中模块) {
          await this.message.error("布局中存在未选中的模块");
          return;
        }
        if (!this.isFromOrder) {
          const 默认模块 = node?.可选模块.find((v) => v.info?.isDefault);
          if (rectInfo.isBuju && !默认模块) {
            await this.message.error("布局中存在未设置默认模块的模块");
            return;
          }
        }
      }
      const mokuaisWithoutBancai: {mokuai: ZixuanpeijianMokuaiItem; layerName: string}[] = [];
      for (const node of msbjInfo.模块节点 || []) {
        for (const mokuai of node.可选模块) {
          if (!this.validateMorenbancai(mokuai.morenbancai)) {
            mokuaisWithoutBancai.push({mokuai, layerName: node.层名字});
          }
        }
      }
      if (mokuaisWithoutBancai.length > 0) {
        const details = mokuaisWithoutBancai.map((v) => getMokuaiTitle(v.mokuai, {层名字: v.layerName}));
        await this.message.error({content: "以下模块未设置默认板材分组", details});
        return;
      }
    }
    if (this.activeMenshanKey !== key) {
      this.activeMenshanKey = key;
      await this.setActiveMsbj(this.activeMsbjInfo);
      await this.suanliao();
    }
  }

  async setActiveMsbj(info?: XhmrmsbjInfo) {
    this.showMokuais = false;
    const vid = info?.选中布局数据?.vid;
    const msbj = cloneDeep(this.msbjs.find((item) => item.vid === vid) || null);
    this.activeMsbj = msbj;
    this.activeRectInfo = null;
    const msbjInfo = this.activeMsbjInfo;
    await timeout(0);
    if (msbjInfo) {
      if (!msbjInfo.模块节点) {
        msbjInfo.模块节点 = [];
      }
      const rectInfos = this.msbjRectsComponent?.rectInfosAbsolute || [];
      msbjInfo.模块节点 = msbjInfo.模块节点.filter((v) => rectInfos.find((rectInfo) => rectInfo.raw.isBuju && rectInfo.raw.vid === v.层id));
      for (const rectInfo of rectInfos) {
        if (rectInfo.raw.isBuju) {
          const node = msbjInfo.模块节点.find((v) => v.层id === rectInfo.raw.vid);
          if (node) {
            node.层名字 = rectInfo.name;
          } else {
            msbjInfo.模块节点.push({层id: rectInfo.raw.vid, 层名字: rectInfo.name, 可选模块: []});
          }
        }
      }
    }

    await this.updateMokuaidaxiaoResults();
  }

  async refreshMokuaidaxiaoResults(menshanKey: string) {
    const msbjInfo = this.data?.menshanbujuInfos[menshanKey];
    if (!msbjInfo) {
      throw new Error("没有门扇布局");
    }
    this.wmm.postMessage("refreshMokuaidaxiaoResultsStart", {menshanKey, msbjInfo});
    return await this.wmm.waitForMessage<{values: Formulas}>("refreshMokuaidaxiaoResultsEnd");
  }

  async updateMokuaidaxiaoResults() {
    for (const menshanKey of this.menshanKeys) {
      const msbjInfo = this.data?.menshanbujuInfos[menshanKey];
      if (!this.isFromOrder || !msbjInfo) {
        this.updateMokuaiInputInfo();
        return;
      }
      if (msbjInfo.选中布局数据) {
        const gongshiObj = msbjInfo.选中布局数据.模块大小关系 || {};
        if (!gongshiObj.门扇调整) {
          gongshiObj.门扇调整 = Object.values(gongshiObj)[0];
        }
        if (!gongshiObj.配置) {
          gongshiObj.配置 = {};
        }
        const {values} = await this.refreshMokuaidaxiaoResults(menshanKey);
        this.mokuaidaxiaoResults[menshanKey] = values;
      }
    }
    this.updateMokuaiInputInfo();
  }

  async setMsbj() {
    const infos = this.data?.menshanbujuInfos;
    const menshanweizhi = this.activeMenshanKey;
    if (!menshanweizhi || !infos) {
      return;
    }
    const {选中布局数据} = infos[menshanweizhi];
    const checkedVids: number[] = [];
    if (选中布局数据?.vid) {
      checkedVids.push(选中布局数据.vid);
    }
    const result = await openCadOptionsDialog(this.dialog, {
      data: {name: "p_menshanbuju", filter: {guanlianCN: {menshanweizhi}}, checkedVids}
    });
    if (result?.options[0]) {
      const msbj = this.msbjs.find((v) => v.vid === result.options[0].vid);
      if (msbj) {
        infos[menshanweizhi].选中布局 = msbj.vid;
        infos[menshanweizhi].选中布局数据 = {
          vid: msbj.vid,
          name: msbj.name,
          模块大小关系: msbj.peizhishuju.模块大小关系
        };
        this.setActiveMsbj(infos[menshanweizhi]);
      }
    }
  }

  selectRectBefore() {
    const node = this.activeMokuaiNode;
    if (node) {
      if (!node.选中模块) {
        this.message.error("请先选择模块");
        return false;
      }
      if (!this.isFromOrder && !node.可选模块.find((v) => v.info?.isDefault)) {
        this.message.error("请先选择默认模块");
        return false;
      }
    }
    return true;
  }

  selectRect(info: MsbjRectInfo | null) {
    if (isEqual(this.activeRectInfo, info)) {
      return;
    }
    if (info?.raw.isBuju) {
      this.showMokuais = true;
      this.activeRectInfo = info;
    } else {
      this.showMokuais = false;
      this.activeRectInfo = null;
    }
    this.selectMokuai(this.activeMokuaiNode?.选中模块);
  }

  generateRectsEnd(event: GenerateRectsEndEvent) {
    const msbjRectsComponent = this.msbjRectsComponent;
    if (msbjRectsComponent?.rectInfos) {
      const rectInfos = msbjRectsComponent.rectInfosRelative.filter((v) => v.raw.isBuju);
      const activeRectInfo = this.activeRectInfo;
      let rectInfo = activeRectInfo ? rectInfos.find((v) => v.raw.vid === activeRectInfo?.raw.vid) : null;
      if (!rectInfo) {
        rectInfo = msbjRectsComponent.rectInfosRelative.filter((v) => v.raw.isBuju)[0];
      }
      if (rectInfo) {
        msbjRectsComponent.setCurrRectInfo(rectInfo, event.isWindowResize);
      }
      this.updateMokuaiInputInfo();
    }
  }

  async selectMokuai(mokuai: ZixuanpeijianMokuaiItem | null | undefined) {
    const mokuaiNode = this.activeMokuaiNode;
    const rectInfo = this.activeRectInfo;
    if (!mokuai || !mokuaiNode || !rectInfo) {
      return;
    }
    const mokuaiPrev = mokuaiNode.选中模块;
    if (mokuaiPrev) {
      const morenbancai = mokuaiPrev.morenbancai;
      if (!this.validateMorenbancai(morenbancai)) {
        await this.message.error("请先选择默认板材");
        return;
      }
    }
    this.data?.setSelectedMokuai(mokuaiNode, mokuai, this.isFromOrder);
    this.updateMokuaiInputInfo();
    const mokuaiCurr = mokuaiNode.选中模块;
    if (!mokuaiPrev || !mokuaiCurr || !isMokuaiItemEqual(mokuaiPrev, mokuaiCurr)) {
      await this.suanliao();
    }
  }

  async removeMokuai(mokuai: ZixuanpeijianMokuaiItem | null | undefined) {
    const node = this.activeMokuaiNode;
    if (!node) {
      return;
    }
    if (await this.message.confirm("是否删除该可选模块？")) {
      const mokuais = node.可选模块.filter((v) => v.id !== mokuai?.id);
      await this.setKexuanmokuai(mokuais);
    }
  }

  setDefaultMokuai(mokuai: ZixuanpeijianMokuaiItem | null) {
    const mokuaiNode = this.activeMokuaiNode;
    if (!mokuaiNode) {
      return;
    }
    this.data?.setDefaultMokuai(mokuaiNode, mokuai?.id);
  }

  updateMokuaiInputInfo() {
    const mokuai = this.activeMokuaiNode?.选中模块;
    this.mokuaiInputInfos = [];
    const mokuaidaxiaoResult = this.activeMokuaidaxiaoResult;
    if (mokuai) {
      const node = this.activeMokuaiNode;
      const keyMap = {总宽: "totalWidth", 总高: "totalHeight"} as const;
      if (node) {
        const name = node.层名字;
        for (const key in keyMap) {
          const key3 = name + key;
          this.mokuaiInputInfos.push({
            type: "string",
            label: key,
            model: {key: key3, data: () => mokuaidaxiaoResult},
            readonly: true
          });
        }
      }
      const arr = mokuai.gongshishuru.concat(mokuai.xuanxiangshuru);
      const getValue = (vars: Formulas, k: string) => {
        const v = Number(vars[k]);
        if (!isNaN(v)) {
          return String(v);
        }
        return "";
      };
      for (const v of arr) {
        if (!v[1]) {
          v[1] = getValue(this.materialResult, v[0]);
        }
        v[1] = getValue(mokuaidaxiaoResult, v[0]) || v[1];
        this.mokuaiInputInfos.push({
          type: "string",
          label: v[0],
          model: {key: "1", data: v},
          onChange: async () => {
            const {data, activeMenshanKey} = this;
            const varNames = (await this.getVarNames()).concat(mokuai.shuchubianliang);
            const isShuchubianliang = varNames.includes(v[0]);
            const updateMenshanKeys = new Set<string>();
            if (data && activeMenshanKey) {
              for (const key in data.menshanbujuInfos) {
                for (const node2 of data.menshanbujuInfos[key].模块节点 || []) {
                  const mokuai2 = node2.选中模块;
                  if (mokuai2) {
                    const isCurrent = key === activeMenshanKey && node?.层名字 === node2.层名字;
                    if (!isCurrent) {
                      const arr2 = mokuai2.gongshishuru.concat(mokuai2.xuanxiangshuru);
                      for (const v2 of arr2) {
                        if (v2[0] === v[0]) {
                          v2[1] = v[1];
                        }
                      }
                    }
                    const msbjInfo = data.menshanbujuInfos[key];
                    if (msbjInfo && (isShuchubianliang || isCurrent)) {
                      if (v[0] in (msbjInfo.模块大小输出 || {})) {
                        if (!msbjInfo.模块大小输入) {
                          msbjInfo.模块大小输入 = {};
                        }
                        msbjInfo.模块大小输入[v[0]] = v[1];
                        updateMenshanKeys.add(key);
                      }
                    }
                  }
                }
              }
            }
            if (updateMenshanKeys.size > 0) {
              await this.updateOrder();
            }
            await this.suanliao();
          }
        });
      }
    }
  }

  async submit() {
    const {data: dataInfo, isFromOrder} = this;
    if (!dataInfo || isFromOrder) {
      return;
    }
    const errorXuaozhongMenshanKeys = new Set<string>();
    const errorMorenMenshanKeys = new Set<string>();
    const varKeysXinghao = Object.keys(getFromulasFromString(this.xinghao?.raw.gongshishuru));
    const duplicates1: {mokuai: ZixuanpeijianMokuaiItem; keys: string[]}[] = [];
    const duplicates2: {mokuais: ZixuanpeijianMokuaiItem[]; keys: string[]}[] = [];
    const msbjInfos: {menshanKey: string; msbjInfo: XhmrmsbjInfo}[] = [];
    const mokuaisWithoutBancai: {menshanKey: string; layerName: string; mokuai: ZixuanpeijianMokuaiItem}[] = [];
    for (const menshanKey in dataInfo.menshanbujuInfos) {
      msbjInfos.push({menshanKey, msbjInfo: dataInfo.menshanbujuInfos[menshanKey]});
    }
    for (let i = 0; i < msbjInfos.length; i++) {
      const {menshanKey, msbjInfo} = msbjInfos[i];
      for (const node of msbjInfo.模块节点 || []) {
        if (!dataInfo.铰扇跟随锁扇 || !menshanKey.includes("铰扇")) {
          if (!node.选中模块) {
            errorXuaozhongMenshanKeys.add(menshanKey);
          }
          if (!this.isFromOrder && !node.可选模块.find((v) => v.info?.isDefault)) {
            errorMorenMenshanKeys.add(menshanKey);
          }
        }
        for (const mokuai of node.可选模块) {
          const varKeysMokuai = mokuai.shuchubianliang;
          const keys1 = intersection(varKeysXinghao, varKeysMokuai);
          if (keys1.length > 0) {
            duplicates1.push({mokuai, keys: keys1});
          }
          for (let j = i + 1; j < msbjInfos.length; j++) {
            for (const node2 of msbjInfos[i].msbjInfo.模块节点 || []) {
              for (const mokuai2 of node2.可选模块) {
                if (isMokuaiItemEqual(mokuai, mokuai2)) {
                  continue;
                }
                const varKeysMokuai2 = mokuai2.shuchubianliang;
                const keys2 = intersection(varKeysMokuai, varKeysMokuai2);
                if (keys2.length > 0) {
                  duplicates2.push({mokuais: [mokuai, mokuai2], keys: keys2});
                }
              }
            }
          }
          if (!this.validateMorenbancai(mokuai.morenbancai)) {
            mokuaisWithoutBancai.push({mokuai, menshanKey, layerName: node.层名字});
          }
        }
      }
    }
    if (duplicates1.length > 0) {
      const list = duplicates1.map(({mokuai, keys}) => `${getMokuaiTitle(mokuai)}: ${keys.join("，")}`);
      await this.message.error({content: "模块输出变量与型号公式输入重复", details: list});
      return;
    }
    if (errorXuaozhongMenshanKeys.size > 0) {
      await this.message.error({content: "布局中存在未选中的模块", details: Array.from(errorXuaozhongMenshanKeys).join("，")});
      return;
    }
    if (errorMorenMenshanKeys.size > 0) {
      await this.message.error({content: "布局中存在未设置默认模块的模块", details: Array.from(errorMorenMenshanKeys).join("，")});
      return;
    }
    if (mokuaisWithoutBancai.length > 0) {
      const details = mokuaisWithoutBancai.map((v) => getMokuaiTitle(v.mokuai, {门扇名字: v.menshanKey, 层名字: v.layerName}));
      await this.message.error({content: "以下模块未设置默认板材分组", details});
      return;
    }
    const data: TableUpdateParams<MsbjData>["data"] = dataInfo.export();
    delete data.mingzi;
    await this.http.tableUpdate({table, data});
  }

  async openMrbcjfzDialog() {
    if (!this.xinghao || this.isFromOrder) {
      return;
    }
    const result = await openMrbcjfzDialog(this.dialog, {data: {id: this.xinghao.raw.vid, table: "p_xinghao"}});
    if (result) {
      this.xinghao = result.data;
    }
  }

  async setTabName(name: XhmrmsbjTabName) {
    this.activeTabName = name;
    await timeout(0);
    this.msbjRectsComponent?.generateRects();
  }

  isMokuaiActive(mokuai: ZixuanpeijianTypesInfoItem) {
    return this.activeMokuaiNode?.选中模块?.id === mokuai.id;
  }

  async setKexuanmokuai(mokuais?: ZixuanpeijianMokuaiItem[]) {
    const rectInfo = this.activeRectInfo;
    const mokuaiNode = this.activeMokuaiNode;
    if (!rectInfo || !mokuaiNode) {
      return;
    }
    if (!mokuais) {
      const step1Data = cloneDeep(this.step1Data);
      for (const type1 in step1Data.typesInfo) {
        for (const type2 in step1Data.typesInfo[type1]) {
          step1Data.typesInfo[type1][type2].unique = true;
        }
      }
      const 模块: ZixuanpeijianMokuaiItem[] = [];
      for (const type1 in this.step1Data.typesInfo) {
        for (const type2 in this.step1Data.typesInfo[type1]) {
          const info = this.step1Data.typesInfo[type1][type2];
          if (mokuaiNode.可选模块.find((v) => v.id === info.id)) {
            模块.push({...info, type1, type2, totalWidth: "", totalHeight: "", cads: []});
          }
        }
      }
      const result = await openZixuanpeijianDialog(this.dialog, {
        data: {step: 1, step1Data, data: {模块}, checkEmpty: false, stepFixed: true}
      });
      mokuais = result?.模块;
    }
    if (mokuais) {
      const mokuais2 = mokuais;
      mokuaiNode.可选模块 = mokuaiNode.可选模块.filter((v) => mokuais2.find((v2) => v.id === v2.id));
      for (const item of mokuais2) {
        if (!mokuaiNode.可选模块.find((v) => v.id === item.id)) {
          mokuaiNode.可选模块.push(item);
        }
        const 选中模块 = mokuaiNode.选中模块;
        if (选中模块 && !mokuaiNode.可选模块.find((v) => v.id === 选中模块.id)) {
          delete mokuaiNode.选中模块;
        }
      }
    }
  }

  getBancaixuanze(item: MrbcjfzInfo) {
    if (this.isFromOrder) {
      return item.选中板材分组;
    } else {
      return item.默认对应板材分组;
    }
  }

  async setBancaixuanze(item: MrbcjfzInfo, value: string) {
    const morenbancai = this.xinghao?.默认板材[value];
    if (this.isFromOrder) {
      const md5Prev = md5(JSON.stringify(item));
      item.选中板材分组 = value;
      item.选中板材 = "";
      item.选中材料 = "";
      item.选中板材厚度 = "";
      const md5Curr = md5(JSON.stringify(item));
      if (md5Prev !== md5Curr) {
        await this.suanliao();
      }
    } else {
      item.默认对应板材分组 = value;
      item.默认开料板材 = morenbancai?.默认开料板材 || "";
      item.默认开料材料 = morenbancai?.默认开料材料 || "";
      item.默认开料板材厚度 = morenbancai?.默认开料板材厚度 || "";
    }
  }

  getMsbj(id: number) {
    return this.msbjs.find((v) => v.vid === id);
  }

  async editMokuaidaxiao() {
    const msbjInfo = this.activeMsbjInfo;
    if (!msbjInfo) {
      return;
    }
    const 选中布局数据 = msbjInfo.选中布局数据;
    if (!选中布局数据) {
      return;
    }
    if (this.isFromOrder) {
      const menshanKey = this.activeMenshanKey;
      this.wmm.postMessage("编辑模块大小", {menshanKey, msbjInfo});
    } else {
      let msbj: MsbjInfo | null = null;
      if (this.http.token) {
        const msbjs = await this.http.queryMySql({table: "p_menshanbuju", filter: {where: {vid: 选中布局数据.vid}}});
        if (msbjs[0]) {
          msbj = new MsbjInfo(msbjs[0], this.getNode2rectData());
        }
      }
      const data = await this.message.json(选中布局数据.模块大小关系, {
        defaultJson: msbj?.peizhishuju.模块大小关系 ?? mokuaidaxiaoData,
        btnTexts: {reset: "重置为默认模块大小"}
      });
      if (data) {
        选中布局数据.模块大小关系 = data;
      }
    }
  }

  async refreshMokuaidaxiao() {
    const data = this.data;
    if (!data) {
      return;
    }
    this.spinner.show(this.spinner.defaultLoaderId, {text: "获取模块大小配置"});
    const records = await this.http.queryMySql<XhmrmsbjTableData>(
      {
        table: "p_xinghaomorenmenshanbuju",
        filter: {where: {vid: this.id}}
      },
      {spinner: false}
    );
    if (records[0]) {
      const data2 = new XhmrmsbjData(records[0], this.menshanKeys, this.step1Data.typesInfo, this.msbjs);
      for (const menshanKey of this.menshanKeys) {
        const msbjInfo1 = data.menshanbujuInfos[menshanKey];
        const msbjInfo2 = data2.menshanbujuInfos[menshanKey];
        if (!msbjInfo1 || !msbjInfo2) {
          continue;
        }
        const 选中布局数据1 = msbjInfo1.选中布局数据;
        const 选中布局数据2 = msbjInfo2.选中布局数据;
        if (选中布局数据1 && 选中布局数据2) {
          选中布局数据1.模块大小关系 = 选中布局数据2.模块大小关系;
        }
        await this.refreshMokuaidaxiaoResults(menshanKey);
      }
    }
    await this.suanliao();
    this.spinner.hide(this.spinner.defaultLoaderId);
    this.message.snack("更新完成");
  }

  async suanliao() {
    if (!this.isFromOrder) {
      return;
    }
    if (this.suanliaoLock$.value) {
      await firstValueFrom(this.suanliaoLock$.pipe(filter((v) => !v)));
    }
    this.suanliaoLock$.next(true);
    const timerName = "模块算料";
    timer.start(timerName);
    this.spinner.show(this.spinner.defaultLoaderId, {text: timerName});
    this.wmm.postMessage("suanliaoStart", this.submitData().data);
    const data = await this.wmm.waitForMessage("suanliaoEnd");
    await this.requestData(data);
    this.activeMsbj?.updateRectsInfo(this.getNode2rectData());
    if (this.msbjRectsComponent) {
      this.msbjRectsComponent.rectInfos = this.activeMsbj?.peizhishuju.模块节点 || [];
    }
    await this.updateMokuaidaxiaoResults();
    timer.end(timerName, timerName);
    this.spinner.hide(this.spinner.defaultLoaderId);
    this.suanliaoLock$.next(false);
    this.genXiaoguotu();
  }

  async genXiaoguotu() {
    if (!this.isFromOrder || this.ignoreXiaoguotu) {
      return;
    }
    if (this.genXiaoguotuLock$.value) {
      await firstValueFrom(this.genXiaoguotuLock$.pipe(filter((v) => !v)));
    }
    this.genXiaoguotuLock$.next(true);
    const timerName = "生成效果图";
    timer.start(timerName);
    this.wmm.postMessage("genXiaoguotuStart");
    const data = await this.wmm.waitForMessage("genXiaoguotuEnd");
    const items = data[this.activeMenshanKey || ""] || [];
    if (items.length > 0) {
      const container = this.xiaoguotuContainer?.nativeElement;
      if (!container) {
        return;
      }
      container.innerHTML = "";
      container.style.transform = "";
      container.style.opacity = "0";
      await timeout(0);
      const rectContainer0 = container.getBoundingClientRect();
      const rectContainer = new Rectangle([rectContainer0.left, rectContainer0.top], [rectContainer0.right, rectContainer0.bottom]);
      const padding = this.msbjRectsComponent?.padding || [0, 0, 0, 0];
      rectContainer.min.add(new Point(padding[3], padding[0]));
      rectContainer.max.sub(new Point(padding[1], padding[2]));
      const els: HTMLDivElement[] = [];
      for (const item of items) {
        let div = document.createElement("div");
        div.innerHTML = item;
        div = div.firstElementChild as HTMLDivElement;
        container.appendChild(div);
        els.push(div);
      }
      await timeout(0);
      const rect = Rectangle.min;
      for (const el of els) {
        const {top, right, bottom, left, width, height} = el.getBoundingClientRect();
        if (width > 0 && height > 0) {
          rect.expandByPoint(new Point(left, top));
          rect.expandByPoint(new Point(right, bottom));
        }
      }
      const scaleX = rectContainer.width / rect.width;
      const scaleY = rectContainer.height / rect.height;
      const scale = Math.min(scaleX, scaleY);
      const dx = (rectContainer.left - rect.left) * scale + (rectContainer.width - rect.width * scale) / 2;
      const dy = (rectContainer.bottom - rect.bottom) * scale + (rectContainer.height - rect.height * scale) / 2;
      container.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      container.style.opacity = "1";
    }
    timer.end(timerName, timerName);
    this.genXiaoguotuLock$.next(false);
  }

  async getLastSuanliao() {
    this.wmm.postMessage("getLastSuanliaoStart");
    const data = await this.wmm.waitForMessage<LastSuanliao | null>("getLastSuanliaoEnd");
    return data;
  }

  async updateOrder() {
    this.wmm.postMessage("updateOrderStart", {型号选中门扇布局: this.data?.menshanbujuInfos});
    await this.wmm.waitForMessage("updateOrderEnd");
  }

  async getVarNames() {
    this.wmm.postMessage("getVarNamesStart");
    const data = await this.wmm.waitForMessage<string[]>("getVarNamesEnd");
    return data;
  }

  async openMokuais() {
    const lastSuanliao = await this.getLastSuanliao();
    if (!lastSuanliao) {
      return;
    }
    const mokuaidaxiaoResults = this.mokuaidaxiaoResults;
    openXhmrmsbjMokuaisDialog(this.dialog, {data: {data: {lastSuanliao, mokuaidaxiaoResults}}});
  }

  openHoutaiUrl() {
    window.open(this.houtaiUrl);
  }

  getNode2rectData() {
    const m = this.materialResult;
    const result: Node2rectData = {
      模块层ID: {},
      当前扇名字: this.activeMenshanKey || "",
      门扇大小: {},
      模块大小: this.activeMokuaidaxiaoResult
    };
    for (const key of node2rectDataMsdxKeys) {
      result.门扇大小[key] = m[key];
    }
    for (const rect of this.msbjRectsComponent?.rectInfosAbsolute || []) {
      if (rect.name) {
        result.模块层ID[rect.name] = rect.raw.vid;
      }
    }
    return result;
  }

  getMokuaiTitle2(mokuai: ZixuanpeijianMokuaiItem | null) {
    return getMokuaiTitle(mokuai, {type1As: "模块名字"}) || "无";
  }
}
