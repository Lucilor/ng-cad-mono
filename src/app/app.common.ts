import {AbstractControlOptions, FormControl, FormControlOptions, FormControlState, FormGroup} from "@angular/forms";
import {environment} from "@env";
import {LocalStorage, log, ObjectOf, SessionStorage, Timer} from "@lucilor/utils";
import JsBarcode from "jsbarcode";
import {TDocumentInformation} from "pdfmake/interfaces";

declare global {
  interface Window {
    parseBaobianzhengmianRules(content: string, vars?: ObjectOf<any>): {errors: string[]};
    batchCheck(data: ObjectOf<any>[]): ObjectOf<string[]>;
  }
}
declare module "csstype" {
  interface Properties {
    [key: string]: any;
  }
}
export const remoteHost = "https://www.let888.cn" as const;
export const remoteFilePath = `${remoteHost}/filepath`;

export const addJs = (name: string) => {
  const script = document.createElement("script");
  script.src = `${remoteHost}/static/js/${name}.js?${new Date().getTime()}`;
  document.head.append(script);
};
addJs("node2rect");

export const projectName = "NgCad2";
export const session = new SessionStorage(projectName);
export const local = new LocalStorage(projectName);

export const imgEmpty = "assets/images/empty.jpg";
export const imgCadEmpty = "assets/images/cad-empty.png";
export const imgLoading = "assets/images/loading.gif";
export const publicKey = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzDn9P27uGK+wuoO2AG7j
7vHQtN93Q0zxfbeQlBYVTEe0BZ4MXg10xGab/NBHqLQxLyQf1QOwYYQTzVS/ajje
ItFGUqQsAuZMUqxW9vL/Xk7QMLCbseOyEb82mOZ/DZXij1zEjaqVhonV5W8n6VVJ
5RO6Vk/EZ2gcGEELGwqQOb2ItVjINLDZLzV9Sb+VXxZiv/eYfvcqAYGuOTgRsjVG
Ys+u2YRp2VGNaNcLbd+Z3AsAZiCqzZR5H0cJnySg6axHEKa1I5RIGFVmCHBONv5x
ZyOT2GCZPEv6TnMvmWLpIk9QpjrSEkn5E11YlCN9g5ekk31RbVdb9GkxNzz8iLzM
VwIDAQAB
-----END PUBLIC KEY-----
`;

export const splitOptions = (str: string) => {
  if (!str) {
    return [];
  }
  const regExps = [/[;；]/, /[，,]/, /[*]/];
  for (const regExp of regExps) {
    if (regExp.test(str)) {
      return str
        .split(regExp)
        .filter(Boolean)
        .map((s) => s.trim());
    }
  }
  return [str];
};

export const joinOptions = (options: (string | {mingzi: string})[] | null | undefined, separator: ";" | "," | "*" = ";") => {
  const values: string[] = [];
  for (const option of options || []) {
    let value = undefined;
    if (typeof option === "string") {
      value = option;
    } else if (option) {
      value = option.mingzi || "";
    }
    if (value === undefined || value === null || value === "") {
      continue;
    }
    value = value.trim();
    if (value && !values.includes(value)) {
      values.push(value);
    }
  }
  return values.join(separator);
};

export const replaceChars = (str: string) => {
  const fullChars2HalfChars: ObjectOf<string> = {
    "“": '"',
    "”": '"',
    "。": ".",
    "，": ",",
    "？": "?",
    "！": "!",
    "；": ";",
    "：": ":",
    "‘": "'",
    "’": "'",
    "（": "(",
    "）": ")"
  };
  let tmp = "";
  for (const char of str) {
    if (typeof fullChars2HalfChars[char] === "string") {
      tmp += fullChars2HalfChars[char];
    } else {
      tmp += char;
    }
  }
  return tmp;
};

export type TypedFormGroup<T extends ObjectOf<any>> = FormGroup<{[K in keyof T]: FormControl<T[K]>}>;

export const getFormControl = <T>(value: T | FormControlState<T>, opts: FormControlOptions = {}) =>
  new FormControl(value, {...opts, nonNullable: true});

export const getFormGroup = <T extends ObjectOf<any>>(controls: {[K in keyof T]: FormControl<T[K]>}, opts?: AbstractControlOptions) =>
  new FormGroup(controls, opts);

export const setGlobal = <T>(key: string, value: T, production = false) => {
  if (!production && environment.production) {
    return;
  }
  (window as any)[key] = value;
  // Reflect.defineProperty(window, key, {value});
};

export const getFormControlErrorString = (control: FormControl) => {
  const errors = control.errors;
  if (!errors) {
    return null;
  }
  const mapFn = (str: string) => {
    switch (str) {
      case "required":
        return "必填";
      default:
        return str;
    }
  };
  return Object.keys(errors).map(mapFn).join(", ");
};

export const timer = new Timer({color: "deeppink"});
setGlobal("timer", timer);
setGlobal("log", log);

export const replaceRemoteHost = (urlStr: string) => {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return urlStr;
  }
  const remoteUrl = new URL(remoteHost);
  if (!environment.production && remoteUrl.host === url.host) {
    return url.href.replace(remoteHost, window.origin);
  }
  return url.href;
};

export interface XiaodaohangStructure {
  mingzi: string;
  table: string;
  gongneng: {jiegou: XiaodaohangColumn[]};
}
export interface XiaodaohangColumn {
  field: string;
  ch: string;
  datatype: string;
  guanlianTable?: string;
}

export const filePathUrl = `${origin}/filepath`;

export const getFilepathUrl = (url: string | undefined | null, opts?: {prefix?: string; suffix?: string; remote?: boolean}) => {
  if (!url) {
    return "";
  }
  if (url.startsWith("http")) {
    return url;
  }
  const {prefix, suffix, remote} = opts || {};
  let result = `${remote ? remoteFilePath : filePathUrl}/${url}`;
  if (prefix || suffix) {
    const strs = url.split("/");
    if (strs.length > 0) {
      strs[strs.length - 1] = `${prefix || ""}${strs[strs.length - 1]}${suffix || ""}`;
    }
    result = `${filePathUrl}/${strs.join("/")}`;
  }
  return result;
};

export const getOrderBarcode = (element: string | HTMLElement, options: JsBarcode.Options & {text?: string}) => {
  const result = {fulfilled: true, error: null as string | null};
  let text: string | undefined;
  if (options.text) {
    text = options.text;
    delete options.text;
  }
  try {
    if (text) {
      JsBarcode(element, text, options);
    } else {
      JsBarcode(element).options(options).init();
    }
  } catch (error) {
    if (typeof error === "string") {
      if (error.includes("is not a valid input")) {
        result.error = "订单编号不能包含中文或特殊字符，请修改订单编号";
      } else {
        result.error = error;
      }
    } else if (error instanceof Error) {
      result.error = error.message;
    } else {
      result.error = "未知错误";
    }
    result.fulfilled = false;
  }
  return result;
};

export const getBooleanStr = (value: boolean) => {
  return value ? "是" : "否";
};

export const getNameWithSuffix = (names: string[], name: string, suffix: string, startNum: number) => {
  if (suffix && !names.includes(name)) {
    return name;
  }
  let i = startNum;
  const getSuffix = () => suffix + (i === 0 ? "" : i.toString());
  let suffix2 = getSuffix();
  while (names.includes(name + suffix2)) {
    suffix2 = getSuffix();
    i++;
  }
  return name + suffix2;
};
export const getInsertName = (names: string[], name: string) => getNameWithSuffix(names, name, "", 1);
export const getCopyName = (names: string[], name: string) => getNameWithSuffix(names, name, "_复制", 0);

export const getPdfInfo = (others?: TDocumentInformation): TDocumentInformation => {
  const now = new Date();
  return {
    title: "noname",
    author: "Lucilor",
    subject: "Lucilor",
    creator: "Lucilor",
    producer: "Lucilor",
    creationDate: now,
    modDate: now,
    ...others
  };
};

export const getArrayString = (value: any, separator: string) => {
  if (Array.isArray(value)) {
    return value.join(separator);
  } else {
    return "";
  }
};
export const getObjectString = (value: any, separator: string, separatorKv: string) => {
  if (!value || typeof value !== "object") {
    return "";
  }
  const strs: string[] = [];
  for (const key in value) {
    strs.push(`${key}${separatorKv}${value[key]}`);
  }
  return strs.join(separator);
};
export const getValueString = (value: any, separator = ",", separatorKv = ":") => {
  if (Array.isArray(value)) {
    return getArrayString(value, separator);
  } else if (value && typeof value === "object") {
    return getObjectString(value, separator, separatorKv);
  } else if ([null, undefined].includes(value)) {
    return "";
  } else if (typeof value === "boolean") {
    return getBooleanStr(value);
  } else {
    return String(value);
  }
};

export interface KeyEventItem {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
}
export const onKeyEvent = (event: KeyboardEvent, items: KeyEventItem[]) => {
  for (const item of items) {
    const {key, ctrl, shift, alt, action: callback} = item;
    if (ctrl && !event.ctrlKey) {
      continue;
    }
    if (shift && !event.shiftKey) {
      continue;
    }
    if (alt && !event.altKey) {
      continue;
    }
    if (event.key.toLowerCase() === key.toLowerCase()) {
      callback();
      event.preventDefault();
      return;
    }
  }
};

export const getArray = <T>(validators: T | T[] | null | undefined) => {
  if (validators === null || validators === undefined) {
    return [];
  }
  if (Array.isArray(validators)) {
    return validators;
  }
  return [validators];
};
