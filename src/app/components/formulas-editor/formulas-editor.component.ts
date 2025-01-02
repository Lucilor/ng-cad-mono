import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray} from "@angular/cdk/drag-drop";
import {KeyValuePipe, NgTemplateOutlet} from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  viewChildren
} from "@angular/core";
import {ValidationErrors} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {MatTooltipModule} from "@angular/material/tooltip";
import {replaceChars, setGlobal} from "@app/app.common";
import {CalcResult, Formulas} from "@app/utils/calc";
import {openEditFormulasDialog} from "@components/dialogs/edit-formulas-dialog/edit-formulas-dialog.component";
import {FormulasComponent} from "@components/formulas/formulas.component";
import {FormulaInfo} from "@components/formulas/formulas.types";
import {VarNamesComponent} from "@components/var-names/var-names.component";
import {VarNameItem} from "@components/var-names/var-names.types";
import {timeout} from "@lucilor/utils";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {CalcService} from "@services/calc.service";
import {isEmpty} from "lodash";
import {NgScrollbar} from "ngx-scrollbar";
import {InputComponent} from "../../modules/input/components/input.component";
import {FormulasChangeEvent, FormulasCompactConfig, FormulasValidatorFn} from "./formulas-editor.types";

@Component({
  selector: "app-formulas-editor",
  templateUrl: "./formulas-editor.component.html",
  styleUrls: ["./formulas-editor.component.scss"],
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    FormulasComponent,
    forwardRef(() => InputComponent),
    KeyValuePipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    NgScrollbar,
    NgTemplateOutlet,
    VarNamesComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormulasEditorComponent {
  private calc = inject(CalcService);
  private dialog = inject(MatDialog);
  private message = inject(MessageService);

  formulas = model<Formulas | null | undefined>({alias: "formulas"});
  formulasTextIn = input("", {alias: "formulasText"});
  vars = input<Formulas>({});
  varNameItem = input<VarNameItem>();
  menshanweizhi = input("");
  extraInputInfosIn = input<InputInfo[]>([], {alias: "extraInputInfos"});
  validator = input<FormulasValidatorFn>();
  noFormulasText = input(false, {transform: booleanAttribute});
  noScroll = input(false, {transform: booleanAttribute});
  compact = model<FormulasCompactConfig>();
  dataName = input("公式");

  constructor() {
    setGlobal("formulasEditor", this);
  }

  extraInputInfos = signal<InputInfo[]>([]);
  extraInputInfosEff = effect(() => {
    this.extraInputInfos.set(this.extraInputInfosIn());
  });
  refreshExtraInputInfos() {
    this.extraInputInfos.update((v) => [...v]);
  }

  formulaList = computed(() => Object.entries(this.formulas() || {}).map(([k, v]) => [k, String(v)]));
  formulaListInputInfos = computed(() => {
    const list = this.formulaList();
    const onChange = () => {
      this.parseFormulaList(list);
    };
    return list.map<InputInfo[]>((arr) => [
      {type: "string", label: "", model: {key: "0", data: arr}, onChange, validators: () => this.validateVarName(arr[0], list)},
      {type: "string", label: "", textarea: {autosize: {minRows: 1, maxRows: 5}}, model: {key: "1", data: arr}, onChange}
    ]);
  });
  formulasText = signal("");
  formulasTextEff = effect(() => {
    const text = this.formulasTextIn();
    if (this.compact() && !text) {
      this.formulasText.set(this.stringifyFormulaList());
    } else {
      this.formulasText.set(text);
    }
  });

  toggleCompactEditOn() {
    this.compact.update((v) => (v ? {...v, editOn: !v.editOn} : undefined));
  }
  formulasInputInfo = computed(() => {
    const compact = this.compact();
    const info: InputInfo = {
      type: "string",
      label: "",
      textarea: {autosize: {minRows: compact?.minRows, maxRows: compact?.maxRows}},
      value: this.formulasText(),
      autoFocus: !!compact,
      validators: (control) => {
        const validator = this.validator();
        if (validator) {
          const val = control.value;
          const formulaList = this.parseFormulasText(val) || [];
          return validator(formulaList);
        }
        return null;
      },
      onChange: (val) => {
        this.formulasText.set(val);
        if (compact) {
          const list = this.parseFormulasText();
          if (list) {
            this.parseFormulaList(list);
          }
        }
      }
    };
    return info;
  });
  formulaInfos = computed(() =>
    this.formulaList().map<FormulaInfo>(([key, value]) => ({keys: [{eq: true, name: key}], values: [{eq: true, name: value}]}))
  );
  async openEditFormulasDialog() {
    const result = await openEditFormulasDialog(this.dialog, {data: {formulas: this.formulas()}});
    console.log(result);
  }

  parseFormulasText(text = this.formulasText()) {
    const list = text
      .split(/；|;|\n/)
      .filter((v) => v)
      .map<string[]>((v) => {
        v = replaceChars(v);
        const index1 = v.indexOf("=");
        const index2 = v.indexOf(":");
        let index = -1;
        if (index1 > -1 && index2 > -1) {
          index = Math.min(index1, index2);
        } else if (index1 === -1) {
          index = index2;
        } else {
          index = index1;
        }
        if (index > -1) {
          return [v.slice(0, index).replace(/ /g, ""), v.slice(index + 1).replace(/ /g, "")];
        }
        return ["", ""];
      })
      .filter((v) => v);
    this.justifyFormulas(list);

    const errorMsgs: string[] = [];
    const list2: typeof list = [];
    for (const arr of list) {
      const errors = this.validateVarName(arr[0], list);
      if (isEmpty(errors)) {
        list2.push(arr);
      } else {
        errorMsgs.push(`公式 ${arr[0]} = ${arr[1]} 有错：${Object.keys(errors).join(", ")}`);
      }
    }
    if (errorMsgs.length > 0) {
      this.message.error(errorMsgs.join("<br>"));
      return null;
    } else {
      return list2;
    }
  }
  parseFormulaList(list: string[][]) {
    const formulas: Formulas = {};
    for (const arr of list) {
      formulas[arr[0]] = arr[1];
    }
    this.formulas.set(formulas);
  }

  stringifyFormulaList() {
    return this.formulaList()
      .map((v) => `${v[0]} = ${v[1]}`)
      .join("\n\n");
  }

  addFormulas() {
    const list = this.parseFormulasText();
    if (list) {
      this.parseFormulaList(this.formulaList().concat(list));
    }
  }

  validateVarName(varName: string, formulaList: string[][]): ValidationErrors | null {
    if (!varName) {
      return {公式名不能为空: true};
    }
    if (!isNaN(Number(varName))) {
      return {公式名不能是纯数字: true};
    }
    const varNames = formulaList.filter((v) => v[0] === varName);
    if (varNames.length > 1) {
      return {公式名重复: true};
    }
    if (/^[0-9]/.test(varName)) {
      return {公式名不能以数字开头: true};
    }
    return null;
  }
  justifyFormulas(formulaList: string[][]) {
    for (const arr of formulaList) {
      arr[0] = replaceChars(arr[0]).toUpperCase();
      arr[1] = replaceChars(arr[1]).toUpperCase();
      arr[0] = arr[0].replace(/ /g, "");
      arr[1] = arr[1].replace(/[+\-*/÷×]+$/, "");
    }
  }

  inputs = viewChildren(forwardRef(() => InputComponent));
  async validate(formulaList = this.formulaList(), silent?: boolean) {
    const errorsSet = new Set<string>();
    const validator = this.validator();
    if (validator) {
      const errors = validator(formulaList);
      for (const key in errors) {
        errorsSet.add(key);
      }
    }
    this.justifyFormulas(formulaList);
    const inputs = this.inputs();
    for (const input of inputs) {
      const errors2 = input.validateValue();
      for (const key in errors2) {
        errorsSet.add(key);
      }
    }
    const errors = Array.from(errorsSet);
    const calcPreResult = await this.calc.calcFormulasPre(this.formulas() || {}, silent ? undefined : {});
    if (calcPreResult.error) {
      errors.push("计算有误");
    }
    if (!silent && errors.length > 0 && !calcPreResult.error) {
      await this.message.error(errors.join("<br>"));
    }
    return errors;
  }
  async submitFormulas(formulaList = this.formulaList(), silent?: boolean) {
    const errors = await this.validate(formulaList, silent);
    const result: FormulasChangeEvent = {formulas: {}, errors};
    for (const arr of formulaList) {
      result.formulas[arr[0]] = arr[1];
    }
    return result;
  }

  addFormula(i?: number) {
    const list = this.formulaList().slice();
    if (typeof i === "number") {
      list.splice(i, 0, ["", ""]);
    } else {
      list.push(["", ""]);
    }
    this.parseFormulaList(list);
  }
  removeFormula(i: number) {
    const list = this.formulaList().slice();
    list.splice(i, 1);
    this.parseFormulaList(list);
  }
  dropFormula(event: CdkDragDrop<typeof this.formulaList>) {
    const list = this.formulaList().slice();
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.parseFormulaList(list);
  }

  testResult = signal<CalcResult | null>(null);
  testResultEl = viewChild<ElementRef<HTMLElement>>("testResultEl");
  async test(parseText: boolean) {
    const list = parseText ? this.parseFormulasText() : this.formulaList();
    if (!list) {
      return;
    }
    const submitResult = await this.submitFormulas(list);
    if (submitResult.errors.length > 0) {
      return;
    }
    const result = await this.calc.calcFormulas(submitResult.formulas, this.vars());
    if (result) {
      this.testResult.set(result);
      await timeout(200);
      this.message.alert({title: "计算结果", content: this.testResultEl()?.nativeElement.innerHTML});
      this.testResult.set(null);
    }
  }

  returnZero() {
    return 0;
  }

  async import(replace: boolean) {
    await this.message.importData<string[][]>(
      replace,
      (data) => {
        if (replace) {
          this.parseFormulaList(data);
        } else {
          this.parseFormulaList(this.formulaList().concat(data));
        }
      },
      this.dataName()
    );
  }
  export() {
    this.message.exportData(this.formulaList(), this.dataName());
  }
}
