import {NgClass} from "@angular/common";
import {Component, Inject} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {imgCadEmpty, session, setGlobal} from "@app/app.common";
import {getCadPreview} from "@app/cad/cad-preview";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf, queryString} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {InputInfo} from "@modules/input/components/input.types";
import {AppStatusService} from "@services/app-status.service";
import {NgScrollbar} from "ngx-scrollbar";
import {ImageComponent} from "../../../modules/image/components/image/image.component";
import {InputComponent} from "../../../modules/input/components/input.component";
import {getOpenDialogFunc} from "../dialog.common";
import {DakongSummaryInput, DakongSummaryOutput, DakongSummaryTableData, DakongSummaryTableInfo} from "./dakong-summary.types";

@Component({
  selector: "app-dakong-summary",
  templateUrl: "./dakong-summary.component.html",
  styleUrls: ["./dakong-summary.component.scss"],
  standalone: true,
  imports: [MatButtonModule, MatSlideToggleModule, FormsModule, InputComponent, NgScrollbar, NgClass, ImageComponent]
})
export class DakongSummaryComponent {
  tableInfos: DakongSummaryTableInfo[] = [];
  tableColumnsAll: {field: keyof DakongSummaryTableData; name: string}[] = [
    {field: "cadId", name: "开孔CAD的id"},
    {field: "cadName", name: "开孔CAD名字"},
    {field: "peizhiId", name: "孔位配置id"},
    {field: "peizhiName", name: "孔位配置名字"},
    {field: "kongId", name: "孔CAD的id"},
    {field: "kongName", name: "孔CAD名字"},
    {field: "face", name: "开孔面"},
    {field: "count", name: "开孔结果"},
    {field: "error", name: "不开孔原因"}
  ];
  tableColumns: typeof this.tableColumnsAll = [];
  private _showIds = session.load("dakongSummaryShowIds") ?? false;
  get showIds() {
    return this._showIds;
  }
  set showIds(value) {
    this._showIds = value;
    session.save("dakongSummaryShowIds", value);
    this.updateTableColumns();
  }
  cadImgs: ObjectOf<string> = {};
  form = {
    strictFilter: false,
    filterCad: "",
    filterPeizhi: "",
    filterKong: ""
  };
  formInputInfos: InputInfo[];

  constructor(
    public dialogRef: MatDialogRef<DakongSummaryComponent, DakongSummaryOutput>,
    @Inject(MAT_DIALOG_DATA) public data: DakongSummaryInput,
    private status: AppStatusService,
    private http: CadDataService
  ) {
    setGlobal("dakongSummary", this);
    this.updateTableInfo();
    this.updateTableColumns();
    this.formInputInfos = [
      {
        type: "string",
        label: "CAD名字",
        model: {key: "filterCad", data: this.form},
        onInput: () => {
          this.filterTableData();
        }
      },
      {
        type: "string",
        label: "孔位配置名字",
        model: {key: "filterPeizhi", data: this.form},
        onInput: () => {
          this.filterTableData();
        }
      },
      {
        type: "string",
        label: "孔名字",
        model: {key: "filterKong", data: this.form},
        onInput: () => {
          this.filterTableData();
        }
      }
    ];
  }

  updateTableInfo() {
    this.tableInfos = [];
    for (const code in this.data.data) {
      const items = this.data.data[code] || [];
      const data: DakongSummaryTableData[] = [];
      for (const item of items) {
        for (const detail of item.summary || []) {
          this.getCadImg(item.cadId);
          this.getCadImg(detail.kongId);
          data.push({
            cadId: item.cadId,
            cadName: item.cadName,
            peizhiName: item.cadName,
            hidden: false,
            ...detail
          });
        }
      }
      this.tableInfos.push({code, data});
    }
    this.filterTableData();
  }

  updateTableColumns() {
    if (this.showIds) {
      this.tableColumns = this.tableColumnsAll;
    } else {
      const idFields: (keyof DakongSummaryTableData)[] = ["cadId", "peizhiId", "kongId"];
      this.tableColumns = this.tableColumnsAll.filter((item) => !idFields.includes(item.field));
    }
  }

  openCad(item: DakongSummaryTableData) {
    this.status.openCadInNewTab(item.cadId, "cad");
  }

  openKongCad(item: DakongSummaryTableData) {
    this.status.openCadInNewTab(item.kongId, "cad");
  }

  async openKongpeizhi(item: DakongSummaryTableData) {
    const url = await this.http.getShortUrl("开料孔位配置", {search: {vid: item.peizhiId}});
    if (url) {
      open(url, "_blank");
    }
  }

  async getCadImg(id: string) {
    if (!this.cadImgs[id]) {
      const data = new CadData();
      data.id = id;
      this.cadImgs[id] = imgCadEmpty;
      this.cadImgs[id] = await getCadPreview("cad", data, {http: this.http});
    }
  }

  filterTableData() {
    const {strictFilter, filterCad, filterPeizhi, filterKong} = this.form;
    const filter = (needle: string, haystack: string) => {
      if (strictFilter) {
        return !needle || needle === haystack;
      } else {
        return queryString(needle, haystack);
      }
    };
    for (const info of this.tableInfos) {
      for (const item of info.data) {
        item.hidden = false;
        if (!filter(filterCad, item.cadName)) {
          item.hidden = true;
        }
        if (!filter(filterPeizhi, item.peizhiName)) {
          item.hidden = true;
        }
        if (!filter(filterKong, item.kongName)) {
          item.hidden = true;
        }
      }
    }
  }

  close() {
    this.dialogRef.close();
  }
}

export const openDakongSummaryDialog = getOpenDialogFunc<DakongSummaryComponent, DakongSummaryInput, DakongSummaryOutput>(
  DakongSummaryComponent,
  {
    width: "100%",
    height: "100%"
  }
);
