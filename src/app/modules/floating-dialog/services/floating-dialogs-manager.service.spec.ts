import {TestBed} from "@angular/core/testing";
import {FloatingDialogsManagerService} from "./floating-dialogs-manager.service";

describe("FloatingDialogServiceService", () => {
  let service: FloatingDialogsManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FloatingDialogsManagerService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
