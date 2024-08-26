import {Arc} from "./arc";
import {DEFAULT_TOLERANCE} from "./constants";
import {Line} from "./line";
import {approachZero, isNearZero} from "./numbers";
import {Point} from "./point";

export const lineIntersectsLine = (line1: Line, line2: Line, extend = false, tol = DEFAULT_TOLERANCE) => {
  const exp1 = line1.getExpression(tol);
  const exp2 = line2.getExpression(tol);
  const {a: a1, b: b1} = exp1;
  const c1 = -exp1.c;
  const {a: a2, b: b2} = exp2;
  const c2 = -exp2.c;
  const k = a1 * b2 - a2 * b1;
  if (isNearZero(k, tol)) {
    const point = new Point((b2 * c1 - b1 * c2) / k, (a1 * c2 - a2 * c1) / k);
    if (extend || (line1.contains(point, false, tol) && line2.contains(point, false, tol))) {
      return [point];
    }
  } else {
    const {start: p1, end: p2} = line1;
    const {start: p3, end: p4} = line2;
    const isContain1 = line1.contains(p3, false, tol);
    const isContain2 = line1.contains(p4, false, tol);
    const isContain3 = line2.contains(p1, false, tol);
    const isContain4 = line2.contains(p2, false, tol);
    let p5: Point | null = null;
    let p6: Point | null = null;
    if (isContain1 && isContain2) {
      p5 = p3;
      p6 = p4;
    } else if (isContain3 && isContain4) {
      p5 = p1;
      p6 = p2;
    } else if (isContain1 || isContain2) {
      p5 = isContain1 ? p3 : p4;
    } else if (isContain3 || isContain4) {
      p6 = isContain3 ? p1 : p2;
    }
    if (p5 && p6) {
      if (p5.equals(p6, tol)) {
        return [p5.clone()];
      } else {
        return [p5.clone(), p6.clone()];
      }
    }
    p5 = new Point(b2 * c1 - b1 * c2, a1 * c2 - a2 * c1).divide(k);
    if (extend || (line1.contains(p5, false, tol) && line2.contains(p5, false, tol))) {
      return [p5];
    }
  }
  return [];
};

export const lineIntersectsArc = (line: Line, arc: Arc, extend = false, refPoint?: Point, tol = DEFAULT_TOLERANCE) => {
  const {x: ox, y: oy} = arc.center;
  const r = arc.radius;
  const {a: A, b: B, c: C} = line.getExpression(tol);
  let xa: number;
  let xb: number;
  let ya: number;
  let yb: number;
  let result: Point[];
  if (B == 0) {
    xa = xb = -C / A;
    const a = 1;
    const b = -2 * oy;
    const c = oy ** 2 + (xa - ox) ** 2 - r ** 2;
    let d = approachZero(b ** 2 - 4 * a * c, tol);
    if (d < 0) {
      return [];
    }
    d = Math.sqrt(d);
    ya = (-b + d) / 2 / a;
    yb = (-b - d) / 2 / a;
  } else {
    const k = -A / B;
    const b1 = -C / B;
    const a = 1 + k ** 2;
    const b = 2 * (k * (b1 - oy) - ox);
    const c = ox ** 2 + (b1 - oy) ** 2 - r ** 2;
    let d = approachZero(b ** 2 - 4 * a * c, tol);
    if (d < 0) {
      return [];
    }
    d = Math.sqrt(d);
    xa = (-b + d) / 2 / a;
    xb = (-b - d) / 2 / a;
    ya = k * xa + b1;
    yb = k * xb + b1;
  }
  if (isNearZero(xa - xb, tol) && isNearZero(ya - yb, tol)) {
    result = [new Point(xa, ya)];
  } else {
    result = [new Point(xa, ya), new Point(xb, yb)];
  }
  const result2: Point[] = [];
  for (const p of result) {
    if (line.contains(p, extend, tol) && arc.contains(p, extend, tol)) {
      result2.push(p);
    }
  }
  if (refPoint instanceof Point) {
    result2.sort((p) => refPoint.distanceTo(p));
  }
  return result2;
};

export const arcIntersectsArc = (arc1: Arc, arc2: Arc, extend = false, refPoint?: Point, tol = DEFAULT_TOLERANCE) => {
  const {x: x1, y: y1} = arc1.center;
  const r1 = arc1.radius;
  const {x: x2, y: y2} = arc2.center;
  const r2 = arc2.radius;
  const a = approachZero(2 * (x1 - x2), tol);
  const b = approachZero(2 * (y1 - y2), tol);
  const c = x2 ** 2 - x1 ** 2 + y2 ** 2 - y1 ** 2 + r1 ** 2 - r2 ** 2;
  let line: Line;
  if (a != 0 && b != 0) {
    line = new Line(new Point(0, -c / b), new Point(-c / a, 0));
  } else if (a != 0) {
    line = new Line(new Point(-c / a, 0), new Point(-c / a, 1));
  } else if (b != 0) {
    line = new Line(new Point(0, -c / b), new Point(1, -c / b));
  } else {
    // 两弧线圆心相同
    const start1 = arc1.startPoint;
    const end1 = arc1.endPoint;
    const start2 = arc2.startPoint;
    const end2 = arc2.endPoint;
    if (start1.equals(start2, tol) || start1.equals(end2, tol)) {
      return [start1];
    }
    if (end1.equals(start2, tol) || end1.equals(end2, tol)) {
      return [end1];
    }
    return [];
  }
  const result = lineIntersectsArc(line, arc1, true, undefined, tol);
  const result2 = [];
  for (const p of result)
    if (arc1.contains(p, extend, tol) && arc2.contains(p, extend, tol)) {
      result2.push(p);
    }
  if (refPoint instanceof Point) {
    result2.sort((p) => refPoint.distanceTo(p));
  }
  return result2;
};
