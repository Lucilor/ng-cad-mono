import {InputInfoOption, InputInfoSelect} from "@app/modules/input/components/input.types";
import {convertOptions} from "@app/modules/input/components/input.utils";
import {Properties} from "csstype";
import {OptionsAll, OptionsAll2} from "../services/lrsj-status.types";

export const defaultFenleis = ["单门", "子母对开", "双开"];

export const getOptions = (optionsAll: OptionsAll | undefined | null, key: string, setter?: (option: InputInfoOption) => void) => {
  const options = optionsAll?.[key];
  if (!options) {
    return [];
  }
  return options.map(({name}) => {
    const option: InputInfoOption = {value: name};
    if (typeof setter === "function") {
      setter(option);
    }
    return option;
  });
};

export const getOptionInputInfo = (
  optionsAll: OptionsAll2 | undefined | null,
  key: string,
  setter?: (info: InputInfoSelect) => void
): InputInfoSelect => {
  const optionsInfo = optionsAll?.[key];
  if (!optionsInfo) {
    return {type: "select", label: key, options: []};
  }
  const {disabled, multiple} = optionsInfo;
  const info: InputInfoSelect = {
    type: "select",
    label: key,
    options: convertOptions(optionsInfo.options),
    disabled,
    multiple
  };
  if (typeof setter === "function") {
    setter(info);
  }

  return info;
};

export const getGroupStyle = (style?: Properties): Properties => {
  return {display: "flex", flexWrap: "wrap", ...style};
};
export const getInfoStyle = (n: number, style?: Properties): Properties => {
  const percent = 100 / n;
  const margin = 5;
  return {width: `calc(${percent}% - ${margin * 2}px)`, margin: `${margin}px`, ...style};
};
