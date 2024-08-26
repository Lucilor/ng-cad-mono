import {AbstractControl, AbstractControlOptions, ValidationErrors} from "@angular/forms";
import {FloatLabelType} from "@angular/material/form-field";
import {Formulas} from "@app/utils/calc";
import {CadOptionsInput, CadOptionsOutput} from "@components/dialogs/cad-options/cad-options.component";
import {EditFormulasInput} from "@components/dialogs/edit-formulas-dialog/edit-formulas-dialog.component";
import {ObjectOf} from "@lucilor/utils";
import {OptionsData} from "@modules/http/services/cad-data.service.types";
import Color from "color";
import {Properties} from "csstype";

export type Value<T> = T | (() => T);

export interface InputInfoBase<T = any> {
  label: string;
  floatLabel?: FloatLabelType;
  model?: {data: T | (() => T); key: keyof T};
  value?: Value<any>;
  readonly?: boolean;
  clearable?: boolean;
  copyable?: boolean;
  disabled?: boolean;
  suffixIcons?: InputInfoButtonInfo[];
  suffixTexts?: InputInfoTextInfo[];
  hint?: Value<string>;
  autocomplete?: "on" | "off";
  showEmpty?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  validators?: AbstractControlOptions["validators"];
  noInitialValidate?: boolean;
  forceValidateNum?: number; // change this to trigger validation
  name?: string;
  class?: string | string[];
  style?: Properties;
  inputTextAlign?: Properties["textAlign"];
  hidden?: boolean;
  displayValue?: Value<string>;
  filterValuesGetter?: (option: InputInfoOption<T>) => string[];
}

export interface InputInfoString<T = any> extends InputInfoBase<T> {
  type: "string";
  value?: Value<string>;
  textarea?: {autosize?: {minRows?: number; maxRows?: number}};
  onInput?: (val: string, info: InputInfoString<T>) => void;
  onChange?: (val: string, info: InputInfoString<T>) => void;
  options?: Value<InputInfoOptions<string>>;
  optionValueType?: "string" | "array";
  fixedOptions?: string[];
  optionRequired?: boolean;
  optionsDisplayLimit?: number;
  optionMultiple?: boolean;
  optionsDialog?: OptionsDialog;
}

export interface InputInfoNumber<T = any> extends InputInfoBase<T> {
  type: "number";
  value?: Value<number>;
  step?: number;
  min?: number;
  max?: number;
  ndigits?: number;
  onInput?: (val: number, info: InputInfoNumber<T>) => void;
  onChange?: (val: number, info: InputInfoNumber<T>) => void;
}

export type KeyValidatorFn = (control: AbstractControl, objValue: string) => ValidationErrors | null;
export type ValueValidatorFn = (control: AbstractControl, objKey: string) => ValidationErrors | null;
export interface InputInfoObject<T = any, K = string> extends InputInfoBase<T> {
  type: "object";
  value?: Value<ObjectOf<any>>;
  options?: Value<InputInfoOptions<K>>;
  optionValueType?: "string" | "array";
  optionsDialog?: OptionsDialog;
  optionMultiple?: boolean;
  keyLabel?: string;
  valueLabel?: string;
  keyValidators?: KeyValidatorFn | KeyValidatorFn[] | null;
  valueValidators?: ValueValidatorFn | ValueValidatorFn[] | null;
  keysReadonly?: boolean;
  parseString?: boolean;
  isXuanxiang?: boolean;
  requiredKeys?: string[];
}

export interface InputInfoArray<T = any> extends InputInfoBase<T> {
  type: "array";
  value?: Value<any[]>;
  valueLabel?: string;
  valueValidators?: AbstractControlOptions["validators"];
}

export interface InputInfoBoolean<T = any> extends InputInfoBase<T> {
  type: "boolean";
  appearance?: "select" | "radio" | "switch";
  onChange?: (val: boolean, info: InputInfoBoolean<T>) => void;
}

export interface InputInfoSelectBase<T = any, K = string> extends InputInfoBase<T> {
  type: "select";
  options: Value<InputInfoOptions<K>>;
  optionsDialog?: OptionsDialog;
  openInNewTab?: {optionKey: string; onOptionsChange: (options: OptionsData) => void};
}
export interface InputInfoSelectSingle<T = any, K = string> extends InputInfoSelectBase<T, K> {
  value?: Value<string>;
  optionText?: string | ((val: string) => string);
  multiple?: false;
  onChange?: (val: K, info: InputInfoSelectSingle<T, K>) => void;
}
export interface InputInfoSelectMultiple<T = any, K = string> extends InputInfoSelectBase<T, K> {
  value?: Value<string[]>;
  optionText?: string | ((val: string[]) => string);
  multiple: true;
  onChange?: (val: K[], info: InputInfoSelectMultiple<T, K>) => void;
}
export type InputInfoSelect<T = any, K = any> = InputInfoSelectSingle<T, K> | InputInfoSelectMultiple<T, K>;

export interface InputInfoCoordinate<T = any> extends InputInfoBase<T> {
  type: "coordinate";
  value?: Value<[number, number]>;
  compact?: boolean;
  labelX?: string;
  labelY?: string;
  onChange?: (val: {anchor: [number, number]}, info: InputInfoCoordinate<T>) => void;
}

export interface InputInfoColor<T = any> extends InputInfoBase<T> {
  type: "color";
  value?: Value<Color>;
  options?: Color[];
  optionsOnly?: boolean;
  onChange?: (val: Color, info: InputInfoColor<T>) => void;
}

export interface InputInfoFile<T = any> extends InputInfoBase<T> {
  type: "file";
  accept?: string;
  multiple?: boolean;
  model?: never;
  onChange?: (val: FileList | null, info: InputInfoFile<T>) => void;
}

export interface InputInfoImage<T = any> extends InputInfoBase<T> {
  type: "image";
  accept?: string;
  multiple?: boolean;
  bigPicSrc?: string;
  prefix?: string;
  model?: never;
  onChange?: (val: File | null, info: InputInfoImage<T>) => void;
}

export interface InputInfoFormulas<T = any> extends InputInfoBase<T> {
  type: "formulas";
  value?: Value<Formulas>;
  params?: Value<Omit<EditFormulasInput, "formulas">>;
  onChange?: (val: Formulas, info: InputInfoFormulas<T>) => void;
}

export interface InputInfoButtonInfo {
  name: string;
  onClick?: () => void;
  color?: "" | "primary" | "accent" | "warn";
  isDefault?: boolean;
}
export interface InputInfoTextInfo {
  name: string;
  color?: "" | "primary" | "accent" | "warn";
}
export interface InputInfoButton<T = any> extends InputInfoBase<T> {
  type: "button";
  buttons: InputInfoButtonInfo[];
}

export interface InputInfoList<T = any> extends InputInfoBase<T> {
  type: "list";
  value?: Value<string[]>;
}

export interface InputInfoGroup<T = any> extends InputInfoBase<T> {
  type: "group";
  infos?: InputInfo<T>[];
  groupStyle?: Properties;
}

export type InputInfo<T = any> =
  | InputInfoString<T>
  | InputInfoNumber<T>
  | InputInfoObject<T>
  | InputInfoArray<T>
  | InputInfoBoolean<T>
  | InputInfoSelect<T>
  | InputInfoCoordinate<T>
  | InputInfoColor<T>
  | InputInfoFile<T>
  | InputInfoImage<T>
  | InputInfoFormulas<T>
  | InputInfoButton<T>
  | InputInfoList<T>
  | InputInfoGroup<T>;

export type InputInfoOption<T = any> = {value: T; label?: string; disabled?: boolean; img?: string; vid?: number};

export type InputInfoOptions<T = any> = (InputInfoOption<T> | string)[];

export interface OptionsDialog {
  optionKey?: string;
  optionsUseId?: boolean;
  optionField?: string;
  defaultValue?: CadOptionsInput["defaultValue"];
  noImage?: CadOptionsInput["noImage"];
  openInNewTab?: CadOptionsInput["openInNewTab"];
  useLocalOptions?: CadOptionsInput["useLocalOptions"];
  nameField?: CadOptionsInput["nameField"];
  info?: CadOptionsInput["info"];
  onChange?: (val: CadOptionsOutput) => void;
}
