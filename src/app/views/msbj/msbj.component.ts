import {CdkDragDrop, CdkDropListGroup, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal, viewChild} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {ActivatedRoute} from "@angular/router";
import {setGlobal} from "@app/app.common";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {GenerateRectsOpts, MsbjRectsComponent} from "@components/msbj-rects/msbj-rects.component";
import {MsbjRectInfo} from "@components/msbj-rects/msbj-rects.types";
import {environment} from "@env";
import {CadData} from "@lucilor/cad-viewer";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {TableDataBase, TableUpdateParams} from "@modules/http/services/cad-data.service.types";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService} from "@services/app-status.service";
import {NgScrollbar} from "ngx-scrollbar";
import {InputComponent} from "../../modules/input/components/input.component";
import {MsbjData, MsbjFenlei, MsbjInfo} from "./msbj.types";

@Component({
  selector: "app-msbj",
  templateUrl: "./msbj.component.html",
  styleUrls: ["./msbj.component.scss"],
  standalone: true,
  imports: [CadImageComponent, CdkDropListGroup, InputComponent, MatButtonModule, MsbjRectsComponent, NgScrollbar],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MsbjComponent implements AfterViewInit {
  private http = inject(CadDataService);
  private message = inject(MessageService);
  private route = inject(ActivatedRoute);
  private status = inject(AppStatusService);

  production = environment.production;
  table = signal("");
  msbjInfo = signal<MsbjInfo | null>(null);
  dataField: keyof Omit<MsbjData, keyof TableDataBase> = "peizhishuju";
  fenleiListDataType!: {$implicit: MsbjFenlei[]; class: string};
  cads = signal<{data: CadData}[]>([]);
  msbjRects = viewChild(MsbjRectsComponent);

  constructor() {
    setGlobal("msbj", this);
  }

  async ngAfterViewInit() {
    const {table = "", id = "", field} = this.route.snapshot.queryParams;
    this.table.set(table || "");
    this.dataField = field === "peizhishuju" ? field : "menshanbujumorenfenlei";
    const msbjData = await this.http.queryMySql<MsbjData>({table, filter: {where: {vid: id}}});
    if (msbjData[0]) {
      this.msbjInfo.set(new MsbjInfo(msbjData[0]));
      const getCadResult = await this.http.getCad({collection: "cad", search: {"选项.门扇布局": msbjData[0].mingzi}});
      this.cads.set(getCadResult.cads.map<ReturnType<MsbjComponent["cads"]>[number]>((data) => ({data})));
    } else {
      this.msbjInfo.set(null);
      this.cads.set([]);
    }
  }

  generateRects(opts: GenerateRectsOpts) {
    this.msbjRects()?.generateRects(opts);
  }

  currRectInfo = signal<MsbjRectInfo | null>(null);
  inputInfos = computed(() => {
    const rectInfo = this.currRectInfo();
    const isBuju = rectInfo?.raw.isBuju;
    const infos: InputInfo[] = [
      {
        type: "string",
        label: "名字",
        readonly: true,
        value: rectInfo?.name || ""
      },
      {
        type: "string",
        label: "选项名称",
        readonly: !isBuju,
        model: isBuju ? {data: rectInfo, key: "选项名称"} : undefined,
        onInput: (val) => {
          if (isBuju) {
            const rectInfo2 = this.msbjInfo()?.peizhishuju.模块节点.find((v) => v.vid === rectInfo.raw.vid);
            if (rectInfo2) {
              rectInfo2.选项名称 = val;
            }
          }
        },
        validators: isBuju
          ? [
              Validators.required,
              (control) => {
                const rects = this.msbjInfo()?.peizhishuju.模块节点 || [];
                const name = control.value;
                for (const rect of rects) {
                  if (!rect.isBuju || rect.vid === rectInfo.raw.vid) {
                    continue;
                  }
                  if (name && rect.选项名称 === name) {
                    return {选项名称重复: true};
                  }
                }
                return null;
              }
            ]
          : []
      }
    ];
    return infos;
  });

  updateCurrRectInfo() {
    const currRectInfo = this.msbjRects()?.currRectInfo;
    if (!currRectInfo) {
      return;
    }
  }

  dropFenlei(event: CdkDragDrop<MsbjFenlei[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    this.updateCurrRectInfo();
  }

  async submit() {
    const msbjInfo = this.msbjInfo();
    if (!msbjInfo) {
      return;
    }
    const table = this.table();
    const data: TableUpdateParams<MsbjData>["data"] = {vid: msbjInfo.vid};
    const rectInfos = this.msbjRects()?.rectInfosRelative.map((v) => v.raw) || [];

    const errors = new Set<string>();
    const namesInfo = new Map<string, {nodeNames: string[]; count: number}>();
    for (const info of rectInfos) {
      if (info.isBuju) {
        if (info.选项名称 && info.name) {
          const nameInfo = namesInfo.get(info.选项名称) || {nodeNames: [], count: 0};
          nameInfo.nodeNames.push(info.name);
          nameInfo.count++;
          namesInfo.set(info.选项名称, nameInfo);
        } else {
          errors.add(`模块【${info.name}】选项名称不能为空`);
        }
      }
    }
    for (const [name, nameInfo] of namesInfo) {
      if (nameInfo.count > 1) {
        errors.add(`模块【${nameInfo.nodeNames.join(", ")}】的选项名称【${name}】重复`);
      }
    }
    if (errors.size > 0) {
      await this.message.error([...errors].join("<br>"));
      return;
    }

    msbjInfo.peizhishuju.模块节点 = rectInfos;
    data[this.dataField] = JSON.stringify(msbjInfo.peizhishuju);
    await this.http.tableUpdate({table, data});
  }

  async editMokuaidaxiao() {
    const info = this.msbjInfo();
    if (!info) {
      return;
    }
    const result = await this.message.json(info.peizhishuju.模块大小关系);
    if (result) {
      info.peizhishuju.模块大小关系 = result;
    }
  }

  openCad(data: CadData) {
    this.status.openCadInNewTab(data.id, "cad");
  }
}
