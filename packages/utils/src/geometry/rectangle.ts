import {Line} from "./line";
import {MatrixLike} from "./matrix";
import {Point, PointLike} from "./point";

export type RectLike = {min: PointLike; max: PointLike};

export class Rectangle {
  static get min() {
    return new Rectangle([Infinity, Infinity], [-Infinity, -Infinity]);
  }
  static get max() {
    return new Rectangle([-Infinity, -Infinity], [Infinity, Infinity]);
  }
  static fromPoints(points: PointLike[]) {
    const rect = Rectangle.min;
    for (const point of points) {
      rect.expandByPoint(point);
    }
    return rect;
  }
  static fromDomRect({left, top, right, bottom}: DOMRect) {
    return new Rectangle([left, top], [right, bottom]);
  }

  min = new Point();
  max = new Point();

  get width() {
    return this.max.x - this.min.x;
  }
  get height() {
    return this.max.y - this.min.y;
  }
  get area() {
    return this.width * this.height;
  }
  get top() {
    return this.max.y;
  }
  set top(value) {
    this.max.y = value;
  }
  get right() {
    return this.max.x;
  }
  set right(value) {
    this.max.x = value;
  }
  get bottom() {
    return this.min.y;
  }
  set bottom(value) {
    this.min.y = value;
  }
  get left() {
    return this.min.x;
  }
  set left(value) {
    this.min.x = value;
  }
  get x() {
    return (this.min.x + this.max.x) / 2;
  }
  get y() {
    return (this.min.y + this.max.y) / 2;
  }
  get isFinite() {
    return this.min.isFinite && this.max.isFinite;
  }
  get isNaN() {
    return this.min.isNaN || this.max.isNaN;
  }

  constructor(min: PointLike = 0, max: PointLike = 0) {
    this.set(min, max);
  }

  justify() {
    if (this.min.x > this.max.x) {
      [this.min.x, this.max.x] = [this.max.x, this.min.x];
    }
    if (this.min.y > this.max.y) {
      [this.min.y, this.max.y] = [this.max.y, this.min.y];
    }
    return this;
  }

  clone() {
    return new Rectangle(this.min.clone(), this.max.clone());
  }

  copy(rect: Rectangle) {
    this.min.copy(rect.min);
    this.max.copy(rect.max);
  }

  set(min: PointLike, max: PointLike) {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }

  expandByPoint(point: PointLike) {
    const {x, y} = new Point(point);
    this.min.x = Math.min(this.min.x, x);
    this.min.y = Math.min(this.min.y, y);
    this.max.x = Math.max(this.max.x, x);
    this.max.y = Math.max(this.max.y, y);
    return this;
  }

  expandByRect(rect: RectLike) {
    const {min, max} = new Rectangle(rect.min, rect.max);
    this.min.x = Math.min(this.min.x, min.x);
    this.min.y = Math.min(this.min.y, min.y);
    this.max.x = Math.max(this.max.x, max.x);
    this.max.y = Math.max(this.max.y, max.y);
    return this;
  }

  contains(object: Point | Line | Rectangle): boolean {
    if (object instanceof Point) {
      const {x, y} = object;
      const {top, right, bottom, left} = this;
      return x >= left && x <= right && y <= top && y >= bottom;
    } else if (object instanceof Line) {
      return this.contains(object.start) && this.contains(object.end);
    } else if (object instanceof Rectangle) {
      const {x: x1, y: y1} = this.min;
      const {x: x2, y: y2} = this.max;
      const {x: x3, y: y3} = object.min;
      const {x: x4, y: y4} = object.max;
      return x1 <= x3 && x2 >= x4 && y1 <= y3 && y2 >= y4;
    }
    return false;
  }

  equals(rect: Rectangle) {
    return this.min.equals(rect.min) && this.max.equals(rect.max);
  }

  transform(matrix: MatrixLike) {
    this.min.transform(matrix);
    this.max.transform(matrix);
    this.justify();
    return this;
  }

  intersects(rect: Rectangle) {
    const left = Math.max(this.left, rect.left);
    const right = Math.min(this.right, rect.right);
    const top = Math.min(this.top, rect.top);
    const bottom = Math.max(this.bottom, rect.bottom);
    if (left <= right && bottom <= top) {
      return new Rectangle(new Point(left, bottom), new Point(right, top));
    }
    return null;
  }

  getPoint(tx: number, ty: number) {
    const {left, bottom, width, height} = this;
    const x = left + width * tx;
    const y = bottom + height * ty;
    return new Point(x, y);
  }
}
