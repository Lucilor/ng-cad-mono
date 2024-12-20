import {Directive, Input} from "@angular/core";

@Directive({
  selector: "[appTypedTemplate]",
  standalone: true
})
export class TypedTemplateDirective<T> {
  @Input({required: true}) appTypedTemplate!: T;

  static ngTemplateContextGuard<T>(dir: TypedTemplateDirective<T>, ctx: any): ctx is T {
    return true;
  }
}
