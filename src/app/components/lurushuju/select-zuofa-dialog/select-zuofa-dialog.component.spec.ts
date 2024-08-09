import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {SelectZuofaDialogComponent} from "./select-zuofa-dialog.component";
import {SelectZuofaInput} from "./select-zuofa-dialog.types";

const data: SelectZuofaInput = {xinghaoOptions: {}};
describe("SelectZuofaDialogComponent", () => {
  let component: SelectZuofaDialogComponent;
  let fixture: ComponentFixture<SelectZuofaDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectZuofaDialogComponent],
      providers: [{provide: MAT_DIALOG_DATA, useValue: data}, {provide: MatDialogRef, useValue: {}}, provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectZuofaDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
