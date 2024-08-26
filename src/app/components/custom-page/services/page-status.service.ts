import {computed, effect, inject, Injectable, signal, untracked} from "@angular/core";
import {getCopyName, KeyEventItem, session, setGlobal} from "@app/app.common";
import {MessageService} from "@app/modules/message/services/message.service";
import {isBetween} from "@lucilor/utils";
import {Subject} from "rxjs";
import {Page, PageConfig} from "../models/page";
import {PageComponentTypeAny} from "../models/page-component-infos";
import {flatMapPageComponents, getPageComponentGroup, removePageComponent} from "../models/page-component-utils";
import {PageSnapshotManager} from "../models/page-snapshot-manager";
import {PageMode} from "./page-status.service.types";

@Injectable({
  providedIn: "root"
})
export class PageStatusService {
  private message = inject(MessageService);

  table = "t_zidingyibaobiaomuban";
  recordId = signal("");
  mode = signal<PageMode>("design");

  page = new Page();
  psm = new PageSnapshotManager(session, 20, this.page.id);
  pageConfig = signal<PageConfig>(this.page.getConfig());
  components = signal<PageComponentTypeAny[]>([]);
  activeComponents = signal<PageComponentTypeAny[]>([]);
  activeComponents2 = signal<PageComponentTypeAny[]>([]);
  activeComponents3 = computed(() => {
    const activeComponents = this.activeComponents().slice();
    const activeComponent2 = this.activeComponents2();
    for (const activeComponent of activeComponent2) {
      const index = activeComponents.findIndex((v) => v.id === activeComponent.id);
      if (index >= 0) {
        activeComponents[index] = activeComponent;
      } else {
        activeComponents.push(activeComponent);
      }
    }
    return activeComponents;
  });
  editingComponent = signal<PageComponentTypeAny | null>(null);
  snapshotIndex = signal(-1);
  savedSnapshotIndex = signal(-1);
  isSaved = computed(() => this.snapshotIndex() === this.savedSnapshotIndex());
  canUndo = signal(false);
  canRedo = signal(false);
  showComponentMenu = signal(false);

  saveBefore = new Subject<void>();
  saveAfter = new Subject<void>();
  keyEventItems: KeyEventItem[] = [
    {key: "s", ctrl: true, action: () => this.saveBefore.next()},
    {key: "z", ctrl: true, action: () => this.undo()},
    {key: "y", ctrl: true, action: () => this.redo()},
    {key: "c", ctrl: true, action: () => this.copy()},
    {key: "v", ctrl: true, action: () => this.paste()},
    {key: "a", ctrl: true, action: () => this.selectAll()},
    {key: "delete", action: () => this.remove()}
  ];

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
    const ids = Array.from(flatMapPageComponents(components, true, (component) => component.id));
    const activeComponents = untracked(() => this.activeComponents());
    const activeComponents2 = activeComponents.filter((v) => ids.includes(v.id));
    if (activeComponents.length !== activeComponents2.length) {
      this.activeComponents.set(activeComponents2);
    }
    this.page.components = components;
    if (this._noSaveOnComponentsChanged) {
      this._noSaveOnComponentsChanged = false;
    } else {
      untracked(() => this.savePageSnapshot());
    }
  }
  onActiveComponentChanged() {
    const activeComponents = this.activeComponents();
    if (activeComponents.length > 0) {
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

  getActiveComponents(limit?: {min?: number; max?: number}) {
    const components = this.activeComponents();
    const {min = -Infinity, max = Infinity} = limit || {};
    if (!isBetween(components.length, min, max, true)) {
      if (min === max) {
        this.message.snack(`请先选择${min}个组件`);
      } else {
        this.message.snack(`请先选择${min}~${max}个组件`);
      }
      return null;
    }
    return components;
  }

  private _componentsToCopy: PageComponentTypeAny[] | null = null;
  copy() {
    const editingComponent = this.editingComponent();
    if (editingComponent) {
      return;
    }
    this._componentsToCopy = this.getActiveComponents({min: 1});
  }
  paste() {
    const componentsToCopy = this._componentsToCopy;
    if (!componentsToCopy || componentsToCopy.length < 1) {
      return;
    }
    const components = this.components();
    const names = Array.from(flatMapPageComponents(components, true, (v) => v.name));
    for (const component of componentsToCopy) {
      const clone = component.clone(true);
      clone.name = getCopyName(names, clone.name);
      clone.position.add(10, 10);
      const components2 = getPageComponentGroup(components, component)?.children || components;
      components2.push(clone);
    }
    this.components.set([...components]);
  }
  remove() {
    const componentsToRemove = this.getActiveComponents({min: 1});
    if (!componentsToRemove) {
      return;
    }
    const components = this.components();
    for (const component of componentsToRemove) {
      removePageComponent(components, component);
    }
    this.components.set([...components]);
  }
  selectAll() {
    const component = this.components();
    this.activeComponents.set([...component]);
  }
}
