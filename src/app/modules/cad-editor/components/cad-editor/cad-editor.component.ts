import {animate, state, style, transition, trigger} from "@angular/animations";
import {CdkDrag, CdkDragEnd, CdkDragMove, CdkDragStart} from "@angular/cdk/drag-drop";
import {AsyncPipe} from "@angular/common";
import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren
} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatTabChangeEvent, MatTabGroup, MatTabsModule} from "@angular/material/tabs";
import {setGlobal} from "@app/app.common";
import {openCadDimensionForm} from "@app/cad/utils";
import {ContextMenuModule} from "@app/modules/context-menu/context-menu.module";
import {InputComponent} from "@app/modules/input/components/input.component";
import {InputInfo} from "@app/modules/input/components/input.types";
import {OpenCadOptions} from "@app/services/app-status.types";
import {SuanliaoTablesComponent} from "@components/lurushuju/suanliao-tables/suanliao-tables.component";
import {Debounce} from "@decorators/debounce";
import {CadDimensionLinear, CadEventCallBack, CadLineLike, CadMtext} from "@lucilor/cad-viewer";
import {queryString} from "@lucilor/utils";
import {Subscribed} from "@mixins/subscribed.mixin";
import {CadConsoleComponent} from "@modules/cad-console/components/cad-console/cad-console.component";
import {CadConsoleService} from "@modules/cad-console/services/cad-console.service";
import {MessageService} from "@modules/message/services/message.service";
import {AppConfig, AppConfigService} from "@services/app-config.service";
import {AppStatusService} from "@services/app-status.service";
import {CadStatusAssemble, CadStatusSplit} from "@services/cad-status";
import {debounce, throttle} from "lodash";
import {NgScrollbar} from "ngx-scrollbar";
import {BehaviorSubject, map, startWith, take} from "rxjs";
import {SpinnerComponent} from "../../../spinner/components/spinner/spinner.component";
import {CadPointsComponent} from "../cad-points/cad-points.component";
import {CadAssembleComponent} from "../menu/cad-assemble/cad-assemble.component";
import {CadDimensionComponent} from "../menu/cad-dimension/cad-dimension.component";
import {CadInfoComponent} from "../menu/cad-info/cad-info.component";
import {CadLineComponent} from "../menu/cad-line/cad-line.component";
import {openCadLineForm} from "../menu/cad-line/cad-line.utils";
import {CadMtextComponent} from "../menu/cad-mtext/cad-mtext.component";
import {CadSplitComponent} from "../menu/cad-split/cad-split.component";
import {SubCadsComponent} from "../menu/sub-cads/sub-cads.component";
import {ToolbarComponent} from "../menu/toolbar/toolbar.component";
import {SuanliaogongshiComponent} from "../suanliaogongshi/suanliaogongshi.component";

@Component({
  selector: "app-cad-editor",
  templateUrl: "./cad-editor.component.html",
  styleUrls: ["./cad-editor.component.scss"],
  animations: [
    trigger("closeTop", [
      state("open", style({transform: "translateY(0)"})),
      state("closed", style({transform: "translateY(-100%)"})),
      transition("open <=> closed", [animate("0.3s")])
    ]),
    trigger("closeRight", [
      state("open", style({transform: "translateX(0)"})),
      state("closed", style({transform: "translateX(100%)"})),
      transition("open <=> closed", [animate("0.3s")])
    ]),
    trigger("closeBottom", [
      state("open", style({transform: "translateY(0)"})),
      state("closed", style({transform: "translateY(100%)"})),
      transition("open <=> closed", [animate("0.3s")])
    ]),
    trigger("closeLeft", [
      state("open", style({transform: "translateX(0)"})),
      state("closed", style({transform: "translateX(-100%)"})),
      transition("open <=> closed", [animate("0.3s")])
    ]),
    trigger("menuWidth", [
      transition(":enter", [style({opacity: 0}), animate("0.5s", style({opacity: 1}))]),
      transition(":leave", [style({opacity: 1}), animate("0.5s", style({opacity: 0}))])
    ])
  ],
  standalone: true,
  imports: [
    AsyncPipe,
    CadAssembleComponent,
    CadConsoleComponent,
    CadDimensionComponent,
    CadInfoComponent,
    CadLineComponent,
    CadMtextComponent,
    CadPointsComponent,
    CadSplitComponent,
    CdkDrag,
    ContextMenuModule,
    forwardRef(() => InputComponent),
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatTabsModule,
    NgScrollbar,
    SpinnerComponent,
    SuanliaogongshiComponent,
    SuanliaoTablesComponent,
    SubCadsComponent,
    ToolbarComponent
  ]
})
export class CadEditorComponent extends Subscribed() implements AfterViewInit, OnDestroy {
  private _params?: OpenCadOptions;
  @Input()
  get params() {
    return this._params;
  }
  set params(value) {
    this._params = value;
    this.refresh();
  }
  shownMenus: ("cadInfo" | "entityInfo" | "cadAssemble" | "cadSplit")[] = ["cadInfo", "entityInfo"];
  showTopMenu = true;
  showRightMenu = true;
  showBottomMenu = true;
  showLeftMenu = true;
  showSuanliaogongshi = false;
  showSuanliaoTables = false;
  showAllMenu = true;
  tabIndex = 0;
  cadLength$ = this.status.cadTotalLength$.pipe(
    startWith(0),
    map((v) => v.toFixed(2))
  );
  menuPaddingBase = [20, 20, 20, 20];
  leftMenuWidth$ = new BehaviorSubject<number>(this.config.getConfig("leftMenuWidth"));
  rightMenuWidth$ = new BehaviorSubject<number>(this.config.getConfig("rightMenuWidth"));
  topMenuHeight$ = new BehaviorSubject<number>(80);
  bottomMenuHeight$ = new BehaviorSubject<number>(20);
  dragDataLeft: DragData = {width: 0};
  dragDataRight: DragData = {width: 0};
  isDraggingLeft = false;
  isDraggingRight = false;
  spinnerId = "cadEditor";
  openCad$ = this.status.openCad$;
  private _isViewInited = false;

  get multiSelect() {
    return this.status.cad.getConfig("selectMode") === "multiple";
  }
  get entityDraggable() {
    return this.status.cad.getConfig("entityDraggable");
  }
  get cadStatusStr() {
    return this.status.cadStatus.name;
  }

  @ViewChild("cadContainer", {read: ElementRef}) cadContainer!: ElementRef<HTMLElement>;
  @ViewChild(CadConsoleComponent) cadConsoleComponent!: CadConsoleComponent;
  @ViewChild(MatTabGroup) infoTabs!: MatTabGroup;
  @ViewChild("suanliaogongshi", {read: ElementRef}) suanliaogongshi?: ElementRef<HTMLElement>;
  @ViewChild("suanliaoTables", {read: ElementRef}) suanliaoTables?: ElementRef<HTMLElement>;
  @ViewChildren(NgScrollbar) private _scrollbars!: QueryList<NgScrollbar>;
  private get _scrollbar() {
    const scrollbar = this._scrollbars.get(this.tabIndex);
    if (!scrollbar) {
      throw new Error("Failed to access scrollbar component.");
    }
    return scrollbar;
  }
  private _scrollChangeLock = false;

  constructor(
    private config: AppConfigService,
    private status: AppStatusService,
    private cadConsole: CadConsoleService,
    private message: MessageService,
    private el: ElementRef<HTMLElement>
  ) {
    super();
    this.status.fetchInputOptions();
  }

  onScrollChange = debounce(() => {
    if (this._scrollChangeLock) {
      return;
    }
    const scroll = this.config.getConfig("scroll");
    scroll["tab" + this.tabIndex] = this._scrollbar.viewport.nativeElement.scrollTop;
    this.config.setConfig("scroll", scroll);
  }, 1000);

  ngAfterViewInit() {
    setGlobal("cadEditor", this);
    const cad = this.status.cad;
    cad.appendTo(this.cadContainer.nativeElement);
    cad.on("entitiescopy", this._onEntitiesCopy);
    cad.on("entitiespaste", this._onEntitiesPaste);
    cad.on("entitydblclick", this._onEntityDblClick);
    this._setCadPadding();

    this.subscribe(this.config.configChange$, ({newVal}) => {
      const {leftMenuWidth, rightMenuWidth} = newVal;
      if (typeof leftMenuWidth === "number") {
        this.leftMenuWidth$.next(leftMenuWidth);
      }
      if (typeof rightMenuWidth === "number") {
        this.rightMenuWidth$.next(rightMenuWidth);
      }
    });
    this.subscribe(this.status.cadStatusEnter$, (cadStatus) => {
      if (cadStatus instanceof CadStatusAssemble) {
        this.shownMenus = ["cadAssemble"];
      } else if (cadStatus instanceof CadStatusSplit) {
        this.shownMenus = ["cadInfo", "entityInfo", "cadSplit"];
      } else {
        this.shownMenus = ["cadInfo", "entityInfo"];
      }
    });

    const infoTabs = this.infoTabs;
    const setInfoTabs = () => {
      const {infoTabIndex, scroll} = this.config.getConfig();
      if (typeof infoTabIndex === "number" && infoTabIndex >= 0) {
        infoTabs.selectedIndex = infoTabIndex;
      }
      if (scroll) {
        this._setTabScroll();
      }
    };
    infoTabs.animationDone.pipe(take(1)).subscribe(() => {
      setTimeout(() => {
        setInfoTabs();
      }, 0);
    });
    const sub = this.config.configChange$.subscribe(({isUserConfig}) => {
      if (isUserConfig) {
        setInfoTabs();
        sub.unsubscribe();
      }
    });

    this._scrollbars.forEach((scrollbar) => {
      scrollbar.viewport.nativeElement.addEventListener("scroll", this.onScrollChange);
    });

    this.subscribe(this.cadConsole.command$, (command) => {
      this.cadConsoleComponent.execute(command);
    });
    setTimeout(() => {
      this._isViewInited = true;
      this.refresh();
    }, 0);
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    const cad = this.status.cad;
    cad.off("entitiescopy", this._onEntitiesCopy);
    cad.off("entitiespaste", this._onEntitiesPaste);
    cad.off("entitydblclick", this._onEntityDblClick);
  }

  private _onEntitiesCopy: CadEventCallBack<"entitiescopy"> = (entities) => {
    const cad = this.status.cad;
    entities.forEach((e) => (e.opacity = 0.3));
    cad.data.entities.merge(entities);
    cad.unselectAll();
    cad.render(entities);
  };

  private _onEntitiesPaste: CadEventCallBack<"entitiespaste"> = (entities) => {
    entities.forEach((e) => (e.opacity = 1));
    this.status.cad.render(entities);
  };

  private _onEntityDblClick: CadEventCallBack<"entitydblclick"> = async (event, entity) => {
    const collection = this.status.collection$.value;
    const cad = this.status.cad;
    const gongshis = this.status.openCad$.value.gongshis;
    if (entity instanceof CadMtext && entity.parent instanceof CadLineLike) {
      openCadLineForm(collection, this.status, this.message, cad, entity.parent, gongshis);
    } else if (entity instanceof CadLineLike) {
      openCadLineForm(collection, this.status, this.message, cad, entity, gongshis);
    } else if (entity instanceof CadDimensionLinear) {
      openCadDimensionForm(collection, this.message, cad, entity);
    }
  };

  private _setCadPadding() {
    const padding = this.menuPaddingBase.slice();
    if (this.showTopMenu) {
      padding[0] += this.topMenuHeight$.value;
    }
    if (this.showRightMenu) {
      padding[1] += this.rightMenuWidth$.value;
    }
    if (this.showBottomMenu) {
      padding[2] += this.bottomMenuHeight$.value;
    }
    if (this.showLeftMenu) {
      padding[3] += this.leftMenuWidth$.value;
    }
    if (this.suanliaogongshi && this.showSuanliaogongshi) {
      padding[3] += this.suanliaogongshi.nativeElement.clientWidth;
    }
    if (this.suanliaoTables && this.showSuanliaoTables) {
      padding[3] += this.suanliaoTables.nativeElement.clientWidth;
    }
    this.config.setConfig({padding}, {sync: false});
  }

  private async _setTabScroll() {
    const scroll = this.config.getConfig("scroll");
    const key = "tab" + this.tabIndex;
    if (scroll[key] !== undefined) {
      this._scrollChangeLock = true;
      this._scrollbar.scrollTo({top: scroll[key]});
      this._scrollChangeLock = false;
    }
  }

  @HostListener("window:resize")
  @Debounce(500)
  resize() {
    const parentEl = this.cadContainer.nativeElement.parentElement;
    if (parentEl) {
      this.config.setConfig({width: parentEl.clientWidth, height: parentEl.clientHeight});
    }
  }

  toggleTopMenu(show?: boolean) {
    this.showTopMenu = show ?? !this.showTopMenu;
    this._setCadPadding();
  }

  toggleRightMenu(show?: boolean) {
    this.showRightMenu = show ?? !this.showRightMenu;
    this._setCadPadding();
  }

  toggleBottomMenu(show?: boolean) {
    this.showBottomMenu = show ?? !this.showBottomMenu;
    this._setCadPadding();
  }

  toggleLeftMenu(show?: boolean) {
    this.showLeftMenu = show ?? !this.showLeftMenu;
    this._setCadPadding();
  }

  toggleSuanliaogongshi(show?: boolean) {
    this.showSuanliaogongshi = show ?? !this.showSuanliaogongshi;
    this._setCadPadding();
  }

  toggleSuanliaoTables(show?: boolean) {
    this.showSuanliaoTables = show ?? !this.showSuanliaoTables;
    this._setCadPadding();
  }

  toggleAllMenu(show?: boolean) {
    this.showAllMenu = show ?? !this.showAllMenu;
    this.toggleTopMenu(this.showAllMenu);
    this.toggleRightMenu(this.showAllMenu);
    this.toggleBottomMenu(this.showAllMenu);
    this.toggleLeftMenu(this.showAllMenu);
    this.toggleSuanliaogongshi(this.showAllMenu);
    this.toggleSuanliaoTables();
  }

  async validate() {
    const {validator} = this.params || {};
    const data = this.status.cad.data;
    if (validator) {
      const errors = Object.keys(validator(data) || {}).join("\n");
      if (errors) {
        await this.message.error(errors);
        return false;
      }
    }
    const matErrors = this.el.nativeElement.querySelectorAll("mat-error");
    if (matErrors.length > 0) {
      await this.message.error("输入有误");
      return false;
    }
    return true;
  }

  async save() {
    const {extraData} = this.params || {};
    const data = this.status.cad.data;
    if (extraData) {
      Object.assign(data, extraData);
    }
    if (!(await this.validate())) {
      return;
    }
    await this.status.saveCad(this.spinnerId);
  }

  async refresh() {
    if (!this._isViewInited) {
      return;
    }
    await this.status.openCad(this._params);
  }

  zoomAll() {
    this.status.cad.center();
  }

  onInfoTabChange({index}: MatTabChangeEvent) {
    this.tabIndex = index;
    this.config.setConfig("infoTabIndex", index);
    this._setTabScroll();
  }

  toggleMultiSelect() {
    let selectMode = this.config.getConfig("selectMode");
    selectMode = selectMode === "multiple" ? "single" : "multiple";
    this.config.setConfig("selectMode", selectMode);
  }

  onResizeMenuStart(_event: CdkDragStart<DragData>, key: Dragkey) {
    if (key === "leftMenuWidth") {
      this.dragDataLeft.width = this.leftMenuWidth$.value;
      this.isDraggingLeft = true;
    } else if (key === "rightMenuWidth") {
      this.dragDataRight.width = this.rightMenuWidth$.value;
      this.isDraggingRight = true;
    }
  }

  onResizeMenu(event: CdkDragMove<DragData>, key: Dragkey) {
    if (key === "leftMenuWidth") {
      this.leftMenuWidth$.next(event.source.data.width + event.distance.x);
    } else if (key === "rightMenuWidth") {
      this.rightMenuWidth$.next(event.source.data.width - event.distance.x);
    }
    event.source.element.nativeElement.style.transform = "";
  }

  onResizeMenuEnd(_event: CdkDragEnd<DragData>, key: Dragkey) {
    if (key === "leftMenuWidth") {
      this.config.setConfig(key, this.leftMenuWidth$.value);
      this.isDraggingLeft = false;
    } else if (key === "rightMenuWidth") {
      this.config.setConfig(key, this.rightMenuWidth$.value);
      this.isDraggingRight = false;
    }
    this._setCadPadding();
  }

  getSuanliaogongshiLeft() {
    if (!this._isViewInited) {
      return 0;
    }
    if (this.showLeftMenu) {
      return this.leftMenuWidth$.value;
    }
    return 30;
  }

  getSuanliaoTablesLeft() {
    if (!this._isViewInited) {
      return 0;
    }
    let left = 0;
    if (this.suanliaogongshi) {
      left += this.suanliaogongshi.nativeElement.clientWidth;
    }
    if (this.showLeftMenu) {
      left += this.leftMenuWidth$.value;
    } else {
      left += 30;
    }
    return left;
  }

  menuSearch: InputInfo = {
    type: "string",
    label: "搜索",
    value: "",
    autoFocus: true,
    clearable: true,
    onInput: throttle((val) => {
      this.searchMenu(val);
    }, 500)
  };
  menuSearchShown = false;
  searchMenu(val: string) {
    if (!val) {
      return;
    }
    this._scrollbars.forEach((scrollbar) => {
      const inputs = scrollbar.viewport.nativeElement.querySelectorAll("app-input");
      const input = Array.from(inputs).find((el) => {
        if (el instanceof HTMLElement && queryString(val, el.dataset.label || "")) {
          return true;
        }
        return false;
      });
      if (input) {
        scrollbar.scrollToElement(input);
      }
    });
  }
  showMenuSearch() {
    this.menuSearchShown = true;
    this.menuSearch.value = "";
  }
  hideMenuSearch() {
    this.menuSearchShown = false;
  }
  onMenuSearchPointerMove(event: PointerEvent) {
    const {target: el, clientX, clientY} = event;
    if (!(el instanceof HTMLElement)) {
      return;
    }
    const rect = el.querySelector("app-input")?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      this.hideMenuSearch();
    }
  }
}

interface DragData {
  width: number;
}

type Dragkey = keyof Pick<AppConfig, "leftMenuWidth" | "rightMenuWidth">;
