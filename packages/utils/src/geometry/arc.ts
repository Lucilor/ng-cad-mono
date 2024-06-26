import {Angle} from "./angle";
import {DEFAULT_TOLERANCE} from "./constants";
import {Curve} from "./curve";
import {arcIntersectsArc, lineIntersectsArc} from "./intersection";
import {Line} from "./line";
import {Matrix, MatrixLike} from "./matrix";
import {isBetween, isNearZero} from "./numbers";
import {Point} from "./point";

export class Arc extends Curve {
  center: Point;
  radius: number;
  clockwise: boolean;
  startAngle: Angle;
  endAngle: Angle;
  get isFinite() {
    return (
      this.center.isFinite &&
      this.startPoint.isFinite &&
      this.endPoint.isFinite &&
      isFinite(this.radius) &&
      this.startAngle.isFinite &&
      this.endAngle.isFinite
    );
  }
  get isNaN() {
    return (
      this.center.isNaN ||
      this.startPoint.isNaN ||
      this.endPoint.isNaN ||
      isNaN(this.radius) ||
      this.startAngle.isNaN ||
      this.endAngle.isNaN
    );
  }

  constructor(center = new Point(), radius?: number, start?: Angle | Point, end?: Angle | Point, clockwise = true) {
    super();
    this.center = center;
    this.radius = radius || 0;
    this.clockwise = clockwise;
    if (start instanceof Angle) {
      this.startAngle = start;
    } else if (start instanceof Point) {
      this.startAngle = new Angle();
      this.startPoint = start;
    } else {
      this.startAngle = new Angle(0);
    }
    if (end instanceof Angle) {
      this.endAngle = end;
    } else if (end instanceof Point) {
      this.endAngle = new Angle();
      this.endPoint = end;
    } else {
      this.endAngle = new Angle(Math.PI * 2);
    }
  }

  get startPoint() {
    const d = new Point(Math.cos(this.startAngle.rad), Math.sin(this.startAngle.rad)).multiply(this.radius);
    return this.center.clone().add(d);
  }
  set startPoint(value: Point) {
    this.startAngle.rad = new Line(this.center, value).theta.rad;
  }
  get endPoint() {
    const d = new Point(Math.cos(this.endAngle.rad), Math.sin(this.endAngle.rad)).multiply(this.radius);
    return this.center.clone().add(d);
  }
  set endPoint(value: Point) {
    this.endAngle.rad = new Line(this.center, value).theta.rad;
  }
  get totalAngle() {
    const {startAngle, endAngle, clockwise} = this;
    const start = startAngle.deg;
    const end = endAngle.deg;
    let angle: number;
    const unit = startAngle.unit === endAngle.unit ? startAngle.unit : "rad";
    if (clockwise) {
      angle = start - end;
    } else {
      angle = end - start;
    }
    return new Angle(angle, unit).constrain(true);
  }
  get length() {
    return this.radius * this.totalAngle.rad;
  }

  equals(arc: Arc) {
    return (
      this.center.equals(arc.center) &&
      this.radius === arc.radius &&
      this.startAngle.equals(arc.startAngle) &&
      this.endAngle.equals(arc.endAngle) &&
      this.clockwise === arc.clockwise
    );
  }

  getPoint(t: number) {
    const {startAngle, totalAngle, clockwise, radius} = this;
    const angle = startAngle.rad + totalAngle.rad * t * (clockwise ? -1 : 1);
    const offset = new Point(Math.cos(angle), Math.sin(angle)).multiply(radius);
    return this.center.clone().add(offset);
  }

  transform(matrix: MatrixLike) {
    matrix = new Matrix(matrix);
    const start = this.getPoint(0).transform(matrix);
    const end = this.getPoint(1).transform(matrix);
    this.center.transform(matrix);
    this.startPoint = start;
    this.endPoint = end;
    this.radius = this.center.distanceTo(start);

    const scale = matrix.scale();
    if (scale[0] * scale[1] < 0) {
      this.clockwise = !this.clockwise;
    }

    return this;
  }

  contains(object: Point | this, extend = false, tol = DEFAULT_TOLERANCE): boolean {
    if (object instanceof Point) {
      const t1 = this.startAngle.constrain().rad;
      const t2 = this.endAngle.constrain().rad;
      const l = new Line(this.center, object);
      if (isNearZero(this.radius - l.length, tol)) {
        return false;
      }
      if (extend) {
        return true;
      }
      const theta = new Line(this.center, object).theta.constrain().rad;
      if (t1 > t2 !== this.clockwise) {
        return !isBetween(theta, t1, t2, false, -tol);
      } else {
        return isBetween(theta, t1, t2, true, tol);
      }
    } else if (object instanceof Arc) {
      return (
        this.contains(object.startPoint, extend, tol) &&
        this.contains(object.endPoint, extend, tol) &&
        this.center.equals(object.center) &&
        this.radius === object.radius &&
        this.clockwise === object.clockwise
      );
    }
    return false;
  }

  intersects(target: Curve, extend = false, refPoint?: Point, tol = DEFAULT_TOLERANCE) {
    if (target instanceof Line) {
      return lineIntersectsArc(target, this, extend, refPoint, tol);
    } else if (target instanceof Arc) {
      return arcIntersectsArc(this, target, extend, refPoint, tol);
    }
    return [];
  }
}
