import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FloatingDialogComponent} from "./floating-dialog.component";

describe("FloatingDialogComponent", () => {
  let component: FloatingDialogComponent;
  let fixture: ComponentFixture<FloatingDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingDialogComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
