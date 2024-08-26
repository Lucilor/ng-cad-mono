import {KeyValuePipe, NgTemplateOutlet} from "@angular/common";
import {Component, HostBinding, Inject, OnInit} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {setGlobal} from "@app/app.common";
import {CadCollection} from "@app/cad/collections";
import {openCadListDialog} from "@app/components/dialogs/cad-list/cad-list.component";
import {CadListInput} from "@app/components/dialogs/cad-list/cad-list.types";
import {getHoutaiCad} from "@app/modules/http/services/cad-data.service.utils";
import {getOpenDialogFunc} from "@components/dialogs/dialog.common";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerModule} from "@modules/spinner/spinner.module";
import {AppStatusService} from "@services/app-status.service";
import {uniqueId} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {CadItemComponent} from "../cad-item/cad-item.component";
import {CadItemButton} from "../cad-item/cad-item.types";
import {
  TongyongshujuActiveCadList,
  TongyongshujuActiveItem,
  TongyongshujuCadItemInfo,
  TongyongshujuData,
  TongyongshujuInput,
  TongyongshujuOutput
} from "./tongyongshuju-dialog.types";

@Component({
  selector: "app-tongyongshuju-dialog",
  standalone: true,
  imports: [CadItemComponent, KeyValuePipe, MatButtonModule, MatDividerModule, NgScrollbarModule, NgTemplateOutlet, SpinnerModule],
  templateUrl: "./tongyongshuju-dialog.component.html",
  styleUrl: "./tongyongshuju-dialog.component.scss"
})
export class TongyongshujuDialogComponent implements OnInit {
  @HostBinding("class") class = "ng-page";

  collection: CadCollection = "cad";
  tableData: TongyongshujuData[] = [];
  activeItem: TongyongshujuActiveItem | null = null;
  activeItemPrev: TongyongshujuActiveItem | null = null;
  activeCadList: TongyongshujuActiveCadList | null = null;
  cadItemButtons: CadItemButton<TongyongshujuCadItemInfo>[];

  tabelListLoader = uniqueId("tabelListLoader");
  activeItemLoader = uniqueId("activeItemLoader");
  cadListLoader = uniqueId("cadListLoader");

  constructor(
    private http: CadDataService,
    private status: AppStatusService,
    private message: MessageService,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<TongyongshujuDialogComponent, TongyongshujuOutput>,
    @Inject(MAT_DIALOG_DATA) public data: TongyongshujuInput
  ) {
    setGlobal("tongyongshujuDialog", this);
    this.cadItemButtons = [
      {name: "复制", onClick: this.copyCad.bind(this)},
      {name: "删除", onClick: this.deleteCad.bind(this)}
    ];
  }

  ngOnInit() {
    if (!this.data) {
      return;
    }
    this.refresh(0);
  }

  async refresh(i?: number, j?: number) {
    this.tableData = await this.http.queryMySql<TongyongshujuData>({table: "p_tongyongshujuluru"}, {spinner: this.tabelListLoader});
    if (typeof i === "number" && this.tableData.length > i) {
      await this.clickTableListItem(i);
    }
    const {activeItem, activeItemPrev} = this;
    if (activeItem) {
      if (activeItemPrev && activeItemPrev.index === activeItem.index) {
        let maxVid1 = -1;
        let maxVid2 = -1;
        let maxVid2Index = -1;
        for (const item of activeItemPrev.data) {
          if (item.vid > maxVid1) {
            maxVid1 = item.vid;
          }
        }
        for (const [k, item] of activeItem.data.entries()) {
          if (item.vid > maxVid2) {
            maxVid2 = item.vid;
            maxVid2Index = k;
          }
        }
        if (maxVid2 > maxVid1) {
          j = maxVid2Index;
        }
      }
      if (typeof j === "number") {
        await this.clickActiveItem(activeItem.index, j);
      }
    }
  }

  close() {
    this.dialogRef.close();
  }

  replaceCadStr(str: string, index?: number) {
    const {activeItem} = this;
    const replaceFrom = "当前选项";
    const shouldReplace = str.includes(replaceFrom);
    if (!shouldReplace) {
      return str;
    }
    if (typeof index === "number") {
      const data = activeItem?.data[index];
      if (data?.mingzi) {
        return str.replaceAll(replaceFrom, data.mingzi);
      }
    }
    this.message.error("没有当前选项");
    return null;
  }

  isDataHaveCad(item: TongyongshujuData) {
    const {xuyaocad} = item;
    return xuyaocad === "需要" || xuyaocad === "可以没有";
  }

  async setActiveItem(index: number) {
    const item = this.tableData[index];
    this.activeItemPrev = this.activeItem;
    this.activeItem = null;
    if (item.active && item.xiaodaohang) {
      const struct = await this.http.getXiaodaohangStructure(item.xiaodaohang, {spinner: this.activeItemLoader});
      if (struct?.table) {
        const data = await this.http.queryMySql({table: struct.table, fields: ["mingzi"]}, {spinner: this.activeItemLoader});
        this.activeItem = {
          data: data.map<TongyongshujuActiveItem["data"][number]>((v) => {
            return {...v, active: false};
          }),
          index
        };
        this.activeCadList = null;
      } else {
        this.activeItem = {data: [], index};
        await this.setActiveCadList(item);
      }
    }
  }

  refreshActiveCadList() {
    const {activeItem, activeCadList} = this;
    if (!activeItem || !activeCadList) {
      return;
    }
    return this.setActiveCadList(this.tableData[activeItem.index], activeCadList.index);
  }

  async setActiveCadList(item: TongyongshujuData, index?: number) {
    const {activeItem} = this;
    if (!activeItem) {
      return;
    }
    this.activeCadList = null;
    if (item.active && this.isDataHaveCad(item)) {
      let $where: string | null = item.cadshaixuanyaoqiu;
      $where = this.replaceCadStr($where, index);
      if (!$where) {
        return;
      }
      const cads = await this.http.queryMongodb<HoutaiCad>({collection: this.collection, where: {$where}}, {spinner: this.cadListLoader});
      this.activeCadList = {
        index,
        data: cads
      };
    }
  }

  async clickTableListItem(i: number) {
    for (const [j, item] of this.tableData.entries()) {
      if (i === j) {
        item.active = true;
        await this.setActiveItem(i);
      } else {
        item.active = false;
      }
    }
  }

  async editTableListItem(i: number) {
    const item = this.tableData[i];
    if (!item.xiaodaohang) {
      return;
    }
    let url: string | null;
    if (item.url) {
      url = item.url;
    } else {
      url = await this.http.getShortUrl(item.xiaodaohang);
      item.url = url || "";
    }
    if (url) {
      window.open(url, "_blank");
      if (await this.message.newTabConfirm()) {
        this.refresh(this.activeItem?.index, this.activeCadList?.index);
      }
    } else {
      this.message.error("没有对应的表");
    }
  }

  helpTableListItem(i: number) {
    const item = this.tableData[i];
    if (!item.bangzhuwendang) {
      return;
    }
    window.open(item.bangzhuwendang, "_blank");
  }

  async clickActiveItem(i: number, j: number) {
    for (const [k, item] of (this.activeItem?.data || []).entries()) {
      if (j === k) {
        item.active = true;
        await this.setActiveCadList(this.tableData[i], j);
      } else {
        item.active = false;
      }
    }
  }

  getShujuyaoqiu(item: TongyongshujuData) {
    return this.status.getCad数据要求(item.cadyaoqiu);
  }

  async addCadFromList() {
    const item = this.tableData[this.activeItem?.index ?? -1];
    const item2 = this.activeItem?.data[this.activeCadList?.index ?? -1];
    if (!item || !item2) {
      return;
    }
    const yaoqiu = this.getShujuyaoqiu(item);
    let fixedSearch: CadListInput["fixedSearch"];
    if (yaoqiu?.选择CAD弹窗筛选数据要求) {
      fixedSearch = {$where: yaoqiu.选择CAD弹窗筛选数据要求};
    } else {
      fixedSearch = {分类: item.cadyaoqiu};
    }
    const result = await openCadListDialog(this.dialog, {
      data: {collection: "cad", selectMode: "single", checkedItemsLimit: 1, fixedSearch, yaoqiu, vars: {当前选项: item2.mingzi}}
    });
    if (result) {
      const {collection} = this;
      for (const cad of result) {
        cad.id = "";
        cad.options[item.mingzi] = item2.mingzi;
        await this.http.mongodbInsert(collection, getHoutaiCad(cad), {force: true}, {spinner: this.cadListLoader});
        await this.refreshActiveCadList();
      }
    }
  }

  async copyCad(component: CadItemComponent<TongyongshujuCadItemInfo>) {
    const item = this.activeCadList?.data[component.customInfo.index];
    if (!item || !(await this.message.confirm("确定复制该CAD吗？"))) {
      return;
    }
    const success = await this.http.mongodbCopy(this.collection, [item._id], {}, {spinner: this.cadListLoader});
    if (success) {
      await this.refreshActiveCadList();
    }
  }

  async deleteCad(component: CadItemComponent<TongyongshujuCadItemInfo>) {
    const item = this.activeCadList?.data[component.customInfo.index];
    if (!item || !(await this.message.confirm("确定删除该CAD吗？"))) {
      return;
    }
    const success = await this.http.mongodbDelete(this.collection, {id: item._id}, {spinner: this.cadListLoader});
    if (success) {
      await this.refreshActiveCadList();
    }
  }

  editCad(item: HoutaiCad) {
    this.http.mongodbUpdate(this.collection, item, {}, {spinner: this.cadListLoader});
  }

  returnZero() {
    return 0;
  }
}

export const openTongyongshujuDialog = getOpenDialogFunc<TongyongshujuDialogComponent, TongyongshujuInput, TongyongshujuOutput>(
  TongyongshujuDialogComponent,
  {width: "100%", height: "100%"}
);
