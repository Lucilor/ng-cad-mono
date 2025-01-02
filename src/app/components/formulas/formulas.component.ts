import {
  AfterViewInit,
  ChangeDetectionStrategy,
  effect,
  ElementRef,
  forwardRef,
  input,
  output,
  untracked,
  viewChildren
} from "@angular/core";
import {Component} from "@angular/core";
import {timeout} from "@lucilor/utils";
import {InputComponent} from "@modules/input/components/input.component";
import {Properties} from "csstype";
import {lastValueFrom, Subject} from "rxjs";
import {FormulaInfo} from "./formulas.types";

@Component({
  selector: "app-formulas",
  templateUrl: "./formulas.component.html",
  styleUrls: ["./formulas.component.scss"],
  imports: [forwardRef(() => InputComponent)],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormulasComponent implements AfterViewInit {
  formulaInfos = input.required<FormulaInfo[]>();
  formulaStyles = input<Properties>();
  keyStyles = input<Properties>();
  valueStyles = input<Properties>();
  updated = output();

  formulaInfosEff = effect(() => {
    this.formulaInfos();
    untracked(() => this.update());
  });

  private _viewInited = new Subject<void>();

  ngAfterViewInit() {
    this._viewInited.next();
    this._viewInited.complete();
  }

  formulaRefs = viewChildren<ElementRef<HTMLDivElement>>("formula");
  async update() {
    if (!this.formulaRefs) {
      await lastValueFrom(this._viewInited);
    }
    await timeout(500);
    if (!this.formulaRefs) {
      return;
    }
    const keys: HTMLElement[][] = [];
    this.formulaRefs().forEach((ref) => {
      const keysGroup: HTMLElement[] = [];
      ref.nativeElement.querySelectorAll(".formula-key").forEach((el) => {
        if (el instanceof HTMLElement) {
          keysGroup.push(el);
        }
      });
      keys.push(keysGroup);
    });
    const keyWidthArr: number[] = [];
    for (const keyGroup of keys) {
      for (const [j, key] of keyGroup.entries()) {
        const {width} = key.getBoundingClientRect();
        keyWidthArr[j] = keyWidthArr[j] ? Math.max(keyWidthArr[j], width) : width;
      }
    }
    for (const keyGroup of keys) {
      for (const [j, key] of keyGroup.entries()) {
        key.style.width = keyWidthArr[j] + "px";
      }
    }
    this.updated.emit();
  }
}
