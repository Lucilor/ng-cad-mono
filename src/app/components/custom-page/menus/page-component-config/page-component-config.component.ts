import {CdkDrag, CdkDragDrop, CdkDropList, transferArrayItem} from "@angular/cdk/drag-drop";
import {NgTemplateOutlet} from "@angular/common";
import {ChangeDetectionStrategy, Component, computed, inject, signal} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {getCopyName, getInsertName} from "@app/app.common";
import {ClickStopPropagationDirective} from "@app/modules/directives/click-stop-propagation.directive";
import {TypedTemplateDirective} from "@app/modules/directives/typed-template.directive";
import {MessageService} from "@app/modules/message/services/message.service";
import {NgScrollbarModule} from "ngx-scrollbar";
import {PageComponentTypeAny} from "../../models/page-component-infos";
import {
  beforeJoinGroup,
  beforeLeaveGroup,
  flatPageComponents,
  getPageComponentGroup,
  getPageComponentNames,
  removePageComponent
} from "../../models/page-component-utils";
import {PageComponentGroup} from "../../models/page-components/page-component-group";
import {PageStatusService} from "../../services/page-status.service";

@Component({
  selector: "app-page-component-config",
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    ClickStopPropagationDirective,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    NgScrollbarModule,
    NgTemplateOutlet,
    TypedTemplateDirective
  ],
  templateUrl: "./page-component-config.component.html",
  styleUrl: "./page-component-config.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageComponentConfigComponent {
  private message = inject(MessageService);
  private pageStatus = inject(PageStatusService);

  get components() {
    return this.pageStatus.components;
  }
  get activeComponent() {
    return this.pageStatus.activeComponent;
  }

  componentsTplType!: {$implicit: PageComponentTypeAny[]; level: number; id: string};
  hoveringId = signal<string | null>(null);
  editingId = signal<string | null>(null);

  async getActiveComponent() {
    const component = this.activeComponent();
    if (!component) {
      await this.message.snack("请先选择一个组件");
    }
    return component;
  }
  async group() {
    const component = await this.getActiveComponent();
    if (!component || component.type === "group") {
      return;
    }
    const components = this.components();
    const components2 = getPageComponentGroup(components, component)?.children || components;
    const names = getPageComponentNames(components);
    const group = new PageComponentGroup(getInsertName(names, "分组"));
    beforeJoinGroup(group, [component]);
    group.children = [component];
    group.expanded = true;
    const index = components2.findIndex((v) => v.id === component.id);
    components2.splice(index, 1, group);
    this.components.set([...components]);
  }
  async ungroup() {
    const component = await this.getActiveComponent();
    if (!component || component.type !== "group") {
      return;
    }
    const components = this.components();
    const components2 = getPageComponentGroup(components, component)?.children || components;
    const index = components2.findIndex((v) => v.id === component.id);
    beforeLeaveGroup(component, component.children);
    components2.splice(index, 1, ...component.children);
    this.components.set([...components]);
  }
  async copy() {
    const component = await this.getActiveComponent();
    if (!component) {
      return;
    }
    const components = this.components();
    const names = getPageComponentNames(components);
    const clone = component.clone(true);
    clone.name = getCopyName(names, clone.name);
    const components2 = getPageComponentGroup(components, component)?.children || components;
    components2.push(clone);
    this.components.set([...components]);
  }
  async remove() {
    const component = await this.getActiveComponent();
    if (!component) {
      return;
    }
    const components = this.components();
    removePageComponent(components, component);
    this.components.set([...components]);
  }

  toggleHidden(component: PageComponentTypeAny) {
    component.toggleHidden();
    this.components.update((v) => [...v]);
  }
  toggleLock(component: PageComponentTypeAny) {
    component.toggleLock();
    this.components.update((v) => [...v]);
  }
  toggleExpanded(component: PageComponentGroup) {
    component.expanded = !component.expanded;
    this.components.update((v) => [...v]);
  }
  click(component: PageComponentTypeAny) {
    this.activeComponent.set(component);
  }
  dblClick(event: Event, component: PageComponentTypeAny) {
    event.stopPropagation();
    this.editingId.set(component.id);
  }
  blur() {
    this.editingId.set(null);
    this.components.update((v) => [...v]);
  }
  pointerEnter(event: PointerEvent, component: PageComponentTypeAny) {
    event.stopPropagation();
    this.hoveringId.set(component.id);
  }
  pointerLeave(event: PointerEvent, component: PageComponentTypeAny) {
    event.stopPropagation();
    if (this.hoveringId() === component.id) {
      const group = getPageComponentGroup(this.components(), component);
      this.hoveringId.set(group?.id || null);
    }
  }

  // todo: https://stackblitz.com/edit/angular-cdk-nested-drag-drop-tree-structure
  dropListIds = computed(() => {
    const ids = ["main"];
    for (const component of flatPageComponents(this.components(), true)) {
      if (component.type === "group") {
        ids.push(component.id);
      }
    }
    return ids;
  });
  isDropListDisabled() {
    return !!this.editingId();
  }
  drop(event: CdkDragDrop<PageComponentTypeAny[]>) {
    const {previousContainer, container, previousIndex, currentIndex} = event;
    const prev = previousContainer.data[previousIndex];
    const curr = container.data[currentIndex];
    const components = this.components();
    const prevGroup = getPageComponentGroup(components, prev);
    const currGroup = curr ? getPageComponentGroup(components, curr) : null;
    if (prevGroup) {
      beforeLeaveGroup(prevGroup, [prev]);
    }
    if (currGroup) {
      beforeJoinGroup(currGroup, [prev]);
    }
    transferArrayItem(previousContainer.data, container.data, previousIndex, currentIndex);
    this.components.update((v) => [...v]);
  }

  isComponentGroup(component: PageComponentTypeAny): component is PageComponentGroup {
    return component.type === "group";
  }
}
