import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {ContextMenuComponent} from "./components/context-menu/context-menu.component";
import {ContextMenuTriggerDirective} from "./directives/context-menu-trigger.directive";

@NgModule({
  declarations: [],
  imports: [CommonModule, ContextMenuComponent, ContextMenuTriggerDirective],
  exports: [ContextMenuComponent, ContextMenuTriggerDirective]
})
export class ContextMenuModule {}
