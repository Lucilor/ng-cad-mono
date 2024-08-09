import {Directive, HostBinding} from "@angular/core";

@Directive({
  selector: "[appFloatingDialogBody]",
  standalone: true
})
export class FloatingDialogBodyDirective {
  @HostBinding("class") class = ["flex-110"];
}
