import {ValidatorFn} from "@angular/forms";
import {isTypeOf} from "packages/utils/lib";

export class CustomValidators {
  static numberRangeStr: ValidatorFn = (control) => {
    const value = control.value;
    if (!value) {
      return null;
    }
    if (!/^\d+(.\d+)?-\d+(.\d+)?$/.test(value)) {
      return {取值范围不符合格式: true};
    }
    return null;
  };
  static rangedNumber = (rangeStr: string): ValidatorFn => {
    let [min, max] = rangeStr.split("-").map(Number);
    if (min > max) {
      [min, max] = [max, min];
    }
    if (!isTypeOf(min, "number") || !isTypeOf(max, "number")) {
      return () => null;
    }
    return (control) => {
      const value = control.value;
      if (value < min) {
        return {[`不能小于${min}`]: true};
      }
      if (value > max) {
        return {[`不能大于${max}`]: true};
      }
      return null;
    };
  };
}
