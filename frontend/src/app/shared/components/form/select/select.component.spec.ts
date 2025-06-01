import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectComponent } from './select.component';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

describe('SelectComponent', () => {
  let component: SelectComponent;
  let fixture: ComponentFixture<SelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectComponent);
    component = fixture.componentInstance;
    component.name = 'company';
    component.label = 'Company';
    component.required = true;
    component.placeholder = 'Select a company';
    component.options = ['Acme', 'Globex', 'Initech'];
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render label and asterisk when required', () => {
    const labelEl = fixture.debugElement.query(By.css('label'));
    expect(labelEl.nativeElement.textContent).toContain('Company');
    expect(labelEl.nativeElement.textContent).toContain('*');
  });

  it('should render all options', () => {
    const options = fixture.debugElement.queryAll(By.css('option'));
    // +1 because of placeholder
    expect(options.length).toBe(component.options.length + 1);
    expect(options[1].nativeElement.textContent.trim()).toBe('Acme');
  });

  it('should update value on selection', () => {
    const selectEl = fixture.debugElement.query(By.css('select')).nativeElement;

    // Simulate change
    selectEl.value = selectEl.options[2].value; // "Globex"
    selectEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.value).toBe('Globex');
  });

  it('should disable the select when disabled input is true', () => {
    component.disabled = true;
    fixture.detectChanges();

    const selectEl = fixture.debugElement.query(By.css('select')).nativeElement;
    expect(selectEl.disabled).toBe(true);
  });
});
