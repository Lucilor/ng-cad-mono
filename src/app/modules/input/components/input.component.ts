import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, CdkDropListGroup, moveItemInArray} from "@angular/cdk/drag-drop";
import {TextFieldModule} from "@angular/cdk/text-field";
import {AsyncPipe, KeyValuePipe, NgTemplateOutlet} from "@angular/common";
import {
  AfterViewInit,
  Component,
  DoCheck,
  ElementRef,
  forwardRef,
  HostBinding,
  Input,
  KeyValueDiffer,
  KeyValueDiffers,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from "@angular/core";
import {FormControl, FormsModule, ValidationErrors, Validators} from "@angular/forms";
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from "@angular/material/autocomplete";
import {MatButtonModule} from "@angular/material/button";
import {ErrorStateMatcher, MatOptionModule} from "@angular/material/core";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatRadioModule} from "@angular/material/radio";
import {MatSelectModule} from "@angular/material/select";
import {MatTooltipModule} from "@angular/material/tooltip";
import {imgCadEmpty, joinOptions, splitOptions} from "@app/app.common";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {CadOptionsInput, openCadOptionsDialog} from "@components/dialogs/cad-options/cad-options.component";
import {openEditFormulasDialog} from "@components/dialogs/edit-formulas-dialog/edit-formulas-dialog.component";
import {CadViewer} from "@lucilor/cad-viewer";
import {getTypeOf, isTypeOf, ObjectOf, selectFiles, sortArrayByLevenshtein, timeout, ValueOf} from "@lucilor/utils";
import {Utils} from "@mixins/utils.mixin";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {OptionsDataData} from "@modules/http/services/cad-data.service.types";
import {ImageComponent} from "@modules/image/components/image/image.component";
import {MessageService} from "@modules/message/services/message.service";
import Color from "color";
import csstype from "csstype";
import {isEmpty, isEqual} from "lodash";
import {Color as NgxColor} from "ngx-color";
import {ChromeComponent, ColorChromeModule} from "ngx-color/chrome";
import {ColorCircleModule} from "ngx-color/circle";
import {NgScrollbarModule} from "ngx-scrollbar";
import {BehaviorSubject} from "rxjs";
import {ClickStopPropagationDirective} from "../../directives/click-stop-propagation.directive";
import {AnchorSelectorComponent} from "./anchor-selector/anchor-selector.component";
import {InputInfo, InputInfoBase, InputInfoOptions, InputInfoString} from "./input.types";
import {getValue, parseObjectString} from "./input.utils";

@Component({
  selector: "app-input",
  templateUrl: "./input.component.html",
  styleUrls: ["./input.component.scss"],
  standalone: true,
  imports: [
    AnchorSelectorComponent,
    AsyncPipe,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CdkDropListGroup,
    ClickStopPropagationDirective,
    ColorChromeModule,
    ColorCircleModule,
    FormsModule,
    forwardRef(() => CadImageComponent),
    ImageComponent,
    KeyValuePipe,
    MatAutocompleteModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatOptionModule,
    MatRadioModule,
    MatSelectModule,
    MatTooltipModule,
    NgScrollbarModule,
    NgTemplateOutlet,
    TextFieldModule
  ]
})
export class InputComponent extends Utils() implements AfterViewInit, OnChanges, DoCheck, OnDestroy {
  suffixIconsType!: SuffixIconsType;
  @Input() info: InputInfo = {type: "string", label: ""};
  infoDiffer: KeyValueDiffer<keyof InputInfo, ValueOf<InputInfo>>;
  modelDataDiffer: KeyValueDiffer<keyof InputInfo["model"], ValueOf<InputInfo["model"]>>;
  onChangeDelayTime = 200;
  onChangeDelay: {timeoutId: number} | null = null;
  cadInfos: {id: string; name: string; val: any}[] = [];
  showListInput = true;
  objectString = "";
  @ViewChildren(InputComponent) inputs?: QueryList<InputComponent>;

  private _model: NonNullable<Required<InputInfo["model"]>> = {data: {key: ""}, key: "key"};
  get model() {
    let model = {...this.info.model};
    if (!model || !("data" in model) || !("key" in model)) {
      model = this._model;
    }
    if (typeof model.data === "function") {
      model.data = model.data();
    }
    return model;
  }

  get name() {
    const {name, label} = this.info;
    let key = this.model.key;
    if (typeof key !== "string") {
      key = String(key);
    }
    return name || key || label;
  }

  get value() {
    const {data, key} = this.model;
    if (data && typeof data === "object" && key) {
      return data[key];
    }
    return "";
  }
  set value(val) {
    const {data, key} = this.model;
    if (data && typeof data === "object" && key) {
      data[key] = val;
    }
    const type = this.info.type;
    if (type === "color") {
      this.setColor(val);
    } else if (type === "formulas") {
      this.updateFormulasStr();
    }
    this.updateDisplayValue();
  }

  get editable() {
    return !this.info.readonly && !this.info.disabled;
  }

  get optionsDialog() {
    switch (this.info.type) {
      case "string":
      case "select":
      case "object":
        return this.info.optionsDialog;
      default:
        return undefined;
    }
  }

  get suffixIcons() {
    return this.info.suffixIcons || [];
  }

  get hint() {
    const hint = this.info.hint;
    if (typeof hint === "function") {
      return hint();
    }
    return hint || "";
  }

  options: {value: any; label: string; disabled?: boolean; img?: string}[] = [];

  get optionText() {
    const info = this.info;
    if (info.type === "select") {
      if (typeof info.optionText === "function") {
        return info.optionText(this.value);
      }
      return info.optionText;
    }
    return "";
  }

  get anchorStr() {
    const value = this.value;
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return "";
  }

  colorBg = "";
  colorText = "";
  get colorStr() {
    const value = this.value;
    if (typeof value === "string") {
      return value;
    } else if (value instanceof Color) {
      return value.hex();
    }
    return "";
  }
  get colorOptions() {
    const {info} = this;
    if (info.type !== "color" || !info.options) {
      return [];
    }
    return info.options.map((v) => (typeof v === "string" ? v : new Color(v).hex()));
  }

  get fileAccept() {
    const {info} = this;
    if (info.type === "file") {
      return info.accept;
    } else if (info.type === "image") {
      return info.accept || "image/*";
    }
    return undefined;
  }

  displayValue: string | null = null;
  formulasStr = "";

  @HostBinding("class") class: string[] = [];
  @HostBinding("style") style: csstype.Properties = {};

  @ViewChild("colorChrome") colorChrome?: ChromeComponent;
  @ViewChildren("cadContainer") cadContainers?: QueryList<ElementRef<HTMLElement>>;
  cadViewers: CadViewer[] = [];

  errors: ValidationErrors | null = null;
  errors2: ValidationErrors | null = null;
  errorsKey: ObjectOf<ValidationErrors | null> = {};
  errorsValue: ObjectOf<ValidationErrors | null> = {};
  imgCadEmpty = imgCadEmpty;

  valueChange$ = new BehaviorSubject<any>(null);
  filteredOptions$ = new BehaviorSubject<InputComponent["options"]>([]);

  private _validateValueLock = false;

  constructor(
    private message: MessageService,
    private dialog: MatDialog,
    private differs: KeyValueDiffers,
    private elRef: ElementRef<HTMLElement>,
    private http: CadDataService
  ) {
    super();
    this.valueChange$.subscribe((val) => {
      const info = this.info;
      const {filterValuesGetter} = info;
      let sortOptions: boolean;
      const getFilterValues = (option: (typeof this.options)[number]) => {
        let values: string[] = [];
        if (typeof filterValuesGetter === "function") {
          values = filterValuesGetter(option);
        } else {
          values = [option.label];
          if (typeof option.value === "string") {
            values.push(option.value);
          }
        }
        return values;
      };
      let fixedOptions: string[] | undefined;
      let optionsDisplayLimit: number | undefined;
      if (info.type === "string") {
        fixedOptions = info.fixedOptions;
        optionsDisplayLimit = info.optionsDisplayLimit;
      }
      let options: typeof this.options;
      if (val) {
        options = this.options.filter((option) => {
          const values = getFilterValues(option);
          for (const v of values) {
            if (v.includes(val) || (fixedOptions && fixedOptions.includes(v))) {
              return true;
            }
          }
          return false;
        });
        sortOptions = true;
      } else {
        options = this.options;
        sortOptions = false;
      }
      if (typeof optionsDisplayLimit === "number") {
        options = options.slice(0, optionsDisplayLimit);
      }
      if (sortOptions) {
        const value = this.value;
        if (typeof value === "string") {
          sortArrayByLevenshtein(options, getFilterValues, value);
        }
      }
      if (this.optionsDialog) {
        this.filteredOptions$.next([]);
      } else {
        this.filteredOptions$.next(options);
      }
    });
    this.infoDiffer = differs.find(this.info).create();
    this.modelDataDiffer = differs.find(this.model.data).create();
  }

  async ngAfterViewInit() {
    if (this.info.autoFocus) {
      await timeout(100);
      const el = this.elRef?.nativeElement.querySelector("input, textarea");
      if (el instanceof HTMLElement) {
        el.focus();
      }
    }
    if (this.colorChrome) {
      await timeout(0);
      this.setColor(this.colorChrome.hex);
    }
    this.infoDiffer = this.differs.find(this.info).create();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.info) {
      this.infoDiffer = this.differs.find(this.info).create();
      this.modelDataDiffer = this.differs.find(this.model.data).create();
    }
  }

  ngDoCheck() {
    const infoChanges = this.infoDiffer.diff(this.info);
    if (infoChanges) {
      this._onInfoChange(infoChanges);
    }
    const modelDataChanges = this.modelDataDiffer.diff(this.model.data);
    if (modelDataChanges) {
      this.updateDisplayValue();
    }
  }

  ngOnDestroy() {
    for (const cadViewer of this.cadViewers) {
      cadViewer.destroy();
    }
  }

  private _getErrorMsg(errors: ValidationErrors | null): string {
    if (!errors) {
      return "";
    }
    for (const key in errors) {
      const value = errors[key];
      let msg = "";
      if (typeof value === "string") {
        msg = value;
      } else {
        msg = key;
      }
      if (msg === "required") {
        return "不能为空";
      }
      return msg;
    }
    return "";
  }

  getErrorMsg() {
    return this._getErrorMsg(this.errors);
  }

  getErrorMsgKey(key: string) {
    if (this.info.type === "object") {
      return this._getErrorMsg(this.errorsKey[key]);
    } else {
      return "";
    }
  }

  getErrorMsgValue(key: string) {
    if (this.info.type === "object" || this.info.type === "array") {
      return this._getErrorMsg(this.errorsValue[key]);
    } else {
      return "";
    }
  }

  getErrorStateMatcher(): ErrorStateMatcher {
    return {isErrorState: () => !this.isValid()};
  }

  getErrorStateMatcherKey(key: string): ErrorStateMatcher {
    return {isErrorState: () => !this.isValidKey(key)};
  }

  getErrorStateMatcherValue(key: string): ErrorStateMatcher {
    return {isErrorState: () => !this.isValidValue(key)};
  }

  private async _onInfoChange(changes: NonNullable<ReturnType<typeof this.infoDiffer.diff>>) {
    const {info} = this;
    if (!info.autocomplete) {
      info.autocomplete = "on";
    }
    if ("value" in info) {
      this.value = getValue(info.value, this.message);
    }
    let options: InputInfoOptions | undefined | null;
    const {type, validators, readonly, disabled} = info;
    if (type === "select" || type === "string") {
      options = getValue(info.options, this.message);
      this.options = (options || []).map<(typeof this.options)[number]>((v) => {
        if (typeof v === "string") {
          return {value: v, label: v};
        }
        if (typeof v === "number") {
          return {value: String(v), label: String(v)};
        }
        return {label: v.label || String(v.value), value: v.value, disabled: v.disabled, img: v.img};
      });
      const isRequired = validators === Validators.required || (Array.isArray(validators) && validators.includes(Validators.required));
      if (isRequired && !readonly && !disabled) {
        if (this.options.length === 1) {
          this.value = this.options[0].value;
        }
      }
    } else if (type === "formulas") {
      this.updateFormulasStr();
    }
    this.class = [type];
    if (typeof info.label === "string" && info.label && !info.label.includes(" ")) {
      this.class.push(info.label);
    }
    if (info.readonly) {
      this.class.push("readonly");
    }
    if (info.disabled) {
      this.class.push("disabled");
    }
    if (info.clearable) {
      if (info.readonly || info.disabled) {
        info.clearable = false;
      }
    }
    if (info.class) {
      if (Array.isArray(info.class)) {
        this.class.push(...info.class);
      } else {
        this.class.push(info.class);
      }
    }
    this.style = {...info.style};
    if (info.hidden) {
      this.style.display = "none";
    }
    let validateValue = !!info.initialValidate;
    changes.forEachItem((item) => {
      if (item.key === "forceValidateNum") {
        if (item.currentValue !== item.previousValue) {
          validateValue = true;
        }
      }
    });
    if (validateValue) {
      this.validateValue();
    }
    this.valueChange$.next(this.value);
  }

  clear() {
    const value = this.value;
    if (value === undefined || value === null) {
      return;
    }
    let toChange: any;
    switch (getTypeOf(value)) {
      case "string":
        toChange = "";
        break;
      case "number":
      case "NaN":
        toChange = 0;
        break;
      case "bigint":
        toChange = 0n;
        break;
      case "boolean":
        toChange = false;
        break;
      case "array":
        toChange = [];
        break;
      case "object":
        toChange = {};
        break;
      default:
        toChange = null;
    }
    if (!isEqual(value, toChange)) {
      this.value = toChange;
      this.onInput(toChange);
      this.onChange(toChange);
    }
  }

  copy() {
    const copy = async (str: string) => {
      try {
        await navigator.clipboard.writeText(str);
      } catch (error) {
        console.error(error);
        await this.message.snack("复制失败");
        return;
      }
      await this.message.snack(`${this.info.label}已复制`);
    };
    const {info} = this;
    if (info.type === "formulas") {
      copy(this.formulasStr);
    } else {
      const value = this.value;
      switch (typeof value) {
        case "string":
          copy(value);
          break;
        case "number":
          copy(String(value));
          break;
        default:
          copy(JSON.stringify(value));
      }
    }
  }

  async onChange(value = this.value, isAutocomplete = false) {
    const info = this.info;
    this.validateValue(value);
    this._validateValueLock = true;
    setTimeout(() => {
      this._validateValueLock = false;
    }, 100);
    switch (info.type) {
      case "string":
        {
          const {options, optionInputOnly} = info;
          if (value && options && !isAutocomplete) {
            const timeoutId = window.setTimeout(() => {
              if (optionInputOnly && !this.options.find((v) => v.value === value)) {
                this.value = "";
              }
              this.onChange(value, true);
            }, this.onChangeDelayTime);
            this.onChangeDelay = {timeoutId};
          } else {
            info.onChange?.(value, info);
          }
        }
        break;
      case "number":
        info.onChange?.(value, info);
        break;
      case "boolean":
        info.onChange?.(value, info);
        break;
      case "select":
        if (info.multiple) {
          info.onChange?.(value, info);
        } else {
          info.onChange?.(value, info);
        }
        break;
      case "coordinate":
        info.onChange?.(value, info);
        break;
      case "color":
        info.onChange?.(value, info);
        break;
      case "file":
        info.onChange?.(null, info);
        break;
      case "image":
        info.onChange?.(null, info);
        break;
      default:
        break;
    }
  }

  onColorChange(ngxColor: NgxColor) {
    this.value = new Color(ngxColor.hex);
    this.onChange();
  }

  validateValue(value = this.value) {
    const {info, inputs} = this;
    const validators = info.validators;
    let errors: ValidationErrors | null = null;
    let errors2: ValidationErrors | null = null;
    if (validators) {
      const control = new FormControl(value, validators);
      errors = control.errors;
    }
    if (inputs) {
      for (const input of inputs.toArray()) {
        input.validateValue();
        if (input.errors && !input.info.hidden) {
          if (!errors2) {
            errors2 = {};
          }
          const errors3 = {...input.errors};
          Object.assign(errors2, errors3);
        }
      }
    }
    if (isEmpty(errors)) {
      errors = null;
    }
    if (isEmpty(errors2)) {
      errors2 = null;
    }
    this.errors = errors;
    this.errors2 = errors2;
    if (info.type === "object" && isTypeOf(value, "object")) {
      const {keyValidators} = info;
      const errorsKey: ObjectOf<ValidationErrors | null> = {};
      const errorsValue: ObjectOf<ValidationErrors | null> = {};
      for (const key in value) {
        const val = value[key];
        if (keyValidators) {
          const control = new FormControl(key, keyValidators);
          if (!isEmpty(control.errors)) {
            errorsKey[key] = control.errors;
          }
        }
        if (info.valueValidators) {
          const control = new FormControl(val, info.valueValidators);
          if (!isEmpty(control.errors)) {
            errorsValue[key] = control.errors;
          }
        }
      }
      this.errorsKey = errorsKey;
      this.errorsValue = errorsValue;
    } else if (info.type === "array" && Array.isArray(value)) {
      const {valueValidators} = info;
      const errorsValue: ObjectOf<ValidationErrors | null> = {};
      for (const [i, val] of value.entries()) {
        if (valueValidators) {
          const control = new FormControl(val, valueValidators);
          if (!isEmpty(control.errors)) {
            errorsValue[String(i)] = control.errors;
          }
        }
      }
      this.errorsValue = errorsValue;
    }
    return {...this.errors, ...this.errors2, ...this.errorsKey, ...this.errorsValue};
  }

  isValid() {
    return isEmpty(this.errors);
  }

  isValidKey(key: string) {
    return isEmpty(this.errorsKey[key]);
  }

  isValidValue(key: string) {
    return isEmpty(this.errorsValue[key]);
  }

  onAutocompleteChange(event: MatAutocompleteSelectedEvent) {
    if (this.onChangeDelay) {
      window.clearTimeout(this.onChangeDelay.timeoutId);
      this.onChangeDelay = null;
    }
    this.onChange(event.option.value, true);
  }

  onInput(value = this.value) {
    const {info} = this;
    switch (info.type) {
      case "string":
        info.onInput?.(value, info);
        break;
      case "number":
        info.onInput?.(value, info);
        break;
      default:
        break;
    }
    this.valueChange$.next(value);
  }

  onBlur() {
    if (!this._validateValueLock) {
      this.validateValue();
    }
  }

  async selectOptions(key?: keyof any, optionKey?: string) {
    const {info} = this;
    if (info.readonly || info.disabled) {
      return;
    }
    const optionsDialog = this.optionsDialog;
    if (!optionsDialog) {
      return;
    }
    const data = this.model.data;
    const {optionField, optionsUseId, defaultValue, onChange, useLocalOptions} = optionsDialog;
    if (optionsDialog.optionKey) {
      optionKey = optionsDialog.optionKey;
    }
    let optionValueType: InputInfoString["optionValueType"];
    let multiple: boolean | undefined;
    let hasOptions = false;
    if (info.type === "string" || info.type === "object") {
      optionValueType = info.optionValueType || "string";
      multiple = info.optionMultiple;
      hasOptions = !!info.options;
    } else if (info.type === "select") {
      multiple = info.multiple;
      hasOptions = !optionKey || !!useLocalOptions;
    }

    let checked: string[];
    if (info.type === "select") {
      checked = Array.isArray(this.value) ? this.value : [this.value];
    } else {
      const value = key ? data[key] : this.value;
      const isObject = isTypeOf(value, "object");
      checked = isObject && optionKey ? value[optionKey] : value;
      if (optionValueType === "string") {
        checked = splitOptions(isObject && optionKey ? value[optionKey] : value);
      }
    }
    if (!Array.isArray(checked)) {
      checked = [];
    }

    const fields = optionField ? [optionField] : [];
    let options: OptionsDataData[] | undefined;
    if (hasOptions) {
      options = this.options.map<OptionsDataData>((v, i) => {
        let vid = i;
        let name = "";
        if (typeof v === "string") {
          name = v;
        } else {
          const optoinValue = v.value;
          if (typeof optoinValue === "string") {
            name = optoinValue;
          } else if (isTypeOf(optoinValue, "object")) {
            for (const valKey of ["id", "vid"]) {
              if (isTypeOf(optoinValue[valKey], "number")) {
                vid = optoinValue[valKey];
                break;
              }
            }
            for (const valKey of ["name", "mingzi"]) {
              if (isTypeOf(optoinValue[valKey], "string")) {
                name = optoinValue[valKey];
                break;
              }
            }
          }
        }
        return {vid, name, label: v.label, img: v.img || "", disabled: false};
      });
    }
    const dialogData: CadOptionsInput = {
      data,
      name: optionKey || "",
      multi: multiple,
      defaultValue,
      fields,
      options,
      openInNewTab: optionsDialog.openInNewTab,
      noImage: optionsDialog.noImage,
      nameField: optionsDialog.nameField
    };
    if (optionsUseId) {
      dialogData.checkedVids = checked.map((v) => Number(v));
    } else {
      dialogData.checkedItems = checked;
    }
    const result = await openCadOptionsDialog(this.dialog, {data: dialogData});
    if (result) {
      const options1 = result.options;
      let options2: string[];
      if (optionsUseId) {
        options2 = options1.map((v) => String(v.vid));
      } else {
        options2 = options1.map((v) => v.mingzi);
      }
      let resultValue: string | string[] = options2;
      if (optionValueType === "string") {
        resultValue = joinOptions(options2);
      } else if (!multiple) {
        resultValue = options2[0] || "";
      }
      if (info.type === "select") {
        this.value = resultValue;
      } else if (key) {
        const value = key ? data[key] : this.value;
        const isObject = isTypeOf(value, "object");
        if (isObject && optionKey) {
          data[key][optionKey] = resultValue;
        } else {
          data[key] = resultValue;
        }
      }
      if (typeof onChange === "function") {
        onChange(result);
      }
      this.validateValue();
    }
  }

  asObject(val: any): ObjectOf<any> {
    if (isTypeOf(val, "object")) {
      return val;
    }
    return {};
  }

  getAnchorValue(axis: "x" | "y") {
    if (axis === "x") {
      const value = this.value[0];
      switch (value) {
        case 0:
          return "左";
        case 0.5:
          return "中";
        case 1:
          return "右";
        default:
          return value;
      }
    } else if (axis === "y") {
      const value = this.value[1];
      switch (value) {
        case 0:
          return "下";
        case 0.5:
          return "中";
        case 1:
          return "上";
        default:
          return value;
      }
    }
    return "";
  }

  isEmpty(value: any) {
    if (!this.info.showEmpty) {
      return false;
    }
    return [null, undefined, ""].includes(value);
  }

  setColor(color: Color | string | undefined | null) {
    const value = typeof color === "string" ? color : color?.hex();
    try {
      const c = new Color(value);
      if (c.isLight()) {
        this.colorBg = "black";
      } else {
        this.colorBg = "white";
      }
    } catch (error) {
      this.colorBg = "white";
    }
  }

  returnZero() {
    return 0;
  }

  async selectFile() {
    const files = await selectFiles({accept: this.fileAccept});
    if (!files || !files.length) {
      return;
    }
    const {info} = this;
    if (info.type === "file") {
      info.onChange?.(files, info);
    } else if (info.type === "image" && files[0]) {
      info.onChange?.(files[0], info);
    }
  }

  changeObjectKey2(obj: ObjectOf<any>, oldKey: string, newKey: string | Event) {
    this.changeObjectKey(obj, oldKey, newKey);
    setTimeout(() => {
      this.validateValue();
    }, 0);
  }

  changeObjectValue2(obj: ObjectOf<any>, key: string, value: any) {
    this.changeObjectValue(obj, key, value);
    setTimeout(() => {
      this.validateValue();
    }, 0);
  }

  updateFormulasStr() {
    const {info} = this;
    if (info.type !== "formulas") {
      return;
    }
    const {value} = this;
    if (!isTypeOf(value, "object")) {
      return;
    }
    this.formulasStr = Object.entries(value)
      .map(([k, v]) => `${k}=${v}`)
      .join(";");
  }

  async editFormulas() {
    const {info} = this;
    const {readonly, disabled} = info;
    if (info.type !== "formulas" || readonly || disabled) {
      return;
    }
    let {value} = this;
    const params = getValue(info.params, this.message);
    if (!isTypeOf(value, "object")) {
      value = {};
    }
    const result = await openEditFormulasDialog(this.dialog, {data: {...params, formulas: value}});
    if (result) {
      this.value = result;
      info.onChange?.(result, info);
    }
  }

  updateDisplayValue() {
    const {info} = this;
    const displayValue = getValue(info.displayValue, this.message) || null;
    this.displayValue = null;
    if (displayValue) {
      this.displayValue = displayValue;
    } else if (this.optionsDialog) {
      const {value} = this;
      if (Array.isArray(value)) {
        this.displayValue = joinOptions(value);
      } else if (typeof value === "string") {
        this.displayValue = value;
      }
    }
  }

  async openInNewTab() {
    const {info} = this;
    if (info.type !== "select") {
      return;
    }
    const openInNewTab = info.openInNewTab;
    if (!openInNewTab) {
      return;
    }
    const {optionKey: name, onOptionsChange} = openInNewTab;
    const url = await this.http.getShortUrl(name);
    if (url) {
      window.open(url);
    }
    if (await this.message.newTabConfirm()) {
      const options = await this.http.getOptions({name, page: 1, limit: Infinity});
      if (options) {
        onOptionsChange(options);
      }
    }
  }

  dropArrayItem(event: CdkDragDrop<any>) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  }

  async moveArrayItem(previousIndex: number, input: HTMLInputElement) {
    const {value} = this;
    if (!Array.isArray(value)) {
      return;
    }
    let currentIndex = Number(input.value);
    if (isNaN(currentIndex) || currentIndex < 0) {
      currentIndex = 0;
    } else if (currentIndex >= value.length) {
      currentIndex = value.length - 1;
    }
    moveItemInArray(value, previousIndex, currentIndex);

    this.showListInput = false;
    await timeout(0);
    this.showListInput = true;
  }

  onListInputKeyPress(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.stopPropagation();
    }
  }

  parseObjectString(mode: Parameters<typeof parseObjectString>[2]) {
    parseObjectString(this.objectString, this.value, mode);
  }
}

interface SuffixIconsType {
  $implicit: InputInfoBase["suffixIcons"];
}
