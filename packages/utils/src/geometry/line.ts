import {Angle} from "./angle";
import {Arc} from "./arc";
import {DEFAULT_TOLERANCE} from "./constants";
import {Curve} from "./curve";
import {lineIntersectsArc, lineIntersectsLine} from "./intersection";
import {MatrixLike} from "./matrix";
import {approachZero, isBetween, isEqualTo, isNearZero} from "./numbers";
import {Point} from "./point";

export class Line extends Curve {
  start: Point;
  end: Point;
  get isFinite() {
    return this.start.isFinite && this.end.isFinite;
  }
  get isNaN() {
    return this.start.isNaN || this.end.isNaN;
  }

  constructor(start: Point, end = start) {
    super();
    this.start = start;
    this.end = end;
  }

  clone() {
    return new Line(this.start.clone(), this.end.clone());
  }

  copy({start, end}: Line) {
    this.start.copy(start);
    this.end.copy(end);
  }

  reverse() {
    [this.start, this.end] = [this.end, this.start];
    return this;
  }

  get length() {
    return this.start.distanceTo(this.end);
  }

  get middle() {
    return this.getPoint(0.5);
  }

  get theta() {
    const {x: x1, y: y1} = this.start;
    const {x: x2, y: y2} = this.end;
    return new Angle(Math.atan2(y2 - y1, x2 - x1), "rad");
  }

  getSlope(tol = DEFAULT_TOLERANCE) {
    const {x: x1, y: y1} = this.start;
    const {x: x2, y: y2} = this.end;
    if (isEqualTo(x1, x2, tol)) {
      return Infinity;
    }
    return approachZero((y1 - y2) / (x1 - x2), tol);
  }

  getExpression(tol = DEFAULT_TOLERANCE) {
    const slope = this.getSlope(tol);
    const result = {a: 0, b: 0, c: 0};
    if (isFinite(slope)) {
      result.a = slope;
      result.b = -1;
      result.c = this.start.y - this.start.x * slope;
    } else {
      result.a = 1;
      result.c = -this.start.x;
    }
    let count = 0;
    for (const k in result) {
      if (result[k as keyof typeof result] < 0) {
        count++;
      }
    }
    if (count > 1) {
      result.a *= -1;
      result.b *= -1;
      result.c *= -1;
    }
    return result;
  }

  equals(line: Line, tol = DEFAULT_TOLERANCE) {
    return this.start.equals(line.start, tol) && this.end.equals(line.end, tol);
  }

  isParallelWith(line: Line, tol = DEFAULT_TOLERANCE) {
    const slope1 = line.getSlope(tol);
    const slope2 = this.getSlope(tol);
    if (!isFinite(slope1) && !isFinite(slope2)) {
      return true;
    }
    return isNearZero(slope1 - slope2, tol);
  }

  transform(matrix: MatrixLike) {
    this.start.transform(matrix);
    this.end.transform(matrix);
    return this;
  }

  distanceTo(line: Line | Point, tol = DEFAULT_TOLERANCE) {
    if (line instanceof Line) {
      if (!this.isParallelWith(line, tol)) {
        return NaN;
      }
      const exp1 = this.getExpression(tol);
      const exp2 = line.getExpression(tol);
      return Math.abs(exp1.c - exp2.c) / Math.sqrt(exp1.a ** 2 + exp1.b ** 2);
    } else {
      const {a, b, c} = this.getExpression(tol);
      return Math.abs((a * line.x + b * line.y + c) / Math.sqrt(a ** 2 + b ** 2));
    }
  }

  crossProduct(line: Line) {
    const p1 = this.end.clone().sub(this.start);
    const p2 = line.end.clone().sub(line.start);
    return p1.crossProduct(p2);
  }

  getPoint(t: number) {
    const d = this.length * t;
    const theta = this.theta.rad;
    const dx = Math.cos(theta) * d;
    const dy = Math.sin(theta) * d;
    return this.start.clone().add(dx, dy);
  }
  getX(y: number, tol = DEFAULT_TOLERANCE) {
    const {a, b, c} = this.getExpression(tol);
    return -(b * y + c) / a;
  }
  getY(x: number, tol = DEFAULT_TOLERANCE) {
    const {a, b, c} = this.getExpression(tol);
    return -(a * x + c) / b;
  }

  contains(object: Point | this, extend = false, tol = DEFAULT_TOLERANCE): boolean {
    if (object instanceof Point) {
      const {x: x1, y: y1} = this.start;
      const {x: x2, y: y2} = this.end;
      const {x, y} = object;
      const withinLine = extend || (isBetween(x, x1, x2, true, tol) && isBetween(y, y1, y2, true, tol));
      return isNearZero((x - x1) * (y2 - y1) - (x2 - x1) * (y - y1), tol) && withinLine;
    } else if (object instanceof Line) {
      return this.contains(object.start, extend, tol) && this.contains(object.end, extend, tol);
    }
    return false;
  }

  intersects(target: Curve, extend = false, refPoint?: Point, tol = DEFAULT_TOLERANCE) {
    if (target instanceof Line) {
      return lineIntersectsLine(this, target, extend, tol);
    } else if (target instanceof Arc) {
      return lineIntersectsArc(this, target, extend, refPoint, tol);
    }
    return [];
  }
}
