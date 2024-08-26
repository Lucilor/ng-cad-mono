import {isNearZero, Rectangle} from "@lucilor/utils";
import {PageComponentTypeAny} from "./page-component-infos";
import {PageComponentGroup} from "./page-components/page-component-group";

export const flatPageComponents = function* (components: PageComponentTypeAny[], expand: boolean): Generator<PageComponentTypeAny> {
  for (const component of components) {
    yield component;
    if (component instanceof PageComponentGroup && (expand || component.expanded)) {
      yield* flatPageComponents(component.children, expand);
    }
  }
};
export const flatMapPageComponents = function* <T>(
  components: PageComponentTypeAny[],
  expand: boolean,
  fn: (component: PageComponentTypeAny) => T
): Generator<T> {
  for (const component of flatPageComponents(components, expand)) {
    yield fn(component);
  }
};

export const getPageComponentGroup = (components: PageComponentTypeAny[], component: PageComponentTypeAny): PageComponentGroup | null => {
  for (const parent of components) {
    if (parent.id === component.id) {
      return null;
    }
    if (parent instanceof PageComponentGroup) {
      if (parent.children.find((v) => v === component)) {
        return parent;
      }
      const result = getPageComponentGroup(parent.children, component);
      if (result) {
        return result;
      }
    }
  }
  return null;
};
export const removePageComponent = (components: PageComponentTypeAny[], component: PageComponentTypeAny) => {
  const arr = getPageComponentGroup(components, component)?.children || components;
  const index = arr.findIndex((v) => v.id === component.id);
  return arr.splice(index, 1);
};

export const findPageComponent = (id: string, components: PageComponentTypeAny[]) => {
  for (const component of flatPageComponents(components, true)) {
    if (component.id === id) {
      return component;
    }
  }
  return null;
};

export const getComponentEl = (id: string) => {
  const el = document.querySelector(`.page-component[data-id="${id}"]`);
  if (el instanceof HTMLElement) {
    return el;
  }
  return null;
};
export const getComponentsRect = (components: PageComponentTypeAny[], excludes: PageComponentTypeAny[] = [], hostEl?: Element | null) => {
  if (!hostEl) {
    hostEl = document.querySelector("app-page-components-diaplay");
  }
  let rect = Rectangle.min;
  for (const component of components) {
    if (excludes.some((v) => v.id === component.id)) {
      return rect;
    }
    if (component instanceof PageComponentGroup) {
      const childrenRect = getComponentsRect(component.children, excludes, hostEl);
      rect.expandByRect(childrenRect);
    } else {
      const el = getComponentEl(component.id);
      if (hostEl && el) {
        const hostRect = Rectangle.fromDomRect(hostEl.getBoundingClientRect());
        rect = Rectangle.fromDomRect(el.getBoundingClientRect());
        rect.min.sub(hostRect.min);
        rect.max.sub(hostRect.min);
      }
    }
  }
  return rect;
};

export const updateGroup = (components: PageComponentTypeAny[], component: PageComponentTypeAny) => {
  const group = getPageComponentGroup(components, component);
  if (group) {
    const rect = getComponentsRect(group.children);
    group.size.set(rect.width, rect.height);
    const dx = rect.left - group.position.x;
    const dy = rect.bottom - group.position.y;
    group.position.add(dx, dy);
    for (const child of group.children) {
      child.position.sub(dx, dy);
    }
  }
};
export const fitGroup = (group: PageComponentGroup, fromRect: Rectangle, toRect: Rectangle, components: PageComponentTypeAny[]) => {
  if (!fromRect.isFinite || !toRect.isFinite) {
    return;
  }
  group.size.set(toRect.width, toRect.height);
  const dx = toRect.left - fromRect.left;
  const dy = toRect.bottom - fromRect.bottom;
  if (isNearZero(dx) && isNearZero(dy)) {
    return;
  }
  group.position.add(dx, dy);
  for (const child of group.children) {
    if (components.some((v) => v.id === child.id)) {
      continue;
    }
    child.position.sub(dx, dy);
  }
};
export const beforeJoinGroup = (group: PageComponentGroup, components: PageComponentTypeAny[]) => {
  const fromRect = getComponentsRect([group]);
  const toRect = fromRect.clone().expandByRect(getComponentsRect(components));
  fitGroup(group, fromRect, toRect, components);
  for (const component of components) {
    component.position.sub(group.position);
    component.rotation.sub(group.rotation);
    component.scale.divide(group.scale);
  }
};
export const beforeLeaveGroup = (group: PageComponentGroup, components: PageComponentTypeAny[]) => {
  const toRect = getComponentsRect([group], components);
  const fromRect = toRect.clone().expandByRect(getComponentsRect(components));
  for (const component of components) {
    component.position.add(group.position);
    component.rotation.add(group.rotation);
    component.scale.multiply(group.scale);
  }
  fitGroup(group, fromRect, toRect, components);
};
