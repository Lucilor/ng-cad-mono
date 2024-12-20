import {AfterViewInit, ElementRef, EventEmitter, Output} from "@angular/core";
import {QueryList} from "@angular/core";
import {ViewChildren} from "@angular/core";
import {Input} from "@angular/core";
import {Component} from "@angular/core";
import {timeout} from "@lucilor/utils";
import {InputComponent} from "@modules/input/components/input.component";
import csstype from "csstype";
import {lastValueFrom, Subject} from "rxjs";
import {FormulaInfo} from "./formulas.types";

@Component({
  selector: "app-formulas",
  templateUrl: "./formulas.component.html",
  styleUrls: ["./formulas.component.scss"],
  imports: [InputComponent]
})
export class FormulasComponent implements AfterViewInit {
  private _formulaInfos: FormulaInfo[] = [];
  @Input()
  get formulaInfos() {
    return this._formulaInfos;
  }
  set formulaInfos(value) {
    this._formulaInfos = value;
    this.update();
  }

  @Input() formulaStyles: csstype.Properties = {};
  @Input() keyStyles: csstype.Properties = {};
  @Input() valueStyles: csstype.Properties = {};

  @Output() updated = new EventEmitter<void>();

  private _viewInited = new Subject<void>();
  @ViewChildren("formula", {read: ElementRef}) formulaRefs?: QueryList<ElementRef<HTMLDivElement>>;

  ngAfterViewInit() {
    this._viewInited.next();
    this._viewInited.complete();
  }

  async update() {
    if (!this.formulaRefs) {
      await lastValueFrom(this._viewInited);
    }
    await timeout(500);
    if (!this.formulaRefs) {
      return;
    }
    const keys: HTMLElement[][] = [];
    this.formulaRefs.forEach((ref) => {
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
