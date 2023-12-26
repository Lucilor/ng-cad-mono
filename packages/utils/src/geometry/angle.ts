import {DEFAULT_TOLERANCE} from "./numbers";

export class Angle {
  private _value: number;
  unit: "rad" | "deg";
  get isFinite() {
    return isFinite(this._value);
  }
  get isNaN() {
    return isNaN(this._value);
  }

  constructor(value = 0, unit: "rad" | "deg" = "rad") {
    this._value = value;
    this.unit = unit;
  }

  get rad() {
    if (this.unit !== "rad") {
      return (this._value / 180) * Math.PI;
    }
    return this._value;
  }
  set rad(value) {
    if (this.unit !== "rad") {
      value = (value / Math.PI) * 180;
    }
    this._value = value;
  }

  get deg() {
    if (this.unit !== "deg") {
      return (this._value / Math.PI) * 180;
    }
    return this._value;
  }
  set deg(value) {
    if (this.unit !== "rad") {
      value = (value / 180) * Math.PI;
    }
    this._value = value;
  }

  constrain(circle = false) {
    let limit = 0;
    if (this.unit === "rad") {
      limit = Math.PI * 2;
    } else if (this.unit === "deg") {
      limit = 360;
    }
    if (circle && this._value !== 0 && this._value % limit === 0) {
      this._value = limit;
    } else {
      this._value = ((this._value % limit) + limit) % limit;
    }
    return this;
  }

  set(value = 0, unit = this.unit) {
    this._value = value;
    this.unit = unit;
    return this;
  }

  clone() {
    return new Angle(this._value, this.unit);
  }

  copy(angle: Angle) {
    this._value = angle._value;
    this.unit = angle.unit;
  }

  add(angle: Angle) {
    if (this.unit === "deg") {
      this._value += angle.deg;
    } else if (this.unit === "rad") {
      this._value += angle.rad;
    }
    return this;
  }

  sub(angle: Angle) {
    if (this.unit === "deg") {
      this._value -= angle.deg;
    } else if (this.unit === "rad") {
      this._value -= angle.rad;
    }
    return this;
  }

  multiply(angle: Angle) {
    if (this.unit === "deg") {
      this._value *= angle.deg;
    } else if (this.unit === "rad") {
      this._value *= angle.rad;
    }
    return this;
  }

  divide(angle: Angle) {
    if (this.unit === "deg") {
      this._value /= angle.deg;
    } else if (this.unit === "rad") {
      this._value /= angle.rad;
    }
    return this;
  }

  equals(angle: Angle, tolerance = DEFAULT_TOLERANCE) {
    return Math.abs(this.rad - angle.rad) <= tolerance;
  }
}
