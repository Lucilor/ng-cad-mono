import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FloatingDialogTraysComponent} from "./components/floating-dialog-trays/floating-dialog-trays.component";
import {FloatingDialogComponent} from "./components/floating-dialog/floating-dialog.component";
import {FloatingDialogBodyDirective} from "./directives/floating-dialog-body.directive";
import {FloatingDialogTitleDirective} from "./directives/floating-dialog-title.directive";

@NgModule({
  declarations: [],
  imports: [CommonModule, FloatingDialogBodyDirective, FloatingDialogComponent, FloatingDialogTitleDirective, FloatingDialogTraysComponent],
  exports: [FloatingDialogBodyDirective, FloatingDialogComponent, FloatingDialogTitleDirective, FloatingDialogTraysComponent]
})
export class FloatingDialogModule {}
