import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'shift-scheduler-spinner',
  standalone: true,
  imports: [NgIf, MatIconModule],
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.scss',
})
export class SpinnerComponent {
  @Input() show = true;
  @Input() message?: string;
}
