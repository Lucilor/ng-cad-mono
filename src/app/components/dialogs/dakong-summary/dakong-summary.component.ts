import {ChangeDetectionStrategy, Component, computed, effect, HostBinding, inject, Inject, signal, untracked} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {MatSlideToggleChange, MatSlideToggleModule} from "@angular/material/slide-toggle";
import {session, setGlobal} from "@app/app.common";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {queryString} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {InputInfo} from "@modules/input/components/input.types";
import {AppStatusService} from "@services/app-status.service";
import {NgScrollbar} from "ngx-scrollbar";
import {InputComponent} from "../../../modules/input/components/input.component";
import {getOpenDialogFunc} from "../dialog.common";
import {
  DakongSummaryInput,
  DakongSummaryOutput,
  DakongSummaryTableColumn,
  DakongSummaryTableData,
  DakongSummaryTableInfo
} from "./dakong-summary.types";

@Component({
  selector: "app-dakong-summary",
  templateUrl: "./dakong-summary.component.html",
  styleUrls: ["./dakong-summary.component.scss"],
  standalone: true,
  imports: [CadImageComponent, FormsModule, InputComponent, MatButtonModule, MatSlideToggleModule, NgScrollbar],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DakongSummaryComponent {
  private http = inject(CadDataService);
  private status = inject(AppStatusService);

  @HostBinding("class") class = ["ng-page"];

  constructor(
    public dialogRef: MatDialogRef<DakongSummaryComponent, DakongSummaryOutput>,
    @Inject(MAT_DIALOG_DATA) public data: DakongSummaryInput
  ) {
    setGlobal("dakongSummary", this);
    this.updateTableInfo();
  }

  tableInfos = signal<DakongSummaryTableInfo[]>([]);
  tableColumnsAll = signal<DakongSummaryTableColumn[]>([
    {field: "cadId", name: "开孔CAD的id"},
    {field: "cadName", name: "开孔CAD名字"},
    {field: "peizhiId", name: "孔位配置id"},
    {field: "peizhiName", name: "孔位配置名字"},
    {field: "kongId", name: "孔的id"},
    {field: "kongName", name: "孔名字"},
    {field: "face", name: "开孔面"},
    {field: "count", name: "开孔结果"},
    {field: "error", name: "不开孔原因"}
  ]);
  tableColumns = computed<DakongSummaryTableColumn[]>(() => {
    const columns = this.tableColumnsAll();
    if (this.showIds()) {
      return columns.slice();
    } else {
      const idFields: (keyof DakongSummaryTableData)[] = ["cadId", "peizhiId", "kongId"];
      return columns.filter((item) => !idFields.includes(item.field));
    }
  });
  ordersCodeText = computed(() => {
    const infos = this.tableInfos();
    return infos.map((v) => v.code).join(", ");
  });

  showIds = signal(session.load("dakongSummaryShowIds") ?? false);
  showIdsEff = effect((value) => {
    session.save("dakongSummaryShowIds", value);
  });

  form = signal({
    strictFilter: false,
    filterCad: "",
    filterPeizhi: "",
    filterKong: "",
    filterFace: ""
  });
  formEff = effect(() => {
    this.form();
    untracked(() => this.filterTableData());
  });
  formInputInfos = computed<InputInfo[]>(() => {
    const form = this.form();
    const infos: InputInfo[] = [
      {
        type: "string",
        label: "开孔CAD名字",
        value: form.filterCad,
        onInput: (val) => {
          this.form.update((v) => ({...v, filterCad: val}));
        }
      },
      {
        type: "string",
        label: "孔位配置名字",
        value: form.filterPeizhi,
        onInput: (val) => {
          this.form.update((v) => ({...v, filterPeizhi: val}));
        }
      },
      {
        type: "string",
        label: "孔名字",
        value: form.filterKong,
        onInput: (val) => {
          this.form.update((v) => ({...v, filterKong: val}));
        }
      },
      {
        type: "string",
        label: "开孔面",
        value: form.filterFace,
        onInput: (val) => {
          this.form.update((v) => ({...v, filterFace: val}));
        }
      }
    ];
    return infos;
  });

  updateTableInfo() {
    const tableInfos: DakongSummaryTableInfo[] = [];
    for (const code in this.data.data) {
      const items = this.data.data[code] || [];
      const data: DakongSummaryTableData[] = [];
      for (const item of items) {
        for (const detail of item.summary || []) {
          data.push({
            cadId: item.cadId,
            cadName: item.cadName,
            muban: item.muban,
            peizhiName: item.peizhiName,
            hidden: false,
            ...detail
          });
        }
      }
      tableInfos.push({code, data});
    }
    this.tableInfos.set(tableInfos);
    this.filterTableData();
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

  onStrictFilterChange(event: MatSlideToggleChange) {
    this.form.update((v) => ({...v, strictFilter: event.checked}));
    this.filterTableData();
  }
  filterTableData() {
    const {strictFilter, filterCad, filterPeizhi, filterKong, filterFace} = this.form();
    const filter = (needle: string, haystack: string) => {
      if (strictFilter) {
        return !needle || needle === haystack;
      } else {
        return queryString(needle, haystack);
      }
    };
    const tableInfos = this.tableInfos().slice();
    for (const info of tableInfos) {
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
        if (!filter(filterFace, item.face)) {
          item.hidden = true;
        }
      }
    }
    this.tableInfos.set(tableInfos);
  }

  openMuban(item: DakongSummaryTableData) {
    if (item.muban) {
      this.status.openCadInNewTab(item.muban.id, "kailiaocadmuban");
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
