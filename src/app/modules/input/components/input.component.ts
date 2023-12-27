import {TextFieldModule} from "@angular/cdk/text-field";
import {AsyncPipe, KeyValuePipe, NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase} from "@angular/common";
import {
  AfterViewInit,
  Component,
  DoCheck,
  ElementRef,
  HostBinding,
  Input,
  KeyValueDiffer,
  KeyValueDiffers,
  OnChanges,
  SimpleChanges,
  ViewChild
} from "@angular/core";
import {FormControl, FormsModule, ValidationErrors} from "@angular/forms";
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from "@angular/material/autocomplete";
import {MatButtonModule} from "@angular/material/button";
import {ErrorStateMatcher, MatOptionModule} from "@angular/material/core";
import {MatDialog} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatSelectModule} from "@angular/material/select";
import {MatTooltipModule} from "@angular/material/tooltip";
import {joinOptions, splitOptions} from "@app/app.common";
import {CadOptionsInput, openCadOptionsDialog} from "@components/dialogs/cad-options/cad-options.component";
import {isTypeOf, ObjectOf, sortArrayByLevenshtein, timeout, ValueOf} from "@lucilor/utils";
import {Utils} from "@mixins/utils.mixin";
import {OptionsDataData} from "@modules/http/services/cad-data.service.types";
import {MessageService} from "@modules/message/services/message.service";
import Color from "color";
import csstype from "csstype";
import {isEmpty, isEqual} from "lodash";
import {Color as NgxColor} from "ngx-color";
import {ChromeComponent, ColorChromeModule} from "ngx-color/chrome";
import {ColorCircleModule} from "ngx-color/circle";
import {BehaviorSubject} from "rxjs";
import {ClickStopPropagationDirective} from "../../directives/click-stop-propagation.directive";
import {AnchorSelectorComponent} from "./anchor-selector/anchor-selector.component";
import {InputInfo, InputInfoBase, InputInfoTypeMap, InputInfoWithOptions} from "./input.types";

@Component({
  selector: "app-input",
  templateUrl: "./input.component.html",
  styleUrls: ["./input.component.scss"],
  standalone: true,
  imports: [
    NgSwitch,
    NgSwitchCase,
    MatFormFieldModule,
    NgClass,
    NgIf,
    MatInputModule,
    FormsModule,
    MatAutocompleteModule,
    TextFieldModule,
    MatButtonModule,
    MatIconModule,
    NgFor,
    MatOptionModule,
    MatTooltipModule,
    MatSelectModule,
    ClickStopPropagationDirective,
    MatMenuModule,
    AnchorSelectorComponent,
    ColorCircleModule,
    ColorChromeModule,
    AsyncPipe,
    KeyValuePipe
  ]
})
export class InputComponent extends Utils() implements AfterViewInit, OnChanges, DoCheck {
  suffixIconsType!: SuffixIconsType;
  @Input() info: InputInfo = {type: "string", label: ""};
  infoDiffer: KeyValueDiffer<keyof InputInfo, ValueOf<InputInfo>>;
  onChangeDelayTime = 200;
  onChangeDelay: {timeoutId: number} | null = null;

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
    }
  }

  get editable() {
    return !this.info.readonly && !this.info.disabled;
  }

  get optionKey() {
    if (this.info.type === "string") {
      return this.info.optionKey;
    }
    return undefined;
  }

  get optionDialog() {
    if (this.info.type === "string") {
      return this.info.optionDialog;
    }
    return undefined;
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

  options: {value: string; label: string}[] = [];
  // get selectedValue() {
  //     const value = this.value;
  //     const option = this.options.find((v) => v.value === value || v.label === value);
  //     if (option) {
  //         return option.label || option.value;
  //     }
  //     return value;
  // }

  get optionText() {
    const info = this.info;
    if (info.type === "select" || info.type === "selectMulti") {
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

  displayValue: string | null = null;

  @HostBinding("class") class: string[] = [];
  @HostBinding("style") style: csstype.Properties = {};

  @ViewChild("formField", {read: ElementRef}) formField?: ElementRef<HTMLElement>;
  @ViewChild("colorChrome") colorChrome?: ChromeComponent;
  errors: ValidationErrors | null = null;
  get errorMsg(): string {
    if (!this.errors) {
      return "";
    }
    for (const key in this.errors) {
      const value = this.errors[key];
      let msg = "";
      if (typeof value === "string") {
        msg = value;
      } else {
        msg = key;
      }
      if (msg === "required") {
        return `${this.info.label}不能为空`;
      }
      return msg;
    }
    return "";
  }
  errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => !this.isValid()
  };

  valueChange$ = new BehaviorSubject<any>(null);
  filteredOptions$ = new BehaviorSubject<InputComponent["options"]>([]);

  private _validateValueLock = false;

  constructor(
    private message: MessageService,
    private dialog: MatDialog,
    private differs: KeyValueDiffers
  ) {
    super();
    this.valueChange$.subscribe((val) => {
      const info = this.info;
      const {fixedOptions, filterValuesGetter, optionsDisplayLimit} = info as InputInfoWithOptions;
      let sortOptions: boolean;
      const getFilterValues = (option: (typeof this.options)[number]) => {
        let values: string[] = [];
        if (typeof filterValuesGetter === "function") {
          values = filterValuesGetter(option);
        } else {
          values = [option.value, option.label];
        }
        return values;
      };
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
        sortArrayByLevenshtein(options, getFilterValues, this.value);
      }
      if (this.optionDialog) {
        this.filteredOptions$.next([]);
      } else {
        this.filteredOptions$.next(options);
      }
    });
    this.infoDiffer = differs.find(this.info).create();
  }

  async ngAfterViewInit() {
    if (this.info.autoFocus) {
      await timeout(100);
      const el = this.formField?.nativeElement.querySelector("input, textarea");
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
    }
  }

  ngDoCheck() {
    const changes = this.infoDiffer.diff(this.info);
    if (changes) {
      this._onInfoChange(changes);
    }
  }

  private _onInfoChange(changes: NonNullable<ReturnType<typeof this.infoDiffer.diff>>) {
    const {info} = this;
    if (!info.autocomplete) {
      info.autocomplete = "off";
    }
    if ("value" in info) {
      this.value = info.value;
    }
    const type = info.type;
    if (type === "select" || type === "selectMulti" || type === "string" || type === "number") {
      this.options = (info.options || []).map((v) => {
        if (typeof v === "string") {
          return {value: v, label: v};
        }
        if (typeof v === "number") {
          return {value: String(v), label: String(v)};
        }
        return {label: v.label || String(v.value), value: String(v.value)};
      });
    }
    this.displayValue = null;
    if (type === "string") {
      if (info.optionInputOnly && !info.options) {
        info.readonly = true;
        if (typeof info.displayValue === "function") {
          this.displayValue = info.displayValue();
        } else if (info.displayValue) {
          this.displayValue = info.displayValue;
        }
      }
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
    if (info.class) {
      if (Array.isArray(info.class)) {
        this.class.push(...info.class);
      } else {
        this.class.push(info.class);
      }
    }
    this.style = {...info.styles};
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
    switch (typeof value) {
      case "string":
        toChange = "";
        break;
      case "number":
        toChange = 0;
        break;
      case "object":
        if (Array.isArray(value)) {
          toChange = [];
        } else {
          toChange = null;
        }
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
      await navigator.clipboard.writeText(str);
      await this.message.snack(`${this.info.label}已复制`);
    };
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

  async onChange(value = this.value, isAutocomplete = false) {
    const info = this.info;
    this.validateValue(value);
    this._validateValueLock = true;
    setTimeout(() => {
      this._validateValueLock = false;
    }, 100);
    switch (info.type) {
      case "string":
        if (value && info.options && !isAutocomplete) {
          const timeoutId = window.setTimeout(() => {
            if (info.optionInputOnly && !this.options.find((v) => v.value === value)) {
              this.value = "";
            }
            this.onChange(value, true);
          }, this.onChangeDelayTime);
          this.onChangeDelay = {timeoutId};
        } else {
          info.onChange?.(value);
        }
        break;
      case "number":
        info.onChange?.(value);
        break;
      case "boolean":
        info.onChange?.(value);
        break;
      case "select":
        info.onChange?.(value);
        break;
      case "selectMulti":
        info.onChange?.(value);
        break;
      case "coordinate":
        info.onChange?.(value);
        break;
      case "color":
        info.onChange?.(value);
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
    const validators = this.info.validators;
    if (!validators) {
      return null;
    }
    const control = new FormControl(value, validators);
    this.errors = control.errors;
    return this.errors;
  }

  isValid() {
    return isEmpty(this.errors);
  }

  onAutocompleteChange(event: MatAutocompleteSelectedEvent) {
    if (this.onChangeDelay) {
      window.clearTimeout(this.onChangeDelay.timeoutId);
      this.onChangeDelay = null;
    }
    this.onChange(event.option.value, true);
  }

  onInput(value = this.value) {
    switch (this.info.type) {
      case "string":
        this.info.onInput?.(value);
        break;
      case "number":
        this.info.onInput?.(value);
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
    const data = this.model.data;
    let optionsUseId: InputInfoWithOptions["optionsUseId"] = false;
    let isSingleOption: InputInfoWithOptions["isSingleOption"] = false;
    let optionInputOnly: InputInfoWithOptions["optionInputOnly"] = false;
    let optionField: InputInfoWithOptions["optionField"] = undefined;
    let optionValueType: InputInfoWithOptions["optionValueType"] = "string";
    let options: OptionsDataData[] | undefined;
    const info = this.info;
    if (info.type === "string") {
      optionsUseId = !!info.optionsUseId;
      isSingleOption = !!info.isSingleOption;
      optionInputOnly = !!info.optionInputOnly;
      optionField = info.optionField;
      optionValueType = info.optionValueType || "string";
      if (Array.isArray(info.options)) {
        options = (info.options || []).map<OptionsDataData>((v, i) => ({
          vid: i,
          name: typeof v === "string" ? v : v.value,
          img: null,
          disabled: false
        }));
      }
    }
    const value = key ? data[key] : this.value;
    const isObject = isTypeOf(value, "object");
    let checked: string[] = isObject && optionKey ? value[optionKey] : value;
    if (optionValueType === "string") {
      checked = splitOptions(isObject && optionKey ? value[optionKey] : value);
    }
    if (!Array.isArray(checked)) {
      checked = [];
    }
    const fields = optionField ? [optionField] : [];
    const dialogData: CadOptionsInput = {data, name: optionKey || "", multi: !isSingleOption, fields, options};
    if (optionsUseId) {
      dialogData.checkedVids = checked.map((v) => Number(v));
    } else {
      dialogData.checkedItems = checked;
    }
    const result = await openCadOptionsDialog(this.dialog, {data: dialogData});
    if (result) {
      let options2: string[];
      if (optionsUseId) {
        options2 = result.map((v) => String(v.vid));
        if (optionInputOnly) {
          this.displayValue = joinOptions(result.map((v) => v.mingzi));
        }
      } else {
        options2 = result.map((v) => v.mingzi);
      }
      let resultValue: string | string[] = options2;
      if (optionValueType === "string") {
        resultValue = joinOptions(options2);
      }
      if (key) {
        if (isObject && optionKey) {
          data[key][optionKey] = resultValue;
        } else {
          data[key] = resultValue;
        }
      } else {
        this.value = resultValue;
      }
      this.validateValue();
    }
  }

  asObject(val: any): ObjectOf<any> {
    if (val && typeof val === "object") {
      return val;
    }
    return {};
  }

  cast<T extends InputInfo["type"]>(_: T, data: InputInfo) {
    return data as InputInfoTypeMap[T];
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
}

interface SuffixIconsType {
  $implicit: InputInfoBase["suffixIcons"];
}
