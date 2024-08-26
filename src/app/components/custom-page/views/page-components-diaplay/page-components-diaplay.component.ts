import {CdkDrag, CdkDragEnd, CdkDragMove, DragRef} from "@angular/cdk/drag-drop";
import {CdkTextareaAutosize} from "@angular/cdk/text-field";
import {NgTemplateOutlet} from "@angular/common";
import {ChangeDetectionStrategy, Component, effect, ElementRef, inject, signal, untracked, viewChildren} from "@angular/core";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {getFilepathUrl, setGlobal} from "@app/app.common";
import {TypedTemplateDirective} from "@app/modules/directives/typed-template.directive";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {ImageComponent} from "@app/modules/image/components/image/image.component";
import {ImageEvent} from "@app/modules/image/components/image/image.component.types";
import {Angle, ObjectOf, Point, selectFiles} from "@lucilor/utils";
import {Properties} from "csstype";
import {debounce, isEqual} from "lodash";
import {pageComponentInfos, PageComponentTypeAny} from "../../models/page-component-infos";
import {findPageComponent, flatPageComponents, getComponentEl, updateGroup} from "../../models/page-component-utils";
import {PageComponentForm} from "../../models/page-components/page-component-form";
import {PageComponentGroup} from "../../models/page-components/page-component-group";
import {PageComponentImage} from "../../models/page-components/page-component-image";
import {PageComponentText} from "../../models/page-components/page-component-text";
import {PageStatusService} from "../../services/page-status.service";
import {ControlPoint, Helpers} from "./page-components-diaplay.types";

@Component({
  selector: "app-page-components-diaplay",
  standalone: true,
  imports: [CdkDrag, CdkTextareaAutosize, ImageComponent, MatIconModule, MatInputModule, NgTemplateOutlet, TypedTemplateDirective],
  templateUrl: "./page-components-diaplay.component.html",
  styleUrl: "./page-components-diaplay.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageComponentsDiaplayComponent {
  private elRef: ElementRef<HTMLElement> = inject(ElementRef);
  private http = inject(CadDataService);
  private pageStatus = inject(PageStatusService);

  get mode() {
    return this.pageStatus.mode;
  }
  get components() {
    return this.pageStatus.components;
  }
  get pageConfig() {
    return this.pageStatus.pageConfig;
  }
  get editingComponent() {
    return this.pageStatus.editingComponent;
  }

  controls = signal<ObjectOf<{class: string[]; style: Properties}>>({});
  helpers = signal<Helpers>({
    axisX: {show: false, threshold: 3},
    axisY: {show: false, threshold: 3},
    rotation: {show: false, threshold: 3, position: [0, 0], deg: 0, size: 0}
  });
  componentsTplType!: {$implicit: PageComponentTypeAny[]};

  componentEls = viewChildren<ElementRef<HTMLDivElement>>("componentEl");
  autoSizes = viewChildren<CdkTextareaAutosize>(CdkTextareaAutosize);

  constructor() {
    setGlobal("pageComponentsDiaplay", this);
    effect(() => this.updateControl(), {allowSignalWrites: true});
    effect(
      () => {
        const editingComponent = untracked(() => this.editingComponent());
        const activeComponents = this.pageStatus.activeComponents();
        if (editingComponent && !activeComponents.some((v) => v.id === editingComponent.id)) {
          this.editingComponent.set(null);
        }
      },
      {allowSignalWrites: true}
    );
    effect(() => {
      this.components();
      for (const autoSize of this.autoSizes()) {
        autoSize.resizeToFitContent(true);
      }
      setTimeout(() => {
        this.updateControl();
      }, 0);
    });
    effect(
      () => {
        const {width, height} = this.pageConfig();
        const helpers = this.helpers();
        const rotateSize = Math.max(width, height);
        if (helpers.rotation.size !== rotateSize) {
          helpers.rotation.size = rotateSize;
          this.helpers.set({...helpers});
        }
      },
      {allowSignalWrites: true}
    );
  }

  getComponentStyle(component: PageComponentTypeAny) {
    const activeComponents = this.pageStatus.activeComponents2();
    const draggingComponents = this._draggingComponents?.map((v) => v.component) || [];
    let component2 = activeComponents.find((v) => v.id === component.id);
    if (!component2) {
      component2 = draggingComponents.find((v) => v.id === component.id);
    }
    if (component2) {
      return component2.getStyle();
    }
    return component.getStyle();
  }
  clickComponent(event: MouseEvent, component: PageComponentTypeAny) {
    if (this.mode() !== "design") {
      return;
    }
    if (this._draggingComponents) {
      setTimeout(() => {
        this._draggingComponents = null;
      }, 0);
      return;
    }
    event.stopPropagation();
    if (event.ctrlKey) {
      const activeComponents = this.pageStatus.activeComponents();
      if (activeComponents.find((v) => v.id === component.id)) {
        this.pageStatus.activeComponents.set(activeComponents.filter((v) => v.id !== component.id));
      } else {
        this.pageStatus.activeComponents.set([...activeComponents, component]);
      }
    } else {
      this.pageStatus.activeComponents.set([component]);
    }
  }
  async dblClickComponent(event: Event, component: PageComponentTypeAny, componentEl: HTMLDivElement) {
    if (this.mode() !== "design") {
      return;
    }
    event.stopPropagation();
    this.editingComponent.set(component);
    if (component instanceof PageComponentText) {
      const input = componentEl.querySelector("textarea");
      if (input) {
        input.focus();
        input.select();
      }
    } else if (component instanceof PageComponentImage) {
      const files = await selectFiles({accept: "image/*"});
      const file = files?.[0];
      if (!file) {
        return;
      }
      const result = await this.http.uploadImage(file);
      const src = result?.url;
      if (src) {
        component.src = getFilepathUrl(src, {remote: true});
        this.components.update((v) => [...v]);
      }
    }
  }
  getComponentDragDisabled(component: PageComponentTypeAny) {
    if (this.mode() !== "design") {
      return true;
    }
    return this.editingComponent()?.id === component.id || component.isLocked() || component.isHidden();
  }
  private _draggingComponents: {component: PageComponentTypeAny; start: Point}[] | null = null;
  private _resetDargRef<T>(ref: DragRef<T>) {
    ref.reset();
    const el = ref.getRootElement();
    const component = findPageComponent(el.dataset.id || "", this.components());
    if (component) {
      el.style.transform = component.getStyle().transform as string;
    }
  }
  moveComponentStart(component: PageComponentTypeAny) {
    const activeComponents = this.pageStatus.activeComponents();
    const activeGroup = activeComponents.find((v) => v instanceof PageComponentGroup);
    let components: PageComponentTypeAny[] = [];
    if (activeGroup instanceof PageComponentGroup && activeGroup.findChild(component.id)) {
      component = activeGroup;
    }
    if (activeComponents.some((v) => v.id === component.id)) {
      components = activeComponents.map((v) => v.clone());
      this.pageStatus.activeComponents2.set(components);
    } else {
      components = [component.clone()];
    }
    this._draggingComponents = components.map((v) => ({component: v, start: v.position.clone()}));
  }
  moveComponent(event: CdkDragMove) {
    const components = this._draggingComponents;
    if (!components || components.length < 1) {
      return;
    }
    const {distance} = event;
    const activeComponents2 = this.pageStatus.activeComponents2();
    let activeComponents2Change = false;
    const hostEl = this.elRef.nativeElement;
    const hostRect = hostEl.getBoundingClientRect();
    const helpers = this.helpers();
    helpers.axisX.show = false;
    delete helpers.axisX.snap;
    helpers.axisY.show = false;
    delete helpers.axisY.snap;
    event.source._dragRef.reset();
    const ids = components.map((v) => v.component.id);
    for (const {component, start} of components) {
      component.position.set(start.x + distance.x, start.y + distance.y);
      if (!activeComponents2Change && activeComponents2.find((v) => v.id === component.id)) {
        activeComponents2Change = true;
      }

      const el = getComponentEl(component.id);
      if (!el) {
        continue;
      }
      el.style.transform = component.getStyle().transform as string;
      if (helpers.axisX.snap || helpers.axisY.snap) {
        continue;
      }
      const elRect = el.getBoundingClientRect();
      const snapXs = [hostRect.left + hostRect.width / 2];
      const snapYs = [hostRect.top + hostRect.height / 2];
      const xs = [elRect.left, elRect.left + elRect.width / 2, elRect.left + elRect.width];
      const ys = [elRect.top, elRect.top + elRect.height / 2, elRect.top + elRect.height];

      hostEl.querySelectorAll(".snap").forEach((snapEl) => {
        if (!(snapEl instanceof HTMLElement) || !snapEl.offsetParent) {
          return;
        }
        const parent = snapEl.closest(".page-component");
        if (!(parent instanceof HTMLElement) || parent === el) {
          return;
        }
        if (typeof parent.dataset.id === "string" && ids.includes(parent.dataset.id)) {
          return;
        }
        const rect = snapEl.getBoundingClientRect();
        snapXs.push(rect.left, rect.left + rect.width / 2, rect.right);
        snapYs.push(rect.top, rect.top + rect.height / 2, rect.bottom);
      });
      for (const snapX of snapXs) {
        let found = false;
        for (const [i, x] of xs.entries()) {
          if (Math.abs(x - snapX) < helpers.axisX.threshold) {
            helpers.axisX.show = true;
            const from = snapX - hostRect.left;
            const to = Math.floor(snapX - (elRect.width / 2) * i + el.offsetLeft - elRect.left);
            helpers.axisX.snap = {from, to, id: component.id};
            found = true;
            break;
          }
        }
        if (found) {
          break;
        }
      }
      for (const snapY of snapYs) {
        let found = false;
        for (const [i, y] of ys.entries()) {
          if (Math.abs(y - snapY) < helpers.axisY.threshold) {
            helpers.axisY.show = true;
            const from = snapY - hostRect.top;
            const to = Math.floor(snapY - (elRect.height / 2) * i + el.offsetTop - elRect.top);
            helpers.axisY.snap = {from, to, id: component.id};
            found = true;
            break;
          }
        }
        if (found) {
          break;
        }
      }
    }
    if (activeComponents2Change) {
      this.pageStatus.activeComponents2.update((v) => [...v]);
    }

    if (!isEqual(helpers, this.helpers())) {
      this.helpers.set({...helpers});
    }
  }
  moveComponentEnd(event: CdkDragEnd) {
    const draggingComponents = this._draggingComponents;
    if (this.pageStatus.activeComponents2().length > 0) {
      this.pageStatus.activeComponents2.set([]);
    }
    setTimeout(() => {
      this._draggingComponents = null;
    }, 0);
    if (!draggingComponents || draggingComponents.length < 1) {
      return;
    }
    this._resetDargRef(event.source._dragRef);

    const components = this.components();
    const helpers = this.helpers();
    const toChange: PageComponentTypeAny[] = [];
    let {x, y} = event.distance;
    for (const component of flatPageComponents(components, true)) {
      const info = draggingComponents.find((v) => v.component.id === component.id);
      if (!info) {
        continue;
      }
      toChange.push(component);
      if (helpers.axisX.snap?.id === component.id) {
        x = helpers.axisX.snap.to - info.start.x;
        delete helpers.axisX.snap;
      }
      if (helpers.axisY.snap?.id === component.id) {
        y = helpers.axisY.snap.to - info.start.y;
        delete helpers.axisY.snap;
      }
    }
    for (const component of toChange) {
      component.position.add(x, y);
      updateGroup(components, component);
    }
    helpers.axisX.show = false;
    helpers.axisY.show = false;
    if (!isEqual(helpers, this.helpers())) {
      this.helpers.set({...helpers});
    }
    this.components.update((v) => [...v]);
  }

  controlPoints = [
    {position: "top", axis: "y"},
    {position: "left", axis: "x"},
    {position: "right", axis: "x"},
    {position: "bottom", axis: "y"},
    {position: "top-left"},
    {position: "top-right"},
    {position: "bottom-left"},
    {position: "bottom-right"}
  ] as ControlPoint[];
  updateControl(target?: PageComponentTypeAny) {
    const result = {isComponentsUpdated: false};
    const control: ReturnType<typeof this.controls> = {};
    if (this.mode() !== "design") {
      this.controls.set(control);
      return result;
    }
    const components = this.pageStatus.activeComponents3();
    for (const component of components) {
      const componentEl = this.elRef.nativeElement.querySelector(`.page-component[data-id="${component?.id}"]`);
      if (!(componentEl instanceof HTMLElement)) {
        continue;
      }
      if (target && target.id !== component.id) {
        continue;
      }
      const {resizable = {}} = pageComponentInfos[component.type] || {};
      const classArr: string[] = [];
      if (component.isLocked()) {
        classArr.push("locked");
      } else {
        if (resizable.x) {
          classArr.push("resize-x");
        }
        if (resizable.y) {
          classArr.push("resize-y");
        }
        classArr.push("rotate");
      }
      const style: Properties = {
        "--component-border-width": `${Math.max(component.borderWidth, 0)}px`
      };
      control[component.id] = {class: classArr, style};

      let updateComponents = false;
      const resizeX = !resizable.x && !resizable.xLocked;
      const resizeY = !resizable.y && !resizable.yLocked;
      if (resizeX && component.size.x !== componentEl.offsetWidth) {
        component.size.x = componentEl.offsetWidth;
        updateComponents = true;
      }
      if (resizeY && component.size.y !== componentEl.offsetHeight) {
        component.size.y = componentEl.offsetHeight;
        updateComponents = true;
      }
      if (updateComponents) {
        // todo
        // this.components.update((v) => [...v]);
        // result.isComponentsUpdated = true;
      }
    }
    this.controls.set(control);
    return result;
  }
  moveResizePointStart(component: PageComponentTypeAny) {
    this.pageStatus.activeComponents2.set([component.clone()]);
  }
  moveResizePoint(event: CdkDragMove, point: ControlPoint) {
    const component2 = this.pageStatus.activeComponents2()[0];
    const component = this.pageStatus.activeComponents().find((v) => v.id === component2?.id);
    if (!component2 || !component) {
      return;
    }
    let ratio = 0;
    const {distance} = event;
    if (component instanceof PageComponentImage && component.keepRatio) {
      ratio = component.naturalRatio;
    }
    const {position: positionStr} = point;
    const position = component.position.clone();
    const size = component.size.clone();
    if (positionStr.includes("top")) {
      position.y += distance.y;
      size.y -= distance.y;
      if (ratio > 0) {
        size.x += distance.y * ratio;
      }
    }
    if (positionStr.includes("bottom")) {
      size.y += distance.y;
      if (ratio > 0) {
        size.x += distance.y * ratio;
      }
    }
    if (positionStr.includes("left")) {
      position.x += distance.x;
      size.x -= distance.x;
      if (ratio > 0) {
        size.y += distance.x / ratio;
      }
    }
    if (positionStr.includes("right")) {
      size.x += distance.x;
      if (ratio > 0) {
        size.y += distance.x / ratio;
      }
    }
    component2.position.copy(position);
    component2.size.copy(size);

    event.source._dragRef.reset();
    this.pageStatus.activeComponents2.update((v) => [...v]);
  }
  moveResizePointEnd(event: CdkDragEnd) {
    event.source._dragRef.reset();
    const component2 = this.pageStatus.activeComponents2()[0];
    if (component2) {
      this.pageStatus.activeComponents2.set([]);
      const component = this.pageStatus.activeComponents().find((v) => v.id === component2.id);
      if (component) {
        component.position.copy(component2.position);
        component.size.copy(component2.size);
        updateGroup(this.components(), component);
        this.components.update((v) => [...v]);
      }
    }
  }
  moveRotatePointStart(component: PageComponentTypeAny) {
    this.pageStatus.activeComponents2.set([component.clone()]);
  }
  private _moveRotatePointPosPrev: Point | null = null;
  moveRotatePoint(event: CdkDragMove, componentEl: HTMLElement) {
    const component2 = this.pageStatus.activeComponents2()[0];
    const component = this.pageStatus.activeComponents().find((v) => v.id === component2?.id);
    if (!component2 || !component) {
      return;
    }

    const {pointerPosition, distance} = event;
    const rect = componentEl.getBoundingClientRect();
    const origin = new Point(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const p2 = new Point(pointerPosition.x, pointerPosition.y).sub(origin);
    const p1 = this._moveRotatePointPosPrev || p2.clone().sub(distance.x, distance.y);
    this._moveRotatePointPosPrev = p2.clone();
    const angle2 = Math.atan2(p2.y, p2.x);
    const angle1 = Math.atan2(p1.y, p1.x);
    component2.rotation.add(new Angle(angle2 - angle1, "rad")).constrain();

    const helpers = this.helpers();
    helpers.rotation.show = false;
    delete helpers.rotation.snap;
    helpers.rotation.position = [
      componentEl.offsetLeft + componentEl.offsetWidth / 2,
      componentEl.offsetTop + componentEl.offsetHeight / 2
    ];
    const divider = 8;
    for (let i = 0; i < divider; i++) {
      const snapDeg = i * (360 / divider);
      if (Math.abs(component2.rotation.deg - snapDeg) < helpers.rotation.threshold) {
        helpers.rotation.show = true;
        helpers.rotation.snap = {from: snapDeg, to: snapDeg};
        helpers.rotation.deg = snapDeg;
        break;
      }
    }
    if (!isEqual(helpers, this.helpers())) {
      this.helpers.set({...helpers});
    }

    event.source._dragRef.reset();
    this.pageStatus.activeComponents2.update((v) => [...v]);
  }
  moveRotatePointEnd(event: CdkDragEnd) {
    event.source._dragRef.reset();
    const component2 = this.pageStatus.activeComponents2()[0];
    if (component2) {
      this.pageStatus.activeComponents2.set([]);
      const component = this.pageStatus.activeComponents().find((v) => v.id === component2.id);
      if (component) {
        const helpers = this.helpers();
        component.rotation.copy(component2.rotation);
        if (helpers.rotation.snap) {
          component.rotation.deg = helpers.rotation.snap.to;
          delete helpers.rotation.snap;
        }
        updateGroup(this.components(), component);
        this.components.update((v) => [...v]);
        helpers.rotation.show = false;
        if (!isEqual(helpers, this.helpers())) {
          this.helpers.set({...helpers});
        }
      }
    }
  }

  onComponentTextInput = debounce((event: Event, component: PageComponentText) => {
    component.text = (event.target as HTMLInputElement).value;
    const {isComponentsUpdated} = this.updateControl(component);
    if (!isComponentsUpdated) {
      this.components.update((v) => [...v]);
    }
  }, 200);

  onImgEnd(event: ImageEvent, component: PageComponentImage) {
    const imgEl = event.event.target;
    if (!(imgEl instanceof HTMLImageElement)) {
      return;
    }
    const result = component.fitToImageElement(imgEl);
    if (result.isChanged) {
      // todo
      // this.components.update((v) => [...v]);
    }
  }

  editinFormItem = signal<{i: number; j: number; k: number} | null>(null);
  isEditingFormItem(component: PageComponentForm, i: number, j: number, k: number) {
    if (this.editingComponent()?.id !== component.id) {
      return false;
    }
    const editingFormItem = this.editinFormItem();
    if (!editingFormItem) {
      return false;
    }
    return editingFormItem.i === i && editingFormItem.j === j && editingFormItem.k === k;
  }
  onComponentFormInput = debounce((event: Event, component: PageComponentForm, i: number, j: number, k: number) => {
    const target = event.target as HTMLInputElement;
    component.values[i][j][k] = target.value;
    const {isComponentsUpdated} = this.updateControl(component);
    if (!isComponentsUpdated) {
      this.components.update((v) => [...v]);
    }
  }, 200);
}
