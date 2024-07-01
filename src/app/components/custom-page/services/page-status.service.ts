import {computed, effect, Injectable, signal, untracked} from "@angular/core";
import {session, setGlobal} from "@app/app.common";
import {Page, PageConfig} from "../models/page";
import {PageComponentTypeAny} from "../models/page-component-infos";
import {findPageComponent} from "../models/page-component-utils";
import {PageSnapshotManager} from "../models/page-snapshot-manager";
import {PageMode} from "./page-status.service.types";

@Injectable({
  providedIn: "root"
})
export class PageStatusService {
  table = "t_zidingyibaobiaomuban";
  recordId = signal("");
  mode = signal<PageMode>("design");

  page = new Page();
  psm = new PageSnapshotManager(session, 20, this.page.id);
  pageConfig = signal<PageConfig>(this.page.getConfig());
  components = signal<PageComponentTypeAny[]>([]);
  activeComponent = signal<PageComponentTypeAny | null>(null);
  activeComponent2 = signal<PageComponentTypeAny | null>(null);
  snapshotIndex = signal(-1);
  savedSnapshotIndex = signal(-1);
  isSaved = computed(() => this.snapshotIndex() === this.savedSnapshotIndex());
  canUndo = signal(false);
  canRedo = signal(false);
  showComponentMenu = signal(false);

  constructor() {
    setGlobal("pageStatus", this);
    effect(() => this.onComponentsChanged(), {allowSignalWrites: true});
    effect(() => this.onActiveComponentChanged(), {allowSignalWrites: true});
    effect(() => this.onPageConfigChanged(), {allowSignalWrites: true});
  }

  updatePageComponents() {
    this._noSaveOnComponentsChanged = true;
    this.components.set([...this.page.components]);
  }
  updatePage() {
    this.updatePageComponents();
    this._noSaveOnPageConfigChanged = true;
    this.pageConfig.set(this.page.getConfig());
  }

  initPage() {
    this.page = new Page();
    this.page.padding = [12, 12, 12, 12];
    this.page.workSpaceStyle.backgroundColor = "lightgray";
    this.page.backgroundOuter = "#E7E7E7";
  }
  loadPageSnapshot() {
    const {snapshot, canUndo, canRedo, index} = this.psm.loadSnapshot();
    if (snapshot) {
      this.page.import(snapshot);
      this.updatePage();
    } else {
      this.initPage();
      this.updatePage();
    }
    this.canUndo.set(canUndo);
    this.canRedo.set(canRedo);
    this.snapshotIndex.set(index);
  }
  savePageSnapshot() {
    const {canUndo, canRedo, index} = this.psm.saveSnapshot(this.page.export());
    this.canUndo.set(canUndo);
    this.canRedo.set(canRedo);
    if (this.snapshotIndex() !== index) {
      this.snapshotIndex.set(index);
    } else {
      this.savedSnapshotIndex.update((v) => v - 1);
    }
  }
  undo() {
    const {snapshot, canUndo, index} = this.psm.undo();
    if (snapshot) {
      this.page.import(snapshot);
      this.updatePage();
    }
    this.canUndo.set(canUndo);
    this.canRedo.set(true);
    this.snapshotIndex.set(index);
  }
  redo() {
    const {snapshot, canRedo, index} = this.psm.redo();
    if (snapshot) {
      this.page.import(snapshot);
      this.updatePage();
    }
    this.canUndo.set(true);
    this.canRedo.set(canRedo);
    this.snapshotIndex.set(index);
  }

  private _noSaveOnComponentsChanged = true;
  onComponentsChanged() {
    const components = this.components();
    const activeComponent = untracked(() => this.activeComponent());
    if (activeComponent) {
      this.activeComponent.set(findPageComponent(activeComponent.id, components));
    }
    this.page.components = components;
    if (this._noSaveOnComponentsChanged) {
      this._noSaveOnComponentsChanged = false;
    } else {
      untracked(() => this.savePageSnapshot());
    }
  }
  onActiveComponentChanged() {
    const activeComponent = this.activeComponent();
    if (activeComponent) {
      this.showComponentMenu.set(true);
    }
  }
  private _noSaveOnPageConfigChanged = true;
  onPageConfigChanged() {
    const config = this.pageConfig();
    this.page.setConfig(config);
    if (this._noSaveOnPageConfigChanged) {
      this._noSaveOnPageConfigChanged = false;
    } else {
      untracked(() => this.savePageSnapshot());
    }
  }
}
