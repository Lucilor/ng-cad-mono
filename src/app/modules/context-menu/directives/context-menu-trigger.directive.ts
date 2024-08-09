import {Directive, HostListener, input, output} from "@angular/core";
import {ContextMenuComponent} from "../components/context-menu/context-menu.component";

@Directive({
  selector: "[appContextMenuTrigger]",
  standalone: true
})
export class ContextMenuTriggerDirective {
  appContextMenuTrigger = input.required<ContextMenuComponent>();
  onContextMenuEvt = output<PointerEvent>({alias: "onContextMenu"});

  @HostListener("contextmenu", ["$event"])
  onContextMenu(event: PointerEvent) {
    event.preventDefault();
    this.onContextMenuEvt.emit(event);
    this.appContextMenuTrigger().onContextMenu(event);
  }
}
