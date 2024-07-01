import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild
} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {MatTabsModule} from "@angular/material/tabs";
import {MatTooltipModule} from "@angular/material/tooltip";
import {ActivatedRoute} from "@angular/router";
import {KeyEventItem, onKeyEvent, session, setGlobal} from "@app/app.common";
import {Subscribed} from "@app/mixins/subscribed.mixin";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {InputComponent} from "@app/modules/input/components/input.component";
import {InputInfo} from "@app/modules/input/components/input.types";
import {MessageService} from "@app/modules/message/services/message.service";
import {SpinnerService} from "@app/modules/spinner/services/spinner.service";
import {getPdfInfo, htmlToPng} from "@app/utils/print";
import {environment} from "@env";
import {downloadByString, selectFiles} from "@lucilor/utils";
import {NgScrollbarModule} from "ngx-scrollbar";
import {createPdf} from "pdfmake/build/pdfmake";
import {TDocumentDefinitions} from "pdfmake/interfaces";
import printJS from "print-js";
import {PageComponentConfig2Component} from "../../menus/page-component-config2/page-component-config2.component";
import {PageComponentConfigComponent} from "../../menus/page-component-config/page-component-config.component";
import {PageComponentsSeletComponent} from "../../menus/page-components-select/page-components-select.component";
import {PageConfigComponent} from "../../menus/page-config/page-config.component";
import {PageStatusService} from "../../services/page-status.service";
import {pageModes, PagesDataRaw, Zidingyibaobiao} from "../../services/page-status.service.types";
import {PageComponentsDiaplayComponent} from "../page-components-diaplay/page-components-diaplay.component";

@Component({
  selector: "app-custom-page-index",
  standalone: true,
  imports: [
    InputComponent,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
    NgScrollbarModule,
    PageComponentConfigComponent,
    PageComponentConfig2Component,
    PageComponentsDiaplayComponent,
    PageComponentsSeletComponent,
    PageConfigComponent
  ],
  templateUrl: "./custom-page-index.component.html",
  styleUrl: "./custom-page-index.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomPageIndexComponent extends Subscribed() implements OnInit, OnDestroy {
  private http = inject(CadDataService);
  private message = inject(MessageService);
  private pageStatus = inject(PageStatusService);
  private route = inject(ActivatedRoute);
  private spinner = inject(SpinnerService);

  @HostBinding("class") class = "ng-page";

  get mode() {
    return this.pageStatus.mode;
  }
  get page() {
    return this.pageStatus.page;
  }
  get psm() {
    return this.pageStatus.psm;
  }
  get isSaved() {
    return this.pageStatus.isSaved;
  }
  get undo() {
    return this.pageStatus.undo.bind(this.pageStatus);
  }
  get redo() {
    return this.pageStatus.redo.bind(this.pageStatus);
  }
  get canUndo() {
    return this.pageStatus.canUndo;
  }
  get canRedo() {
    return this.pageStatus.canRedo;
  }

  private _menuTabIndexKey = "customPageMenuTabIndex";
  menuTabIndex = signal(session.load(this._menuTabIndexKey) || 0);
  keyEventItems: KeyEventItem[] = [
    {key: "z", ctrl: true, action: () => this.undo()},
    {key: "y", ctrl: true, action: () => this.redo()}
  ];
  toolbarInputs: InputInfo[];

  pageStyle = computed(() => {
    this.pageStatus.pageConfig();
    return this.page.getStyle();
  });
  workSpaceStyle = computed(() => {
    this.pageStatus.pageConfig();
    return this.page.workSpaceStyle;
  });

  workSpaceEl = viewChild.required<ElementRef<HTMLDivElement>>("workSpaceEl");
  pageEl = viewChild.required<ElementRef<HTMLDivElement>>("pageEl");

  constructor() {
    super();
    setGlobal("customPage", this);
    effect(() => session.save(this._menuTabIndexKey, this.menuTabIndex()));
    this.subscribe(this.route.queryParams, () => this.load());

    if (environment.production) {
      this.toolbarInputs = [];
    } else {
      this.toolbarInputs = [
        {
          type: "select",
          label: "change mode",
          options: pageModes.slice(),
          value: this.mode(),
          multiple: false,
          onChange: (val) => {
            this.pageStatus.mode.set(val);
          }
        }
      ];
    }
  }

  ngOnInit() {
    window.addEventListener("beforeunload", this.beforeUnload.bind(this));
  }
  ngOnDestroy() {
    super.ngOnDestroy();
    window.removeEventListener("beforeunload", this.beforeUnload.bind(this));
  }

  @HostListener("window:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent) {
    onKeyEvent(event, this.keyEventItems);
  }

  clearPage() {
    this.pageStatus.components.set([]);
  }
  async import() {
    const files = await selectFiles({accept: ".json"});
    const file = files?.[0];
    if (!file) {
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      this.page.import(data);
      this.psm.id = this.page.id;
      this.pageStatus.updatePage();
      this.pageStatus.savePageSnapshot();
      await this.message.snack("导入成功");
    } catch (e) {
      console.error(e);
      await this.message.snack("导入失败");
    }
  }
  export() {
    const data = this.page.export();
    downloadByString(JSON.stringify(data), {filename: "page.json"});
  }
  async getPagePng() {
    this.spinner.show(this.spinner.defaultLoaderId, {text: "正在生成图片"});
    const el = this.pageEl().nativeElement;
    const {x: mmWidth, y: mmHeight} = this.page.size;
    const result = await htmlToPng(el, mmWidth, mmHeight);
    this.spinner.hide(this.spinner.defaultLoaderId);
    return result;
  }
  async getPagePdf() {
    const {png, info} = await this.getPagePng();
    const params: TDocumentDefinitions = {
      info: getPdfInfo({title: "自定义报表"}),
      content: [{image: png, width: info.width, height: info.height}],
      pageMargins: 0
    };
    const page = this.page;
    if (page.sizeName === "自定义") {
      params.pageSize = {width: page.size.x, height: page.size.y};
    } else {
      params.pageSize = page.sizeName;
      params.pageOrientation = page.orientation;
    }
    const pdf = createPdf(params);
    return pdf;
  }
  async preview() {
    const pdf = await this.getPagePdf();
    this.spinner.show(this.spinner.defaultLoaderId, {text: "正在打印"});
    const blob = await new Promise<Blob>((resolve) => {
      pdf.getBlob((b) => resolve(b));
    });
    this.spinner.hide(this.spinner.defaultLoaderId);
    const url = URL.createObjectURL(blob);
    printJS({printable: url, type: "pdf"});
    URL.revokeObjectURL(url);
  }
  async save() {
    const {id} = this.route.snapshot.queryParams;
    if (!id) {
      await this.message.error("缺少参数：id");
      return;
    }
    const data: PagesDataRaw = {pages: [this.page.export()]};
    const mubanshuju = JSON.stringify(data);
    await this.http.tableUpdate<Zidingyibaobiao>({table: this.pageStatus.table, data: {vid: id, mubanshuju}});
    const index = this.pageStatus.snapshotIndex();
    this.pageStatus.savedSnapshotIndex.set(index);
    this.psm.setSavedSnapshotIndex(index);
  }
  async load() {
    const {id, mode} = this.route.snapshot.queryParams;
    if (!id) {
      this.message.error("缺少参数：id");
      return;
    }
    this.pageStatus.recordId.set(id);
    this.pageStatus.mode.set(pageModes.includes(mode) ? mode : pageModes[0]);
    const records = await this.http.queryMySql<Zidingyibaobiao>({table: this.pageStatus.table, filter: {where: {vid: id}}});
    const record = records[0];
    if (!record) {
      return;
    }
    let data: PagesDataRaw | undefined;
    const mubanshuju = record.mubanshuju;
    if (typeof mubanshuju === "string" && mubanshuju.length > 0) {
      try {
        data = JSON.parse(mubanshuju);
      } catch (error) {
        console.error(error);
      }
    }
    if (!data) {
      return;
    }
    const pageData = data.pages?.[0];
    if (!pageData) {
      return;
    }
    this.page.import(pageData);
    this.psm.id = this.page.id;
    this.psm.reset();
    this.pageStatus.savePageSnapshot();
    this.pageStatus.updatePage();
    this.psm.setSavedSnapshotIndex(0);
    this.pageStatus.savedSnapshotIndex.set(0);
    this.canUndo.set(false);
    this.canRedo.set(false);
  }

  private _pagePointer: [number, number] | null = null;
  onPagePointerDown(event: PointerEvent) {
    this._pagePointer = [event.clientX, event.clientY];
  }
  onPagePointerUp(event: PointerEvent) {
    const target = event.target as HTMLElement;
    const isClickPage =
      target === this.pageEl().nativeElement || target.classList.contains("page-inner") || target.tagName === "APP-PAGE-COMPONENTS-DIAPLAY";
    if (!this._pagePointer || !isClickPage) {
      return;
    }
    const [x, y] = this._pagePointer;
    this._pagePointer = null;
    if (Math.abs(event.clientX - x) < 5 && Math.abs(event.clientY - y) < 5) {
      this.pageStatus.activeComponent.set(null);
    }
  }

  beforeUnload(event: BeforeUnloadEvent) {
    if (this.isSaved()) {
      return;
    }
    event.preventDefault();
    // eslint-disable-next-line deprecation/deprecation
    event.returnValue = "";
  }
}
