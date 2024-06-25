import {session} from "@app/app.common";
import {InputInfo, InputInfoBoolean, InputInfoNumber, InputInfoString} from "@app/modules/input/components/input.types";
import {Properties} from "csstype";
import {uniq} from "lodash";

export const getGroupStyle = (): Properties => {
  return {display: "flex", marginRight: "-5px", flexWrap: "wrap"};
};

export const getInputStyle = (isInGroup: boolean, others?: Properties) => {
  const result: Properties = {flex: "1 1 0", width: "0", boxSizing: "border-box", ...others};
  if (isInGroup) {
    result.paddingRight = "5px";
  }
  return result;
};

export const getNumberUnitInput = <T>(
  isInGroup: boolean,
  label: string,
  unit: string,
  style?: Properties,
  others?: Partial<InputInfoNumber<T>>
): InputInfoNumber<T> => {
  return {
    type: "number",
    label,
    suffixTexts: [{name: unit}],
    style: getInputStyle(isInGroup, style),
    ndigits: 2,
    inputTextAlign: "right",
    ...others
  };
};

export const trblItems = [
  {name: "上", index: 0},
  {name: "下", index: 2},
  {name: "左", index: 3},
  {name: "右", index: 1}
];

export const getUnifiedInputs = <T>(
  id: string,
  inputs: (InputInfoString | InputInfoNumber | InputInfoBoolean)[],
  arr: T[],
  onChange: () => void
) => {
  const storageKey = `getUnifiedInputs_${id}`;
  let unified: boolean | null = session.load(storageKey);
  if (typeof unified !== "boolean") {
    unified = uniq(arr).length < 2;
  }
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
          onChange();
        }
      }
    },
    style: getInputStyle(true, {flex: "0 0 100%"})
  };
  for (const input of inputs) {
    input.onChange = (val: any) => {
      if (unified) {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = val;
        }
      }
      onChange();
    };
  }
  return [unifiedInput, ...inputs];
};
