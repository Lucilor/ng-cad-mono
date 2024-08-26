import {OptionsDataData} from "@app/modules/http/services/cad-data.service.types";
import {ObjectOf} from "@lucilor/utils";
import {MessageService} from "@modules/message/services/message.service";
import {InputInfoOption, Value} from "./input.types";

export const getValue = <T>(fromValue: Value<T>, message: MessageService) => {
  let result = fromValue;
  if (typeof fromValue === "function") {
    try {
      result = (fromValue as () => T)();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
      return null;
    }
  }
  return result as T;
};

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

export const convertOptions = (options: OptionsDataData[]) => {
  return options.map<InputInfoOption>((v) => ({value: v.name, label: v.label, img: v.img, disabled: v.disabled, vid: v.vid}));
};
