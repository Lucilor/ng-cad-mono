import {TableDataBase} from "@app/modules/http/services/cad-data.service.types";
import {Page} from "../models/page";

export interface PagesDataRaw {
  pages?: ReturnType<Page["export"]>[];
}

export interface Zidingyibaobiao extends TableDataBase {
  mubanshuju?: string | null;
}

export const pageModes = ["design", "view"] as const;
export type PageMode = (typeof pageModes)[number];
