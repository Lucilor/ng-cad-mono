import {getFilepathUrl} from "@app/app.common";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {InputInfo, InputInfoGroup, InputInfoNumber, InputInfoOption, InputInfoSelect} from "@app/modules/input/components/input.types";
import {isTypeOf, selectFiles} from "@lucilor/utils";
import Color from "color";
import {DataType, Property} from "csstype";
import {getGroupStyle, getInputStyle, getNumberUnitInput, getUnifiedInputs} from "../../models/input-info-utils";
import {pageComponentInfos, PageComponentTypeAny} from "../../models/page-component-infos";
import {PageComponentForm} from "../../models/page-components/page-component-form";
import {PageComponentImage} from "../../models/page-components/page-component-image";
import {PageComponentTextBase} from "../../models/page-components/page-component-text-base";
import {trblItems} from "../../models/page.utils";
import {InputGroup} from "./page-component-config2.types";

export const mergeGroups = (groups1: InputGroup[], groups2: InputGroup[]) => {
  for (const group of groups2) {
    const group2 = groups1.find((g) => g.name === group.name);
    if (group2) {
      group2.infos.push(...group.infos);
    } else {
      groups1.push(group);
    }
  }
  return groups1;
};

const getValue = <T>(values: T[]) => {
  if (values.every((v) => v === values[0])) {
    return {value: values[0], isUnique: true};
  } else {
    return {value: "" as T, isUnique: false};
  }
};
const getInputInfoPart = <T>(
  components: T[],
  key: keyof T,
  onChange?: () => void,
  opts?: {isColor?: boolean; key2?: any; afterValSet?: (val: any, component: T) => void}
) => {
  const {isColor, key2, afterValSet} = opts || {};
  const valueInfo = getValue(
    components.map((v) => {
      let result: any = v[key];
      if (isTypeOf(key2, ["string", "number"])) {
        result = result[key2];
      }
      return result;
    })
  );
  let value = valueInfo.value;
  if (isColor) {
    try {
      value = new Color(value);
    } catch {
      value = new Color();
    }
  }
  return {
    value: value,
    hint: valueInfo.isUnique ? "" : "包含多个值",
    onChange: (val: any) => {
      if (isColor) {
        val = val.string();
      }
      for (const component of components) {
        let obj: any = component;
        let k: any = key;
        if (isTypeOf(key2, ["string", "number"])) {
          obj = component[key];
          k = key2;
        }
        obj[k] = val;
        afterValSet?.(val, component);
      }
      onChange?.();
    }
  };
};
const getInputInfoPartTrbl = <T>(
  label: string,
  id: string,
  type: "boolean" | "number",
  components: T[],
  key: keyof T,
  onChange?: () => void
): InputInfoGroup => {
  const arrs = components.map((v) => v[key]);
  const arr = trblItems.map((_, i) => getValue(arrs.map((v) => (v as any)[i])).value);
  return {
    type: "group",
    label,
    groupStyle: getGroupStyle(),
    infos: getUnifiedInputs(
      id,
      trblItems.map(({name, index}) => ({
        type,
        label: name,
        style: getInputStyle(true, {flex: "0 0 50%"}),
        ...getInputInfoPart(components, key, undefined, {
          key2: index,
          afterValSet: (val) => {
            arr[index] = val;
            for (const component of components) {
              for (const [i, v] of arr.entries()) {
                if (isTypeOf(v, type)) {
                  (component as any)[key][i] = v;
                }
              }
            }
          }
        })
      })),
      arr,
      onChange
    )
  };
};

export const getTextInputs = (components0: PageComponentTypeAny[], onChange: () => void): InputGroup<PageComponentTextBase>[] => {
  if (!components0.every((v) => v instanceof PageComponentTextBase)) {
    return [];
  }
  const components = components0 as PageComponentTextBase[]; // fixme;
  const contentPositionOptions: InputInfoOption<Property.TextAlign>[] = [
    {label: "居左", value: "left"},
    {label: "居中", value: "center"},
    {label: "居右", value: "right"}
  ];
  return [
    {
      name: "",
      infos: [
        {
          type: "string",
          label: "字体",
          ...getInputInfoPart(components, "fontFamily", onChange)
        },
        {
          ...getNumberUnitInput(false, "字号", "px"),
          ...getInputInfoPart(components, "fontSize", onChange)
        },
        {
          type: "select",
          label: "字体对齐方式",
          options: contentPositionOptions,
          ...getInputInfoPart(components, "textAlign", onChange)
        },
        {
          type: "color",
          label: "字体颜色",
          ...getInputInfoPart(components, "color", onChange, {isColor: true})
        }
      ]
    }
  ];
};

export const getImageInputs = (
  components0: PageComponentTypeAny[],
  onChange: () => void,
  http: CadDataService
): InputGroup<PageComponentImage>[] => {
  if (!components0.every((v) => v instanceof PageComponentImage)) {
    return [];
  }
  const components = components0 as PageComponentImage[]; // fixme;
  return [
    {
      name: "",
      infos: [
        {
          type: "string",
          label: "图片链接",
          suffixIcons: [
            {
              name: "upload_file",
              color: "primary",
              onClick: async () => {
                const files = await selectFiles({accept: "image/*"});
                const file = files?.[0];
                if (!file) {
                  return;
                }
                const result = await http.uploadImage(file);
                let src = result?.url;
                if (src) {
                  src = getFilepathUrl(src, {remote: true});
                  for (const component of components) {
                    component.src = src;
                  }
                  onChange();
                }
              }
            }
          ],
          style: getInputStyle(false),
          ...getInputInfoPart(components, "src", onChange)
        },
        {
          type: "group",
          label: "",
          groupStyle: getGroupStyle(),
          infos: [
            {
              type: "boolean",
              label: "保持比例",
              style: getInputStyle(true),
              ...getInputInfoPart(components, "keepRatio", onChange, {
                afterValSet: (val, component) => {
                  component.fitSize();
                }
              })
            },
            {
              type: "select",
              label: "适应方式",
              options: [
                {label: "contain", value: "contain"},
                {label: "cover", value: "cover"},
                {label: "fill", value: "fill"},
                {label: "none", value: "none"},
                {label: "scale-down", value: "scale-down"}
              ],
              style: getInputStyle(true),
              ...getInputInfoPart(components, "objectFit", onChange)
            }
          ]
        }
      ]
    }
  ];
};

export const getFormInputs = (components0: PageComponentTypeAny[], onChange: () => void): InputGroup[] => {
  if (!components0.every((v) => v instanceof PageComponentForm)) {
    return [];
  }
  const components = components0 as PageComponentForm[]; // fixme;
  return [
    {
      name: "",
      infos: [
        {
          type: "group",
          label: "",
          groupStyle: getGroupStyle(),
          infos: [
            {type: "number", label: "行数", style: getInputStyle(true), ...getInputInfoPart(components, "rows", onChange)},
            {type: "number", label: "列数", style: getInputStyle(true), ...getInputInfoPart(components, "cols", onChange)}
          ]
        },
        {
          type: "group",
          label: "",
          groupStyle: getGroupStyle(),
          infos: [
            {type: "number", label: "标题宽", style: getInputStyle(true), ...getInputInfoPart(components, "labelWidth", onChange)},
            {type: "number", label: "内容宽", style: getInputStyle(true), ...getInputInfoPart(components, "valueWidth", onChange)}
          ]
        },
        {
          type: "group",
          label: "",
          groupStyle: getGroupStyle(),
          infos: [
            {type: "boolean", label: "标题分隔线", style: getInputStyle(true), ...getInputInfoPart(components, "labelSeparator", onChange)},
            {type: "number", label: "行高", style: getInputStyle(true), ...getInputInfoPart(components, "rowHeight", onChange)}
          ]
        }
      ]
    },
    {
      name: "表格边距",
      infos: [
        getInputInfoPartTrbl("标题边距", "表格标题边距", "number", components, "labelPadding", onChange),
        getInputInfoPartTrbl("内容边距", "表格内容边距", "number", components, "valuePadding", onChange)
      ]
    }
  ];
};

export const getCommonInputs = (
  components: PageComponentTypeAny[],
  onChange: () => void,
  onComponentSizeChange: (component: any, axis: "x" | "y") => void
): InputGroup[] => {
  let resizableX = true;
  let resizableY = true;
  for (const component of components) {
    const {resizable = {}} = pageComponentInfos[component.type] || {};
    if (!resizable.x) {
      resizableX = false;
    }
    if (!resizable.y) {
      resizableY = false;
    }
  }
  const widthInput: InputInfoNumber = {
    ...getNumberUnitInput(true, "宽", "px"),
    ...getInputInfoPart(components, "size", onChange, {
      key2: "x",
      afterValSet: (val, component) => {
        onComponentSizeChange(component, "x");
      }
    })
  };
  if (!resizableX) {
    widthInput.readonly = true;
    widthInput.hint = "宽度自动调整";
  }
  const heightInput: InputInfoNumber = {
    ...getNumberUnitInput(true, "高", "px"),
    ...getInputInfoPart(components, "size", onChange, {
      key2: "y",
      afterValSet: (val, component) => {
        onComponentSizeChange(component, "y");
      }
    })
  };
  if (!resizableY) {
    heightInput.readonly = true;
    heightInput.hint = "高度自动调整";
  }

  const xInput: InputInfoNumber = {
    ...getNumberUnitInput(true, "X", "px"),
    ...getInputInfoPart(components, "position", onChange, {
      key2: "x",
      afterValSet: (val, component) => {
        onComponentSizeChange(component, "x");
      }
    })
  };
  const yInput: InputInfoNumber = {
    ...getNumberUnitInput(true, "Y", "px"),
    ...getInputInfoPart(components, "position", onChange, {
      key2: "y",
      afterValSet: (val, component) => {
        onComponentSizeChange(component, "y");
      }
    })
  };

  const borderStyleInput: InputInfoSelect<any, DataType.LineStyle> = {
    type: "select",
    label: "边框样式",
    options: [
      {label: "无", value: "none"},
      {label: "实线", value: "solid"},
      {label: "虚线", value: "dashed"},
      {label: "点线", value: "dotted"}
    ],
    ...getInputInfoPart(components, "borderStyle", onChange, {
      afterValSet: (val, component) => {
        if (val !== "none" && !(component.borderWidth > 0)) {
          component.borderWidth = 1;
        }
      }
    }),
    style: getInputStyle(false)
  };
  const borderInputs: InputInfo<any>[] = [
    borderStyleInput,
    {
      type: "color",
      label: "边框颜色",
      ...getInputInfoPart(components, "borderColor", onChange, {isColor: true})
    },
    {
      ...getNumberUnitInput(true, "边框宽度", "px", {}),
      ...getInputInfoPart(components, "borderWidth", onChange)
    },
    getInputInfoPartTrbl("框线显示", "框线显示", "boolean", components, "borderShow", onChange)
  ];

  return [
    {
      name: "",
      infos: [
        {
          type: "color",
          label: "背景颜色",
          ...getInputInfoPart(components, "background", onChange, {isColor: true})
        }
      ]
    },
    {name: "边框", infos: borderInputs},
    {
      name: "尺寸与位置",
      infos: [
        {type: "group", label: "尺寸", groupStyle: getGroupStyle(), infos: [widthInput, heightInput]},
        {type: "group", label: "位置", groupStyle: getGroupStyle(), infos: [xInput, yInput]},
        {
          ...getNumberUnitInput(true, "旋转", "°"),
          ...getInputInfoPart(components, "rotation", onChange, {key2: "deg"})
        }
      ]
    }
  ];
};
