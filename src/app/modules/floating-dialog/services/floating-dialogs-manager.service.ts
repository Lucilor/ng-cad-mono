import {Injectable, signal} from "@angular/core";
import {FloatingDialogComponent} from "../components/floating-dialog/floating-dialog.component";
import {FloatingDialogLimits} from "./floating-dialogs-manager.types";

@Injectable({
  providedIn: "root"
})
export class FloatingDialogsManagerService {
  dialogs = signal<FloatingDialogComponent[]>([]);
  limits = signal<FloatingDialogLimits>({});
}
