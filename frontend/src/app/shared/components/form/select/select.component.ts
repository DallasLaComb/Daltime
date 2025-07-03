import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';

@Component({
  selector: 'shift-scheduler-select',
  standalone: true,
  imports: [NgIf, NgFor],
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  @Input() label!: string;
  @Input() name!: string;
  @Input() placeholder: string = 'Select an option';
  @Input() required: boolean = false;
  @Input() options: string[] = [];

  value: string = '';
  disabled = false;

  onChange = (value: string) => {};
  onTouched = () => {};

  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  handleChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.value = select.value;
    this.onChange(this.value);
  }
}
