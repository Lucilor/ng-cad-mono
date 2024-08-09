import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FloatingDialogTraysComponent} from "./floating-dialog-trays.component";

describe("FloatingDialogTraysComponent", () => {
  let component: FloatingDialogTraysComponent;
  let fixture: ComponentFixture<FloatingDialogTraysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingDialogTraysComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingDialogTraysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
