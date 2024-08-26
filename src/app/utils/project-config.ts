import {ObjectOf} from "@lucilor/utils";

export class ProjectConfig {
  constructor(private raw: ProjectConfigRaw = {}) {}

  getRaw() {
    return {...this.raw};
  }

  setRaw(raw: ProjectConfigRaw = {}) {
    this.raw = {...raw};
  }

  get<T extends string>(key: string): T;
  get<T extends string>(key: string, defaultValue: string): T;
  get<T extends string>(key?: string, defaultValue?: string) {
    if (key) {
      return (this.raw[key] || defaultValue || "") as T;
    } else {
      return this.raw;
    }
  }

  getBoolean(key: string) {
    const value = this.get(key);
    return value === "是";
  }

  getIsEqual<T extends string>(key: string, value: T) {
    return this.get<T>(key) === value;
  }

  set<T extends string>(key: string, value: T) {
    this.raw[key] = value;
  }

  setBoolean(key: string, value: boolean) {
    this.set(key, value ? "是" : "否");
  }

  remove(key: string) {
    delete this.raw[key];
  }

  exists(key: string) {
    return key in this.raw;
  }
}

export type ProjectConfigRaw = ObjectOf<string>;
