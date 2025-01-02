import {filePathUrl, session} from "@app/app.common";
import {getValue, Value} from "@app/utils/get-value";
import {ObjectOf} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {OptionsDataData} from "@modules/http/services/cad-data.service.types";
import {Properties} from "csstype";
import {uniq} from "lodash";
import {
  InputInfo,
  InputInfoArray,
  InputInfoBoolean,
  InputInfoGroup,
  InputInfoImage,
  InputInfoNumber,
  InputInfoObject,
  InputInfoOption,
  InputInfoOptions,
  InputInfoPart,
  InputInfoSelectMultiple,
  InputInfoSelectSingle,
  InputInfoString
} from "./input.types";

export const parseObjectString = (str: string, objectBefore: ObjectOf<string>, mode: "replace" | "append") => {
  const data = Object.fromEntries(
    str
      .replace(/ /g, "")
      .split("\n")
      .map((v) => {
        const [key, value] = v.split(/[:：]/).map((v) => v.trim());
        return [key, value];
      })
  );
  for (const key in data) {
    if (mode === "replace") {
      if (objectBefore[key] === undefined) {
        continue;
      }
    } else if (mode === "append") {
      if (objectBefore[key] !== undefined) {
        continue;
      }
    } else {
      throw new Error("Invalid mode");
    }
    objectBefore[key] = data[key];
  }
};

export const convertOptions = (options: OptionsDataData[] | undefined) => {
  if (!Array.isArray(options)) {
    return [];
  }
  return options.map<InputInfoOption<string>>((v) => ({value: v.name, label: v.label, img: v.img, disabled: v.disabled, vid: v.vid}));
};

export interface GetInputInfoGroupOpts {
  style?: Properties;
  inputStyle?: Properties;
  groupStyle?: Properties;
  label?: string;
}
export const getInputInfoGroup = <T>(infos: InputInfo<T>[], opts?: GetInputInfoGroupOpts): InputInfoGroup => {
  const {style, groupStyle, inputStyle, label = ""} = opts || {};
  for (const info of infos) {
    info.style = {flex: "1 1 0", boxSizing: "border-box", width: "0", paddingRight: "5px", ...inputStyle, ...info.style};
  }
  return {
    type: "group",
    label,
    style,
    groupStyle: {display: "flex", marginRight: "-5px", flexWrap: "wrap", ...groupStyle},
    infos
  };
};

export const getNumberUnitInput = <T>(label: string, unit: string, others?: Partial<InputInfoNumber<T>>): InputInfoNumber<T> => {
  return {
    type: "number",
    label,
    suffixTexts: [{name: unit}],
    ndigits: 2,
    inputTextAlign: "right",
    ...others
  };
};

export interface GetUnifiedInputsOpts extends GetInputInfoGroupOpts {
  onChange?: () => void;
  unifiedInputStyle?: Properties;
  unified?: boolean;
  customToolbar?: (unifiedInput: InputInfoBoolean) => InputInfo[];
}
export const getUnifiedInputs = <T>(
  id: string,
  inputs: (InputInfoString | InputInfoNumber | InputInfoBoolean)[],
  arr: T[],
  opts?: GetUnifiedInputsOpts
) => {
  const storageKey = `getUnifiedInputs_${id}`;
  let unified: boolean;
  if (typeof opts?.unified === "boolean") {
    unified = opts.unified;
    session.save(storageKey, unified);
  } else {
    const unified2: boolean | null = session.load(storageKey);
    const isUnique = uniq(arr).length < 2;
    if (typeof unified2 !== "boolean") {
      unified = isUnique;
    } else if (unified2 && !isUnique) {
      unified = false;
    } else {
      unified = unified2;
    }
  }
  const {onChange, unifiedInputStyle, inputStyle} = opts || {};
  const unifiedInput: InputInfo = {
    type: "boolean",
    label: "一起改变",
    value: unified,
    appearance: "switch",
    onChange: () => {
      unified = !unified;
      session.save(storageKey, unified);
      if (unified) {
        const value = arr[0];
        let isChanged = false;
        for (let i = 1; i < arr.length; i++) {
          if (arr[i] !== value) {
            isChanged = true;
            arr[i] = value;
          }
        }
        if (isChanged) {
          for (const input of inputs) {
            (input.onChange as any)?.(value, input);
          }
        }
      }
    },
    style: unifiedInputStyle
  };
  for (const input of inputs) {
    const onChange2 = input.onChange as any;
    input.onChange = (val: any) => {
      if (unified) {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = val;
        }
      }
      onChange2?.(val, input);
      onChange?.();
    };
  }
  let toolbarInputs: InputInfo[];
  if (opts?.customToolbar) {
    toolbarInputs = opts.customToolbar(unifiedInput);
  } else {
    toolbarInputs = [unifiedInput];
  }
  return getInputInfoGroup(
    [getInputInfoGroup(toolbarInputs, {style: {flex: "0 0 100%"}, inputStyle: {flex: "0 0 auto", width: "auto"}}), ...inputs],
    {
      label: id,
      ...opts,
      inputStyle: {flex: "0 0 50%", ...inputStyle}
    }
  );
};

export type InputInfoWithDataPart<R extends InputInfo> = Omit<InputInfoPart<R>, "model" | "value">;
export class InputInfoWithDataGetter<T> {
  constructor(
    public data: Value<T>,
    public others?: Omit<InputInfoPart, "model">
  ) {}

  string(key: keyof T, others?: InputInfoWithDataPart<InputInfoString<T>>): InputInfoString<T> {
    return {
      type: "string",
      label: String(key),
      model: {data: this.data, key},
      ...this.others,
      ...others
    };
  }

  selectSingle(
    key: keyof T,
    options: Value<string[]>,
    others?: InputInfoWithDataPart<InputInfoSelectSingle<T, any>>
  ): InputInfoSelectSingle<T, any>;
  selectSingle<R>(
    key: keyof T,
    options: Value<InputInfoOptions<R>>,
    others?: InputInfoWithDataPart<InputInfoSelectSingle<T, R>>
  ): InputInfoSelectSingle<T, R>;
  selectSingle<R = any>(
    key: keyof T,
    options: Value<InputInfoOptions<R>>,
    others?: InputInfoWithDataPart<InputInfoSelectSingle<T, R>>
  ): InputInfoSelectSingle<T, R> {
    return {
      type: "select",
      label: String(key),
      options,
      multiple: false,
      model: {data: this.data, key},
      ...this.others,
      ...others
    };
  }

  selectMultiple(
    key: keyof T,
    options: Value<string[]>,
    others?: InputInfoWithDataPart<InputInfoSelectMultiple<T, any>>
  ): InputInfoSelectMultiple<T, any>;
  selectMultiple<R>(
    key: keyof T,
    options: Value<InputInfoOptions<R>>,
    others?: InputInfoWithDataPart<InputInfoSelectMultiple<T, R>>
  ): InputInfoSelectMultiple<T, R>;
  selectMultiple<R>(
    key: keyof T,
    options: Value<InputInfoOptions<R>>,
    others?: InputInfoWithDataPart<InputInfoSelectMultiple<T, R>>
  ): InputInfoSelectMultiple<T, R> {
    return {
      type: "select",
      label: String(key),
      options: options,
      multiple: true,
      model: {data: this.data, key},
      ...this.others,
      ...others
    };
  }

  number(key: keyof T, others?: InputInfoWithDataPart<InputInfoNumber<T>>): InputInfoNumber<T> {
    return {type: "number", label: String(key), model: {data: this.data, key}, ...this.others, ...others};
  }
  numberWithUnit(key: keyof T, unit: string, others?: InputInfoWithDataPart<InputInfoNumber<T>>): InputInfoNumber<T> {
    return getNumberUnitInput(String(key), unit, {model: {data: this.data, key}, ...this.others, ...others});
  }

  boolean(key: keyof T, others?: InputInfoWithDataPart<InputInfoBoolean<T>>): InputInfoBoolean<T> {
    return {type: "boolean", label: String(key), model: {data: this.data, key}, ...this.others, ...others};
  }

  object(key: keyof T, others?: InputInfoWithDataPart<InputInfoObject<T>>): InputInfoObject<T> {
    return {type: "object", label: String(key), model: {data: this.data, key}, ...this.others, ...others};
  }

  array(key: keyof T, others?: InputInfoWithDataPart<InputInfoArray<T>>): InputInfoArray<T> {
    return {type: "array", label: String(key), model: {data: this.data, key}, ...this.others, ...others};
  }

  image(key: keyof T, http: CadDataService, others?: InputInfoWithDataPart<InputInfoImage<T>>): InputInfoImage<T> {
    const data = getValue(this.data);
    return {
      type: "image",
      label: String(key),
      value: data[key],
      prefix: filePathUrl,
      onChange: async (val, info) => {
        if (val) {
          const result = await http.uploadImage(val);
          if (result?.url) {
            info.value = result.url;
            data[key] = result.url as any;
          }
        } else {
          info.value = "";
          data[key] = "" as any;
        }
      },
      ...this.others,
      ...others
    };
  }
}
