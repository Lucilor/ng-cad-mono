import {CdkDrag, CdkDragEnd, CdkDragHandle, CdkDragMove, Point} from "@angular/cdk/drag-drop";
import {NgTemplateOutlet} from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild
} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule, MatMenuTrigger} from "@angular/material/menu";
import {ContextMenuModule} from "@app/modules/context-menu/context-menu.module";
import {Properties} from "csstype";
import {uniqueId} from "lodash";
import {FloatingDialogsManagerService} from "../../services/floating-dialogs-manager.service";
import {ResizeHandle} from "./floating-dialog.types";

@Component({
  selector: "app-floating-dialog",
  standalone: true,
  imports: [CdkDrag, CdkDragHandle, ContextMenuModule, MatButtonModule, MatIconModule, MatMenuModule, NgTemplateOutlet],
  templateUrl: "./floating-dialog.component.html",
  styleUrl: "./floating-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FloatingDialogComponent implements OnInit, OnDestroy {
  private manager = inject(FloatingDialogsManagerService);

  id = uniqueId("floatingDialog");
  name = input.required<string>();
  width = model<string | number>("auto");
  height = model<string | number>("auto");
  top = input<string | number | null>(0);
  left = input<string | number | null>(0);
  size = model<Readonly<Point>>({x: 0, y: 0});
  position = model<Readonly<Point>>({x: 0, y: 0});
  active = model<boolean>(false);
  pinned = model<boolean>(false);
  minimized = model<boolean>(false);
  maximized = model<boolean>(false);
  close = output();

  dialogEl = viewChild.required<ElementRef<HTMLElement>>("dialogEl");
  contextMenu = viewChild.required<MatMenuTrigger>("contextMenu");

  constructor() {
    effect(
      () => {
        const minimized = this.minimized();
        if (minimized) {
          this.active.set(false);
        }
        this.manager.dialogs.update((v) => [...v]);
      },
      {allowSignalWrites: true}
    );
  }

  ngOnInit() {
    this.beActive();
    this.manager.dialogs.update((dialogs) => [...dialogs, this]);
  }
  ngOnDestroy() {
    this.manager.dialogs.update((dialogs) => dialogs.filter((dialog) => dialog !== this));
  }

  getPxStr(value: string | number | null) {
    if (value === null) {
      return undefined;
    } else if (typeof value === "number") {
      return `${value}px`;
    }
    return value;
  }
  style = computed<Properties>(() => {
    if (this.maximized()) {
      const limits = this.manager.limits();
      let top = 0;
      let left = 0;
      let right = window.innerWidth;
      let bottom = window.innerHeight;
      if (limits.top) {
        top = limits.top.getBoundingClientRect().bottom;
      }
      if (limits.left) {
        left = limits.left.getBoundingClientRect().right;
      }
      if (limits.right) {
        right = limits.right.getBoundingClientRect().left;
      }
      if (limits.bottom) {
        bottom = limits.bottom.getBoundingClientRect().top;
      }
      const width = right - left;
      const height = bottom - top;
      return {top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px`};
    }
    const style: Properties = {};
    const size = this.size();
    if (size.x > 0) {
      style.width = `${size.x}px`;
    } else {
      style.width = this.getPxStr(this.width());
    }
    if (size.y > 0) {
      style.height = `${size.y}px`;
    } else {
      style.height = this.getPxStr(this.height());
    }
    style.top = this.getPxStr(this.top());
    style.left = this.getPxStr(this.left());
    return style;
  });

  titleBtns = computed(() => {
    const btns: {icon: string; action: () => void}[] = [];
    if (this.pinned()) {
      btns.push({icon: "keep_off", action: () => this.pinned.set(false)});
    } else {
      btns.push({icon: "keep", action: () => this.pinned.set(true)});
    }
    btns.push({icon: "remove", action: () => this.toggleMinimized()});
    btns.push({icon: this.maximized() ? "stack" : "check_box_outline_blank", action: () => this.toggleMaximized()});
    btns.push({icon: "close", action: () => this.close.emit()});
    return btns;
  });
  contextMenuBtns = computed(() => {
    const btns: {name: string; action: () => void}[] = [];
    const dialogs = this.manager.dialogs();
    if (dialogs.length > 1) {
      btns.push({
        name: "关闭其他窗口",
        action: () => {
          for (const dialog of dialogs) {
            if (dialog.id !== this.id) {
              dialog.close.emit();
            }
          }
        }
      });
    }
    btns.push({
      name: "关闭所有窗口",
      action: () => {
        for (const dialog of dialogs) {
          dialog.close.emit();
        }
      }
    });
    return btns;
  });

  beActive() {
    const dialogs = this.manager.dialogs();
    this.active.set(true);
    for (const dialog of dialogs) {
      if (dialog.id !== this.id) {
        dialog.active.set(false);
      }
    }
  }
  toggleMinimized() {
    this.minimized.update((v) => !v);
    if (this.minimized()) {
      this.active.set(false);
      const dialog = this.manager.dialogs().find((v) => !v.minimized());
      if (dialog) {
        dialog.beActive();
      }
    } else {
      this.beActive();
    }
  }
  toggleMaximized() {
    this.maximized.update((v) => !v);
    if (this.maximized()) {
      this._positionBefore.set({...this.position()});
      this.position.set({x: 0, y: 0});
    } else {
      this.position.set(this._positionBefore());
    }
  }

  dragDisabled = computed(() => this.maximized());
  private _positionBefore = signal<Readonly<Point>>({x: 0, y: 0});
  onDragEnded(event: CdkDragEnd) {
    this.position.set(event.source.getFreeDragPosition());
  }

  resizeHandles = signal<ResizeHandle[]>([
    {name: "top"},
    {name: "left"},
    {name: "right"},
    {name: "bottom"},
    {name: "top-left"},
    {name: "top-right"},
    {name: "bottom-left"},
    {name: "bottom-right"}
  ]);
  private _sizeBefore = signal<Readonly<Point>>({x: 0, y: 0});
  onResizeBefore() {
    const rect = this.dialogEl().nativeElement.getBoundingClientRect();
    this.size.set({x: rect.width, y: rect.height});
    this._sizeBefore.set({...this.size()});
    this._positionBefore.set({...this.position()});
  }
  onResize(event: CdkDragMove, handle: ResizeHandle) {
    const {x: sizeX, y: sizeY} = this._sizeBefore();
    const {x: posX, y: posY} = this._positionBefore();
    const {x: dx, y: dy} = event.distance;
    switch (handle.name) {
      case "top":
        this.size.update(({x}) => ({x, y: sizeY - dy}));
        this.position.update(({x}) => ({x, y: posY + dy}));
        break;
      case "left":
        this.size.update(({y}) => ({x: sizeX - dx, y}));
        this.position.update(({y}) => ({x: posX + dx, y}));
        break;
      case "right":
        this.size.update(({y}) => ({x: sizeX + dx, y}));
        break;
      case "bottom":
        this.size.update(({x}) => ({x, y: sizeY + dy}));
        break;
      case "top-left":
        this.size.set({x: sizeX - dx, y: sizeY - dy});
        this.position.set({x: posX + dx, y: posY + dy});
        break;
      case "top-right":
        this.size.set({x: sizeX + dx, y: sizeY - dy});
        this.position.set({x: posX, y: posY + dy});
        break;
      case "bottom-left":
        this.size.set({x: sizeX - dx, y: sizeY + dy});
        this.position.set({x: posX + dx, y: posY});
        break;
      case "bottom-right":
        this.size.set({x: sizeX + dx, y: sizeY + dy});
        break;
    }
    event.source.reset();
  }
}
